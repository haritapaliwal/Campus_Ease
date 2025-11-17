import express from "express";
import Shop from "../models/Shop.js";
import Order from "../models/Order.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all shops with menus
router.get("/shops", async (req, res) => {
  const shops = await Shop.find();
  res.json(shops);
});

// Place new order
router.post("/order", authMiddleware, async (req, res) => {
  const { items, orderType } = req.body;
  try {
    const order = await Order.create({
      userId: req.user,
      items,
      orderType,
    });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all user orders
router.get("/orders", authMiddleware, async (req, res) => {
  const orders = await Order.find({ userId: req.user });
  res.json(orders);
});

// Alias to match client expectation
router.get("/my-orders", authMiddleware, async (req, res) => {
  const orders = await Order.find({ userId: req.user });
  res.json(orders);
});

// Update an order (e.g., status)
router.put("/orders/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, deliveredAt } = req.body;
  try {
    const updated = await Order.findOneAndUpdate(
      { _id: id, userId: req.user },
      { ...(status ? { status } : {}), ...(deliveredAt ? { deliveredAt } : {}) },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Cancel an order
router.delete("/orders/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await Order.findOneAndUpdate(
      { _id: id, userId: req.user },
      { status: "cancelled" },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
