import Order from "../model/order_model.js";
import Cart from "../model/cart_model.js";
import Product from "../model/product_model.js";
import User from "../model/user_model.js";
import { catchAsync } from "../middleware/errorhandling.js";

// ======================= CREATE ORDER =======================
export const createOrder = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { orderItems, shippingAddress, paymentMethod = "COD", discountAmount = 0, shippingFee = 0 } = req.body;

  if (!orderItems || orderItems.length === 0) {
    return res.status(400).json({ success: false, message: "No items in order" });
  }

  if (!shippingAddress || !shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
    return res.status(400).json({ success: false, message: "Complete shipping address is required" });
  }

  // Calculate items total
  let itemsTotal = 0;
  for (const item of orderItems) {
    itemsTotal += Number(item.price) * Number(item.quantity);

    // Update product stock
    if (item.product) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -Number(item.quantity) },
      });
    }
  }

  const totalAmount = Math.max(0, itemsTotal - Number(discountAmount) + Number(shippingFee));

  const order = new Order({
    user: userId,
    orderItems,
    shippingAddress,
    paymentMethod,
    paymentStatus: paymentMethod === "Card" || paymentMethod === "UPI" ? "Paid" : "Pending",
    totalAmount,
    discountAmount: Number(discountAmount),
    shippingFee: Number(shippingFee),
    status: "Processing",
  });

  await order.save();

  // Add order to user's order list
  await User.findByIdAndUpdate(userId, {
    $push: { order_list: order._id },
  });

  // Clear user's cart
  await Cart.findOneAndUpdate({ user: userId }, { items: [] });

  res.status(201).json({
    success: true,
    message: "Order placed successfully!",
    order,
  });
});

// ======================= GET LOGGED-IN USER ORDERS =======================
export const getMyOrders = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const orders = await Order.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "orderItems.product",
      select: "title images category brand",
    });

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

// ======================= GET ALL ORDERS (Admin) =======================
export const getAllOrders = catchAsync(async (req, res) => {
  const orders = await Order.find({})
    .sort({ createdAt: -1 })
    .populate("user", "first_name last_name email")
    .populate("orderItems.product", "title images");

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

// ======================= UPDATE ORDER STATUS (Admin) =======================
export const updateOrderStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus } = req.body;

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  if (status) {
    order.status = status;
    if (status === "Delivered") {
      order.deliveredAt = new Date();
      order.paymentStatus = "Paid";
    }
  }

  if (paymentStatus) {
    order.paymentStatus = paymentStatus;
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: "Order status updated successfully",
    order,
  });
});
