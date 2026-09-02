import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import userRoutes from "./routes/routes.js";
import productRoutes from "./routes/product_routes.js";
import cartRoutes from "./routes/cart_routes.js";
import orderRoutes from "./routes/order_routes.js";
import adminRoutes from "./routes/admin_routes.js";
import { errorHandler } from "./middleware/errorhandling.js";

dotenv.config();

const app = express();

// Enable CORS for all environments (Vercel preview & production domains, localhost)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.endsWith(".vercel.app") ||
        process.env.FRONTEND_URL === origin
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection caching for serverless environments (Vercel)
let isConnected = false;
export const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState >= 1) {
    return;
  }
  const MONGO_URI = process.env.URLDB || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    throw new Error("MongoDB URI is not defined in environment variables (URLDB)");
  }
  await mongoose.connect(MONGO_URI);
  isConnected = true;
  console.log("✅ MongoDB connected successfully");
};

// Ensure DB connection on every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    res.status(500).json({ success: false, message: "Database connection failed. Please verify URLDB env variable." });
  }
});

// Health Check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "✨ E-Commerce API is running smoothly on Vercel!",
    status: "Healthy",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "✨ E-Commerce API is active!",
    version: "1.0.0",
  });
});

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start standalone HTTP server when not in serverless runtime
if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error("❌ MongoDB startup connection error:", err);
    });
}

export default app;