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
import { authenticate, optionalAuthenticate } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/verify-otp", verifyOTP);            
router.post("/otp", handleOTP);                 
router.post("/resend-otp", resendOTP);
router.post("/login", login);
router.post("/password/request-otp", optionalAuthenticate, sendPasswordChangeOTP);
router.post("/password/change", optionalAuthenticate, changePassword);

// Protected routes
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, upload.single("profilePic"), updateProfile);

export default router;