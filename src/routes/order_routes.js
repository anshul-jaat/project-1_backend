import express from "express";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
} from "../controller/order_controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// User routes
router.post("/create", authenticate, createOrder);
router.get("/my-orders", authenticate, getMyOrders);

// Admin routes
router.get("/all", authenticate, requireAdmin, getAllOrders);
router.put("/:id/status", authenticate, requireAdmin, updateOrderStatus);

export default router;
