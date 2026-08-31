import express from "express";
import {
  register,
  handleOTP,
  resendOTP,
  login,
  updateProfile,
  getProfile,
  sendPasswordChangeOTP,
  changePassword,
  verifyOTP,
} from "../controller/user_controller.js";
import { authenticate } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/verify-otp", verifyOTP);            
router.post("/otp", handleOTP);                 
router.post("/resend-otp", resendOTP);
router.post("/login", login);

// Protected routes
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, upload.single("profilePic"), updateProfile);
router.post("/password/request-otp", authenticate, sendPasswordChangeOTP);
router.post("/password/change", authenticate, changePassword);

export default router;