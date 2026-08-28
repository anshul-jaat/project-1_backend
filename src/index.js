import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRoutes from "./routes/routes.js";
import { errorHandler } from "./middleware/errorhandling.js";

dotenv.config();

const app = express();
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);

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