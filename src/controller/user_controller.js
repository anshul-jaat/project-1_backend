import bcrypt from "bcrypt";
import User from "../model/user_model.js";
import { generateOTP, sendOTPEmail } from "../services/otp.service.js";
import { catchAsync } from "../middleware/errorhandling.js";
import jwt from "jsonwebtoken";
import { updateProfileimg, deleteProfileimg } from "../middleware/upload.js";

// ======================= REGISTER (sends OTP automatically) =======================
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
  
  // Generate OTP
  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  const user = new User({
    first_name,
    last_name,
    gender,
    email,
    password: hashedPassword,
    address_list: address_list || [],
    is_address_list: !!(address_list && address_list.length),
    verification: {
      otp,
      otpExpires,
      otpAttempts: 0,
      isVerified: false,
      otpLockUntil: null,
      otpFailedAttempts: 0,
    },
  });

  await user.save();

  // Send OTP email
  await sendOTPEmail(email, user.first_name, otp, "verification");

  res.status(201).json({
    success: true,
    message: "User registered. OTP sent to your email.",
    data: { userId: user._id, email: user.email },
  });
});

// ======================= VERIFY OTP (only verifies, does NOT send) =======================
export const verifyOTP = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP are required" });
  }

  const user = await User.findOne({ email })
    .select("+verification.otp +verification.otpAttempts +verification.otpExpires +verification.otpLockUntil +verification.otpFailedAttempts");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Check if already verified
  if (user.verification.isVerified) {
    return res.status(400).json({ success: false, message: "User already verified" });
  }

  // Check OTP lock
  if (user.isOtpLocked()) {
    const remaining = Math.ceil((user.verification.otpLockUntil - Date.now()) / 60000);
    return res.status(423).json({
      success: false,
      message: `OTP verification locked. Try again in ${remaining} minute(s).`,
    });
  }

  // Check if OTP exists
  if (!user.verification.otp) {
    return res.status(400).json({ success: false, message: "No OTP has been sent. Please register again." });
  }

  // Check OTP expiry
  if (user.verification.otpExpires < Date.now()) {
    return res.status(400).json({ success: false, message: "OTP expired. Please register again to get a new OTP." });
  }

  // Check attempts
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
      attemptsRemaining: 0,
    });
  }

  // Verify OTP
  if (user.verification.otp !== otp) {
    user.set('verification.otpAttempts', user.verification.otpAttempts + 1);
    const newAttempts = user.verification.otpAttempts;
    const attemptsLeft = 3 - newAttempts;

    if (newAttempts >= 3) {
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
        attemptsRemaining: 0,
      });
    }

    await user.save();
    return res.status(400).json({
      success: false,
      message: `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`,
      attemptsRemaining: attemptsLeft,
    });
  }

  // OTP correct – mark verified
  user.set('verification.isVerified', true);
  user.set('verification.otp', undefined);
  user.set('verification.otpExpires', undefined);
  user.set('verification.otpAttempts', undefined);
  user.set('verification.otpLockUntil', undefined);
  user.set('verification.otpFailedAttempts', undefined);
  await user.save();

  // (Optional) Generate token after verification
  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.status(200).json({
    success: true,
    message: "Email verified successfully. Your account is now active.",
    token,
    user: {
      id: user._id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role || "user",
      profilePic: user.profilePic,
    },
  });
});

// ======================= COMBINED OTP (send + verify) – kept for backward compatibility =======================
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
        attemptsRemaining: 0,
      });
    }

    if (user.verification.otp !== otp) {
      user.set('verification.otpAttempts', user.verification.otpAttempts + 1);
      const newAttempts = user.verification.otpAttempts;
      const attemptsLeft = 3 - newAttempts;

      if (newAttempts >= 3) {
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
          attemptsRemaining: 0,
        });
      }

      await user.save();
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`,
        attemptsRemaining: attemptsLeft,
      });
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

// ======================= RESEND OTP =======================
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

// ======================= LOGIN =======================
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

  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user._id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role || "user",
      profilePic: user.profilePic,
    },
  });
});

// ======================= GET CURRENT PROFILE =======================
export const getProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password -__v");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// ======================= UPDATE PROFILE =======================
export const updateProfile = catchAsync(async (req, res) => {
  console.log("🔥 updateProfile controller hit!");
  console.log("🔍 req.file:", req.file);
  console.log("🔍 req.body:", req.body);

  const { first_name, last_name, address_list } = req.body || {};
  const userId = req.user._id;

  const updates = {};

  if (first_name) updates.first_name = first_name;
  if (last_name) updates.last_name = last_name;

  if (address_list) {
    let parsed = address_list;
    if (typeof address_list === 'string') {
      try { parsed = JSON.parse(address_list); } catch (e) {}
    }
    updates.address_list = parsed;
    updates.is_address_list = parsed.length > 0;
  }

  // ---------- Profile picture ----------
  let deletionStatus = null;

  if (req.file) {
    // 1. Get current user's profile picture
    const currentUser = await User.findById(userId).select("profilePic");
    let oldPic = currentUser.profilePic;

    // 2. If oldPic is an object (old format), extract the URL or public_id
    let oldPicUrl = null;
    let oldPublicId = null;

    if (oldPic) {
      // If it's an object (from earlier Cloudinary response)
      if (typeof oldPic === 'object' && oldPic.secure_url) {
        oldPicUrl = oldPic.secure_url;
        oldPublicId = oldPic.public_id;
      }
      // If it's a string (new format)
      else if (typeof oldPic === 'string') {
        oldPicUrl = oldPic;
        if (oldPic.includes("cloudinary.com")) {
          // Extract public_id with folder
          const uploadIndex = oldPic.indexOf('/upload/');
          if (uploadIndex !== -1) {
            let publicIdWithExt = oldPic.substring(uploadIndex + 8);
            // Remove version prefix
            if (publicIdWithExt.startsWith('v')) {
              const versionEnd = publicIdWithExt.indexOf('/');
              if (versionEnd !== -1) {
                publicIdWithExt = publicIdWithExt.substring(versionEnd + 1);
              }
            }
            // Remove extension
            const extIndex = publicIdWithExt.lastIndexOf('.');
            oldPublicId = extIndex !== -1 ? publicIdWithExt.substring(0, extIndex) : publicIdWithExt;
            console.log("✅ Extracted public_id:", oldPublicId);
          }
        }
      }
    }

    // 3. Delete old image if we have a public_id
    if (oldPublicId) {
      try {
        console.log("🗑️ Deleting old profile pic with public_id:", oldPublicId);
        const result = await deleteProfileimg(oldPublicId);
        deletionStatus = result.result; // "ok" or "not found"
        console.log("✅ Deletion result:", deletionStatus);
      } catch (err) {
        console.warn("⚠️ Failed to delete old profile pic:", err.message);
        deletionStatus = `failed: ${err.message}`;
      }
    } else {
      deletionStatus = "no old image to delete";
    }

    // 4. Upload new image from buffer
    try {
      console.log("📤 Calling updateProfileimg with buffer...");
      const imageUrl = await updateProfileimg(req.file.buffer);
      console.log("✅ Cloudinary returned URL:", imageUrl);
      updates.profilePic = imageUrl;
    } catch (err) {
      console.error("❌ Cloudinary upload error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to upload profile picture",
        error: err.message,
      });
    }
  } else if (req.body.profilePic && typeof req.body.profilePic === 'string') {
    updates.profilePic = req.body.profilePic;
    deletionStatus = "no file uploaded, URL provided";
  }

  // Update user
  const user = await User.findByIdAndUpdate(userId, updates, {
    returnDocument: 'after',
    runValidators: true,
  }).select("-password -__v");

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    deletionStatus,
    user,
  });
});

// ======================= SEND PASSWORD CHANGE / FORGOT OTP =======================
export const sendPasswordChangeOTP = catchAsync(async (req, res) => {
  const email = req.user?.email || req.body?.email;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required to send password reset OTP" });
  }

  const user = await User.findOne({ email }).select("email first_name");

  if (!user) {
    return res.status(404).json({ success: false, message: "No account found with this email" });
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

  res.status(200).json({ success: true, message: "Password reset OTP sent to your email" });
});

// ======================= CHANGE / RESET PASSWORD =======================
export const changePassword = catchAsync(async (req, res) => {
  const { newPassword, otp, email: bodyEmail } = req.body;
  const email = req.user?.email || bodyEmail;

  if (!newPassword || !otp) {
    return res.status(400).json({ success: false, message: "New password and OTP are required" });
  }
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
  }

  const user = await User.findOne({ email })
    .select("+passwordReset.otp +passwordReset.otpExpires +passwordReset.attempts");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!user.passwordReset?.otpExpires || user.passwordReset.otpExpires < Date.now()) {
    return res.status(400).json({ success: false, message: "OTP expired or invalid. Please request a new one." });
  }

  if (user.passwordReset.attempts >= 3) {
    return res.status(400).json({ success: false, message: "Too many failed attempts. Please request a new OTP." });
  }

  if (user.passwordReset.otp !== otp) {
    user.passwordReset.attempts += 1;
    await user.save();
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.passwordReset = undefined;
  await user.save();

  res.status(200).json({ success: true, message: "Password reset successfully. You can now log in." });
});