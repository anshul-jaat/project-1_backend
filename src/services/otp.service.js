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
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OTP Verification</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f4f7fc;
            }
            .container {
              max-width: 500px;
              margin: 30px auto;
              background-color: #ffffff;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.08);
              overflow: hidden;
              padding: 30px 25px 40px;
              border: 1px solid #e9edf4;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #f0f4fa;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .header h1 {
              font-size: 24px;
              color: #1a2b4a;
              margin: 0;
              font-weight: 700;
              letter-spacing: -0.5px;
            }
            .header h1 span {
              color: #3b82f6;
            }
            .otp-box {
              background: #f8fafc;
              border: 2px dashed #dbe0e8;
              border-radius: 12px;
              padding: 25px 15px;
              text-align: center;
              margin: 20px 0 25px;
            }
            .otp-code {
              font-size: 42px;
              font-weight: 800;
              letter-spacing: 12px;
              color: #0b1e33;
              font-family: 'Courier New', monospace;
              background: #ffffff;
              padding: 12px 20px;
              border-radius: 8px;
              display: inline-block;
              box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }
            .greeting {
              font-size: 18px;
              color: #1f2a44;
              margin-top: 0;
              font-weight: 600;
            }
            .message {
              color: #3d4f6a;
              font-size: 15px;
              line-height: 1.6;
              margin: 15px 0;
            }
            .expiry-note {
              background: #eef3f9;
              padding: 10px 16px;
              border-radius: 8px;
              font-size: 14px;
              color: #2c3e5c;
              display: inline-block;
              margin: 10px 0 5px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 13px;
              color: #6f7d98;
              border-top: 1px solid #e9edf4;
              padding-top: 20px;
            }
            .footer a {
              color: #3b82f6;
              text-decoration: none;
            }
            .security-note {
              background: #fff5e6;
              border-left: 4px solid #f59e0b;
              padding: 12px 16px;
              border-radius: 6px;
              font-size: 14px;
              color: #5a4b3a;
              margin: 20px 0 10px;
            }
            @media (max-width: 480px) {
              .container { padding: 20px 15px; }
              .otp-code { font-size: 32px; letter-spacing: 8px; padding: 10px 12px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛍️ <span>Shopping</span> Team</h1>
            </div>
            <p class="greeting">Hello ${name},</p>
            <p class="message">
              We received a request to verify your email address. Use the OTP below to complete the verification.
            </p>
            <div class="otp-box">
              <div style="font-size: 14px; color: #5b6f8a; margin-bottom: 8px;">Your One-Time Password</div>
              <div class="otp-code">${otp}</div>
            </div>
            <div style="text-align: center;">
              <span class="expiry-note">⏱️ This OTP is valid for 10 minutes</span>
            </div>
            <div class="security-note">
              🔒 <strong>Never share this OTP</strong> with anyone. Our team will never ask for your OTP.
            </div>
            <div class="footer">
              <p>
                If you didn’t request this, please ignore this email.<br>
                &copy; 2025 Shopping Team. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("✅ OTP sent to", email, "(Message ID:", info.messageId, ")");
  } catch (err) {
    console.error("⚠️ Error sending OTP email via SMTP:", err.message);
    console.log(`\n======================================================`);
    console.log(`📧 [FALLBACK OTP] Email: ${email} | Code: ${otp}`);
    console.log(`======================================================\n`);
    // Do not throw so user can still register & test with console OTP
    return { success: false, fallbackOtp: otp, error: err.message };
  }
}

 

export const verify_user_otp = sendOTPEmail;