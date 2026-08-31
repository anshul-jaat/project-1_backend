import express from "express";
import {
  getProducts,
  getProductById,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  seedProducts,
} from "../controller/product_controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Public routes
router.get("/categories", getCategories);
router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/seed", seedProducts);

// Admin routes (requires authentication & admin role)
router.post("/", authenticate, requireAdmin, upload.array("images", 10), createProduct);
router.put("/:id", authenticate, requireAdmin, upload.array("images", 10), updateProduct);
router.delete("/:id", authenticate, requireAdmin, deleteProduct);

export default router;
