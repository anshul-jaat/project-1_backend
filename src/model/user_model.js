import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    profilePic: { type: String, default: "" },
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["male", "female", "others"], required: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    address_list: [
      {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        isDefault: { type: Boolean, default: false },
      },
    ],
    is_address_list: { type: Boolean, default: false },

    verification: {
      otp: { type: String, select: false },
      otpExpires: { type: Date, select: false },
      otpAttempts: { type: Number, default: 0, select: false },
      isVerified: { type: Boolean, default: false },
      otpLockUntil: { type: Date, default: null, select: false },
      otpFailedAttempts: { type: Number, default: 0, select: false },
      _id: false,
    },

    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },

    passwordReset: {
      otp: { type: String, select: false },
      otpExpires: { type: Date, select: false },
      attempts: { type: Number, default: 0, select: false },
      _id: false,
    },

    is_active: { type: Boolean, default: true },
    is_deleted: { type: Boolean, default: false },
    order_list: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  },
  { timestamps: true }
);

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.isOtpLocked = function () {
  if (!this.verification) return false;
  return this.verification.otpLockUntil && this.verification.otpLockUntil > Date.now();
};


userSchema.statics.getLockDuration = function (attempts, baseMinutes = 1) {
  if (attempts < 3) return 0;
  const base = baseMinutes * 60 * 1000;
  const factor = Math.pow(2, attempts - 3); // 1,2,4,8...
  return Math.min(base * factor, 24 * 60 * 60 * 1000);
};

userSchema.statics.getOtpLockDuration = function (lockCount, baseMinutes = 5) {
  if (lockCount < 1) return 0;
  const base = baseMinutes * 60 * 1000;
  const factor = Math.pow(2, lockCount - 1); 
  return Math.min(base * factor, 24 * 60 * 60 * 1000);
};

export default mongoose.model("User", userSchema);