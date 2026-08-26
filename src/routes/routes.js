import express from "express";
import { upload } from "../middleware/upload.js";
import {
  register,
  handleOTP,
  resendOTP,
  login,
  updateProfile,
  sendPasswordChangeOTP,
  changePassword,
} from "../controller/user_controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/otp", handleOTP);
router.post("/resend-otp", resendOTP);
router.post("/login", login);

router.put("/profile", authenticate, updateProfile);
router.post("/password/request-otp", authenticate, sendPasswordChangeOTP);
router.post("/password/change", authenticate, changePassword);
router.put("/profile", authenticate, upload.single("profilePic"), updateProfile);
export default router;