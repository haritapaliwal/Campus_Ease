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
    
    // Create token for immediate login after signup
    const token = jwt.sign({ id: user._id, role: user.role, shopId: null }, process.env.JWT_SECRET, { expiresIn: "7d" });
    
    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ id: user._id, role: user.role });
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
    
    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ role: user.role, shopId: user.shopId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    secure: true,
    sameSite: "none"
  });
  res.status(200).json({ message: "Logged out successfully" });
});

export default router;
