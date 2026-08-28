import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from 'cloudinary';
import dotenv from "dotenv";
import sharp from "sharp";
import fs from "fs";

dotenv.config({ quiet: true });

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.cloud_name,
  api_key: process.env.api_key,
  api_secret: process.env.api_secret,
});

// ===== Multer config (disk storage) =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads/profile-pics"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "profile-" + uniqueSuffix + ext);
  },
});

// File filter – accepts images
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

// ===== Process image with Sharp and upload to Cloudinary =====
export const updateProfileimg = async (filePath) => {
  try {
    console.log("📤 Processing image with Sharp...");

    // 1. Read the file buffer
    const imageBuffer = fs.readFileSync(filePath);

    // 2. Process with Sharp – resize, compress, and limit size
    const processedBuffer = await sharp(imageBuffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true }) // max 800x800
      .jpeg({ quality: 60, mozjpeg: true }) // adjust quality to control size
      .toBuffer();

    // 3. Upload processed buffer to Cloudinary
    console.log("📤 Uploading compressed image to Cloudinary...");
    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${processedBuffer.toString('base64')}`,
      {
        folder: 'profile-pics',
        public_id: `profile-${Date.now()}`,
        overwrite: true,
      }
    );

    // 4. Delete the local file after upload (optional)
    fs.unlinkSync(filePath);

    console.log("✅ Cloudinary upload success:", result.secure_url);
    return result.secure_url; // return the secure URL string

  } catch (err) {
    console.error("❌ Error in updateProfileimg:", err);
    // If Sharp fails, fallback to original upload (without compression)
    try {
      console.warn("⚠️ Sharp failed, falling back to original upload...");
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'profile-pics',
        public_id: `profile-${Date.now()}`,
        overwrite: true,
      });
      fs.unlinkSync(filePath);
      return result.secure_url;
    } catch (fallbackErr) {
      console.error("❌ Fallback upload also failed:", fallbackErr);
      throw new Error("Image upload failed");
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

// Export multer upload middleware
export { upload };