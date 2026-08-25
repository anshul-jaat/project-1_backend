import nodemailer from "nodemailer";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config({quite:true}); 


const user = process.env.SMTP_USER 
const pass = process.env.SMTP_PASS 

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn("⚠️ SMTP credentials not found in .env – using hardcoded fallback.");
}


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user, pass },
});

export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

export const sendOTPEmail = async (email, name, otp, purpose = "verification") => {
  try {
    const info = await transporter.sendMail({
      from: `"Shopping Team" <${user}>`,
      to: email,
      subject: purpose === "password" ? "OTP for Password Change" : "Your OTP",
      text: `Hi ${name},\n\nYour OTP is: ${otp}\nIt expires in 10 minutes.\n\nRegards,\nShopping Team`,
    });

    console.log("✅ OTP sent to", email, "(Message ID:", info.messageId, ")");
  } catch (err) {
    console.error("❌ Error sending OTP:", err.message);
    console.log(`📧 [FALLBACK] OTP for ${email}: ${otp}`);
    throw new Error("Failed to send OTP email");
  }
};

export const verify_user_otp = sendOTPEmail;