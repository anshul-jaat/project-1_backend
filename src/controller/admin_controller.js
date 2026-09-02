import User from "../model/user_model.js";
import Product from "../model/product_model.js";
import Order from "../model/order_model.js";
import { catchAsync } from "../middleware/errorhandling.js";

// ======================= GET ADMIN DASHBOARD STATS =======================
export const getAdminStats = catchAsync(async (req, res) => {
  const totalProducts = await Product.countDocuments();
  const totalUsers = await User.countDocuments();
  const totalOrders = await Order.countDocuments();

  const revenueResult = await Order.aggregate([
    { $match: { status: { $ne: "Cancelled" } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]);
  const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

  // Real total count of individual product units sold
  const itemsSoldResult = await Order.aggregate([
    { $match: { status: { $ne: "Cancelled" } } },
    { $unwind: "$orderItems" },
    { $group: { _id: null, totalSold: { $sum: "$orderItems.quantity" } } },
  ]);
  const totalItemsSold = itemsSoldResult.length > 0 ? itemsSoldResult[0].totalSold : 0;

  const lowStockCount = await Product.countDocuments({ stock: { $lte: 5 } });
  const pendingOrdersCount = await Order.countDocuments({ status: "Pending" });
  const processingOrdersCount = await Order.countDocuments({ status: "Processing" });
  const shippedOrdersCount = await Order.countDocuments({ status: "Shipped" });
  const deliveredOrdersCount = await Order.countDocuments({ status: "Delivered" });
  const cancelledOrdersCount = await Order.countDocuments({ status: "Cancelled" });

  const activeOrdersCount = totalOrders - cancelledOrdersCount;
  const averageOrderValue = activeOrdersCount > 0 ? Math.round(totalRevenue / activeOrdersCount) : 0;

  const recentOrders = await Order.find({})
    .sort({ createdAt: -1 })
    .limit(6)
    .populate("user", "first_name last_name email");

  res.status(200).json({
    success: true,
    stats: {
      totalProducts,
      totalUsers,
      totalOrders,
      totalRevenue,
      totalItemsSold,
      averageOrderValue,
      lowStockCount,
      pendingOrdersCount,
      processingOrdersCount,
      shippedOrdersCount,
      deliveredOrdersCount,
      cancelledOrdersCount,
    },
    recentOrders,
  });
});

// ======================= GET ALL USERS (Admin) =======================
export const getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find({})
    .select("-password -verification -passwordReset")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    users,
  });
});

// ======================= UPDATE USER ROLE (Admin) =======================
export const updateUserRole = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!["user", "admin"].includes(role)) {
    return res.status(400).json({ success: false, message: "Invalid role. Must be 'user' or 'admin'" });
  }

  const user = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true, runValidators: true }
  ).select("-password");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.status(200).json({
    success: true,
    message: `User role updated to ${role}`,
    user,
  });
});
