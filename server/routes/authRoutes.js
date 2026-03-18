import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Shop from "../models/Shop.js";

const router = express.Router();

// Signup (student or owner)
router.post("/signup", async (req, res) => {
  const { studentId, email, password } = req.body; // owners cannot sign up from UI
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ studentId, email, passwordHash: hashed, role: "customer" });
    res.json({ id: user._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {


    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role, shopId: user.shopId || null }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, role: user.role, shopId: user.shopId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
