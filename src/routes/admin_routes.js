import express from "express";
import {
  getAdminStats,
  getAllUsers,
  updateUserRole,
} from "../controller/admin_controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

router.get("/stats", getAdminStats);
router.get("/users", getAllUsers);
router.patch("/users/:id/role", updateUserRole);

export default router;
