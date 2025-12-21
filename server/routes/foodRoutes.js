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

// Place new order (split by shop so each shop gets its own order)
router.post("/order", authMiddleware, async (req, res) => {
  const { items, orderType } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "No items provided" });
  }
  try {
    const grouped = items.reduce((acc, item) => {
      const shopName = item.shop || "Unknown Shop";
      acc[shopName] = acc[shopName] || [];
      acc[shopName].push(item);
      return acc;
    }, {});

    const createdOrders = [];
    for (const [shopName, shopItems] of Object.entries(grouped)) {
      const normalizedItems = shopItems.map((it) => ({
        item: it.item,
        price: Number(it.price) || 0,
        shop: shopName,
      }));
      const order = await Order.create({
        userId: req.user,
        items: normalizedItems,
        orderType,
      });
      createdOrders.push(order);
    }

    res.json(createdOrders);
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
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orders = await Order.find({
    userId: req.user,
    createdAt: { $gte: since },
  });
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
