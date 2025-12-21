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
    const user = await User.create({ studentId, email, passwordHash: hashed, role: "student" });
    res.json({ id: user._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    // Fixed owner accounts (no signup)
    // Fixed owner credentials (meet strong password policy: >=8, upper, lower, number, special)
    const owners = [
      { email: "ccd@shop.com", password: "Ccd@1234", shopName: "CCD", shopType: "canteen" },
      { email: "amul@shop.com", password: "Amul@1234", shopName: "Amul", shopType: "canteen" },
      { email: "vinayak@shop.com", password: "Vinayak@123", shopName: "Vinayak", shopType: "canteen" },
      { email: "barber@shop.com", password: "Barber@123", shopName: "Campus Barber", shopType: "barber" },
      { email: "laundry@shop.com", password: "Laundry@123", shopName: "Campus Laundry", shopType: "laundry" }
    ];

    const fixed = owners.find(o => o.email.toLowerCase() === String(email).toLowerCase());
    if (fixed) {
      if (password !== fixed.password) return res.status(400).json({ message: "Invalid credentials" });
      // Upsert user and shop for this owner
      let shop = await Shop.findOne({ name: fixed.shopName, type: fixed.shopType });
      let user = await User.findOne({ email: fixed.email });
      if (!user) {
        user = await User.create({ email: fixed.email, passwordHash: await bcrypt.hash(fixed.password, 10), role: "owner" });
      }
      if (!shop) {
        shop = await Shop.create({ name: fixed.shopName, type: fixed.shopType, ownerId: user._id, menu: [], slots: [] });
      }
      // Force link user <-> shop to ensure admin portal works even if previous data is inconsistent
      if (String(shop.ownerId || "") !== String(user._id)) {
        shop.ownerId = user._id;
        await shop.save();
      }
      if (String(user.shopId || "") !== String(shop._id)) {
        user.shopId = shop._id;
        await user.save();
      }

      const token = jwt.sign({ id: user._id, role: "owner", shopId: shop._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, role: "owner", shopId: shop._id });
    }

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
