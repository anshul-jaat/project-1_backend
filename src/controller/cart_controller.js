import Cart from "../model/cart_model.js";
import Product from "../model/product_model.js";
import { catchAsync } from "../middleware/errorhandling.js";

// ======================= GET USER CART =======================
export const getCart = catchAsync(async (req, res) => {
  const userId = req.user._id;

  let cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    select: "title price discountPrice images stock category brand",
  });

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  // Filter out any items where product was deleted
  cart.items = cart.items.filter((item) => item.product != null);

  const subtotal = cart.items.reduce((sum, item) => {
    const effectivePrice = item.product?.discountPrice > 0 ? item.product.discountPrice : item.product?.price || item.price;
    return sum + effectivePrice * item.quantity;
  }, 0);

  res.status(200).json({
    success: true,
    cart,
    subtotal,
    itemCount: cart.items.reduce((cnt, item) => cnt + item.quantity, 0),
  });
});

// ======================= ADD ITEM TO CART =======================
export const addToCart = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    return res.status(400).json({ success: false, message: "Product ID is required" });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  const effectivePrice = product.discountPrice > 0 ? product.discountPrice : product.price;

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  const existingItemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  const requestedQuantity = parseInt(quantity, 10);

  if (existingItemIndex > -1) {
    const newQty = cart.items[existingItemIndex].quantity + requestedQuantity;
    if (newQty > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`,
      });
    }
    cart.items[existingItemIndex].quantity = newQty;
    cart.items[existingItemIndex].price = effectivePrice;
  } else {
    if (requestedQuantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`,
      });
    }
    cart.items.push({
      product: productId,
      quantity: requestedQuantity,
      price: effectivePrice,
    });
  }

  await cart.save();

  const populatedCart = await Cart.findById(cart._id).populate({
    path: "items.product",
    select: "title price discountPrice images stock category brand",
  });

  const subtotal = populatedCart.items.reduce((sum, item) => {
    const price = item.product?.discountPrice > 0 ? item.product.discountPrice : item.product?.price || item.price;
    return sum + price * item.quantity;
  }, 0);

  res.status(200).json({
    success: true,
    message: "Item added to cart",
    cart: populatedCart,
    subtotal,
    itemCount: populatedCart.items.reduce((cnt, item) => cnt + item.quantity, 0),
  });
});

// ======================= UPDATE CART ITEM QUANTITY =======================
export const updateCartItem = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { productId, quantity } = req.body;

  if (!productId || quantity === undefined) {
    return res.status(400).json({ success: false, message: "Product ID and quantity are required" });
  }

  const qty = parseInt(quantity, 10);
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (itemIndex === -1) {
    return res.status(404).json({ success: false, message: "Item not in cart" });
  }

  if (qty <= 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    const product = await Product.findById(productId);
    if (product && qty > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`,
      });
    }
    cart.items[itemIndex].quantity = qty;
  }

  await cart.save();

  const populatedCart = await Cart.findById(cart._id).populate({
    path: "items.product",
    select: "title price discountPrice images stock category brand",
  });

  const subtotal = populatedCart.items.reduce((sum, item) => {
    const price = item.product?.discountPrice > 0 ? item.product.discountPrice : item.product?.price || item.price;
    return sum + price * item.quantity;
  }, 0);

  res.status(200).json({
    success: true,
    message: "Cart updated",
    cart: populatedCart,
    subtotal,
    itemCount: populatedCart.items.reduce((cnt, item) => cnt + item.quantity, 0),
  });
});

// ======================= REMOVE ITEM FROM CART =======================
export const removeCartItem = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId
  );

  await cart.save();

  const populatedCart = await Cart.findById(cart._id).populate({
    path: "items.product",
    select: "title price discountPrice images stock category brand",
  });

  const subtotal = populatedCart.items.reduce((sum, item) => {
    const price = item.product?.discountPrice > 0 ? item.product.discountPrice : item.product?.price || item.price;
    return sum + price * item.quantity;
  }, 0);

  res.status(200).json({
    success: true,
    message: "Item removed from cart",
    cart: populatedCart,
    subtotal,
    itemCount: populatedCart.items.reduce((cnt, item) => cnt + item.quantity, 0),
  });
});

// ======================= CLEAR CART =======================
export const clearCart = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId });
  if (cart) {
    cart.items = [];
    await cart.save();
  }

  res.status(200).json({
    success: true,
    message: "Cart cleared",
    cart: { items: [] },
    subtotal: 0,
    itemCount: 0,
  });
});
