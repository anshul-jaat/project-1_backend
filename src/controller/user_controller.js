import bcrypt from "bcrypt";
import User from "../model/user_model.js";
import { generateOTP, sendOTPEmail } from "../services/otp.service.js";
import { catchAsync } from "../middleware/errorhandling.js";

 
export const register = catchAsync(async (req, res) => {
  const { first_name, last_name, gender, email, password, address_list } = req.body;

  if (!first_name || !last_name || !gender || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: first_name, last_name, gender, email, password",
    });
  }
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long",
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: "Email already registered" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    first_name,
    last_name,
    gender,
    email,
    password: hashedPassword,
    address_list: address_list || [],
    is_address_list: !!(address_list && address_list.length),
    verification: {}, 
  });

  await user.save();

  res.status(201).json({
    success: true,
    message: "User registered. Please request an OTP to verify your email.",
    data: { userId: user._id, email: user.email },
  });
});

export const handleOTP = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const user = await User.findOne({ email })
    .select("+verification.otp +verification.otpAttempts +verification.otpExpires +verification.otpLockUntil +verification.otpFailedAttempts");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (otp) {
    if (user.isOtpLocked()) {
      const remaining = Math.ceil((user.verification.otpLockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `OTP verification locked. Try again in ${remaining} minute(s).`,
      });
    }

    if (user.verification.isVerified) {
      return res.status(400).json({ success: false, message: "User already verified" });
    }

    if (!user.verification.otp) {
      return res.status(400).json({ success: false, message: "No OTP has been sent. Please request one first." });
    }

    if (user.verification.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP expired. Request a new one." });
    }

    if (user.verification.otpAttempts >= 3) {
      user.verification.otpFailedAttempts += 1;
      const lockDuration = User.getOtpLockDuration(user.verification.otpFailedAttempts, 5);
      if (lockDuration > 0) {
        user.set('verification.otpLockUntil', new Date(Date.now() + lockDuration));
      }
      user.set('verification.otpAttempts', 0);
      await user.save();
      return res.status(400).json({
        success: false,
        message: `Too many failed attempts. OTP verification locked for ${Math.ceil(lockDuration/60000)} minutes.`,
      });
    }

    if (user.verification.otp !== otp) {
      user.set('verification.otpAttempts', user.verification.otpAttempts + 1);
      if (user.verification.otpAttempts >= 3) {
        user.verification.otpFailedAttempts += 1;
        const lockDuration = User.getOtpLockDuration(user.verification.otpFailedAttempts, 5);
        if (lockDuration > 0) {
          user.set('verification.otpLockUntil', new Date(Date.now() + lockDuration));
        }
        user.set('verification.otpAttempts', 0);
      }
      await user.save();
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    user.set('verification.isVerified', true);
    user.set('verification.otp', undefined);
    user.set('verification.otpExpires', undefined);
    user.set('verification.otpAttempts', undefined);
    user.set('verification.otpLockUntil', undefined);
    user.set('verification.otpFailedAttempts', undefined);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. Your account is now active.",
      user: { id: user._id, email: user.email, name: `${user.first_name} ${user.last_name}` },
    });
  }

  if (user.verification.isVerified) {
    return res.status(400).json({ success: false, message: "User already verified" });
  }

  if (user.isOtpLocked()) {
    const remaining = Math.ceil((user.verification.otpLockUntil - Date.now()) / 60000);
    return res.status(423).json({
      success: false,
      message: `OTP sending locked. Try again in ${remaining} minute(s).`,
    });
  }

  const newOtp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  user.set('verification.otp', newOtp);
  user.set('verification.otpExpires', otpExpires);
  user.set('verification.otpAttempts', 0);
  await user.save();

  await sendOTPEmail(email, user.first_name, newOtp, "verification");

  res.status(200).json({
    success: true,
    message: "A new OTP has been sent to your email.",
  });
});

export const resendOTP = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const user = await User.findOne({ email })
    .select("+verification.otpLockUntil +verification.otpFailedAttempts");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (user.isOtpLocked()) {
    const remaining = Math.ceil((user.verification.otpLockUntil - Date.now()) / 60000);
    return res.status(423).json({
      success: false,
      message: `OTP resend locked. Try again in ${remaining} minute(s).`,
    });
  }

  if (user.verification.isVerified) {
    return res.status(400).json({ success: false, message: "User already verified" });
  }

  const newOtp = generateOTP();
  user.set('verification.otp', newOtp);
  user.set('verification.otpExpires', new Date(Date.now() + 10 * 60 * 1000));
  user.set('verification.otpAttempts', 0);
  await user.save();

  await sendOTPEmail(email, user.first_name, newOtp, "verification");

  res.status(200).json({ success: true, message: "New OTP sent to your email" });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const user = await User.findOne({ email })
    .select("+password +loginAttempts +lockUntil +verification.isVerified");

  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  if (user.isLocked()) {
    const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return res.status(423).json({
      success: false,
      message: `Account locked. Try again in ${remaining} minute(s).`,
    });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    user.loginAttempts += 1;
    const lockDuration = User.getLockDuration(user.loginAttempts, 1);
    if (lockDuration > 0) {
      user.lockUntil = new Date(Date.now() + lockDuration);
    }
    await user.save();

    const attemptsLeft = 3 - user.loginAttempts;
    if (attemptsLeft <= 0) {
      return res.status(423).json({
        success: false,
        message: `Account locked due to multiple failures. Try again later.`,
      });
    }
    return res.status(401).json({
      success: false,
      message: `Invalid credentials. ${attemptsLeft} attempt(s) left.`,
    });
  }

  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  if (!user.verification.isVerified) {
    return res.status(403).json({
      success: false,
      message: "Email not verified. Please verify your email first.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Login successful",
    user: { id: user._id, email: user.email, name: `${user.first_name} ${user.last_name}` },
  });
});

export const updateProfile = catchAsync(async (req, res) => {
  const { first_name, last_name, address_list } = req.body;
  const userId = req.user._id;

  const updates = {};
  if (first_name) updates.first_name = first_name;
  if (last_name) updates.last_name = last_name;
  if (address_list) {
    updates.address_list = address_list;
    updates.is_address_list = address_list.length > 0;
  }

  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  }).select("-password -__v");

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user,
  });
});

export const sendPasswordChangeOTP = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId).select("email first_name");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  user.passwordReset = {
    otp,
    otpExpires,
    attempts: 0,
  };
  await user.save();

  await sendOTPEmail(user.email, user.first_name, otp, "password");

  res.status(200).json({ success: true, message: "Password change OTP sent to your email" });
});

export const changePassword = catchAsync(async (req, res) => {
  const { newPassword, otp } = req.body;
  const userId = req.user._id;

  if (!newPassword || !otp) {
    return res.status(400).json({ success: false, message: "New password and OTP are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
  }

  const user = await User.findById(userId)
    .select("+passwordReset.otp +passwordReset.otpExpires +passwordReset.attempts");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!user.passwordReset.otpExpires || user.passwordReset.otpExpires < Date.now()) {
    return res.status(400).json({ success: false, message: "OTP expired. Request a new one." });
  }

  if (user.passwordReset.attempts >= 3) {
    return res.status(400).json({ success: false, message: "Too many failed attempts. Request a new OTP." });
  }

  if (user.passwordReset.otp !== otp) {
    user.passwordReset.attempts += 1;
    await user.save();
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.passwordReset.otp = undefined;
  user.passwordReset.otpExpires = undefined;
  user.passwordReset.attempts = undefined;
  await user.save();

  res.status(200).json({ success: true, message: "Password changed successfully" });
});