import multer from "multer";
import path from "path";
import { v2 as cloudinary } from 'cloudinary';
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config({ quiet: true });

cloudinary.config({
  cloud_name: process.env.cloud_name,
  api_key: process.env.api_key,
  api_secret: process.env.api_secret,
});

// ===== Multer config – memory storage =====
const storage = multer.memoryStorage();   // ✅ no disk writes

const fileFilter = (req, file, cb) => {
  console.log("🔍 Received file MIME type:", file.mimetype);
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/bmp', 'image/tiff', 'image/heic',
    'application/octet-stream'
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.heic'];
  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Only images are allowed (received: ${file.mimetype})`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ===== Process image from buffer and upload to Cloudinary =====
export const updateProfileimg = async (buffer) => {   // ✅ accepts buffer instead of path
  try {
    console.log("📤 Processing image with Sharp...");

    // 1. Process with Sharp – resize, compress
    const processedBuffer = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60, mozjpeg: true })
      .toBuffer();

    // 2. Upload processed buffer to Cloudinary
    console.log("📤 Uploading compressed image to Cloudinary...");
    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${processedBuffer.toString('base64')}`,
      {
        folder: 'profile-pics',
        public_id: `profile-${Date.now()}`,
        overwrite: true,
      }
    );

    console.log("✅ Cloudinary upload success:", result.secure_url);
    return result.secure_url;

  } catch (err) {
    console.error("❌ Error in updateProfileimg:", err);
    // Fallback: try to upload without Sharp (still from buffer)
    try {
      console.warn("⚠️ Sharp failed, falling back to original upload...");
      const result = await cloudinary.uploader.upload(
        `data:${buffer.mimetype || 'image/jpeg'};base64,${buffer.toString('base64')}`,
        {
          folder: 'profile-pics',
          public_id: `profile-${Date.now()}`,
          overwrite: true,
        }
      );
      return result.secure_url;
    } catch (fallbackErr) {
      console.error("❌ Fallback upload also failed:", fallbackErr);
      throw new Error("Image upload failed");
    }
  }
};

// ===== Process product image buffer and upload to Cloudinary =====
export const uploadProductImage = async (buffer) => {
  try {
    const processedBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${processedBuffer.toString('base64')}`,
      {
        folder: 'products',
        public_id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        overwrite: true,
      }
    );

    return result.secure_url;
  } catch (err) {
    console.error("❌ Sharp product upload error, trying fallback:", err.message);
    try {
      const result = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${buffer.toString('base64')}`,
        {
          folder: 'products',
          public_id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          overwrite: true,
        }
      );
      return result.secure_url;
    } catch (fallbackErr) {
      console.error("❌ Cloudinary upload failed:", fallbackErr.message);
      throw new Error("Failed to upload product image to Cloudinary");
    }
  }
};

// ===== Delete from Cloudinary =====
export const deleteProfileimg = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log("✅ Deleted from Cloudinary:", publicId);
    return result;
  } catch (err) {
    console.error("❌ Cloudinary delete error:", err);
    throw err;
  }
};

export { upload };