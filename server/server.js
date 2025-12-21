import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import foodRoutes from "./routes/foodRoutes.js";
import barberRoutes from "./routes/barberRoutes.js";
import laundryRoutes from "./routes/laundryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();
const app = express();

// CORS configuration: allow the deployed frontend and local dev origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// DB connection
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/barber", barberRoutes);
app.use("/api/laundry", laundryRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
