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

// Enable CORS for frontend
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/", (req, res) => {
  res.json({ success: true, message: "✨ E-Commerce API is running smoothly!" });
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
const MONGO_URI = process.env.URLDB || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ MongoDB URI is not defined in .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });