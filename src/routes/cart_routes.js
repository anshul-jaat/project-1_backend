import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controller/cart_controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// All cart routes require user authentication
router.use(authenticate);

router.get("/", getCart);
router.post("/add", addToCart);
router.put("/update", updateCartItem);
router.delete("/remove/:productId", removeCartItem);
router.delete("/clear", clearCart);

export default router;
