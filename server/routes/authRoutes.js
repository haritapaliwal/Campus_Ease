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
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ id: user._id, role: user.role, token });
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
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ role: user.role, shopId: user.shopId, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Logout
router.post("/logout", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("token", {
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax"
  });
  res.status(200).json({ message: "Logged out successfully" });
});

// Third-party cookie check endpoints
router.post("/cookie-test-set", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("cookie_test", "active", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 5 * 60 * 1000 // 5 minutes
  });
  res.json({ success: true, message: "Cookie test initialized" });
});

router.post("/cookie-test-verify", (req, res) => {
  if (req.cookies?.cookie_test === "active") {
    res.json({ allowed: true });
  } else {
    res.json({ allowed: false });
  }
});

export default router;
