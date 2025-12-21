import express from "express";
import Shop from "../models/Shop.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import BarberBooking from "../models/BarberBooking.js";
import LaundryBooking from "../models/LaundryBooking.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
const laundryCategories = ["laundry", "dryclean", "iron"];

// Middleware to ensure the user is an owner and owns the shop
async function ownerGuard(req, res, next) {
  try {
    const userId = req.user;
    const shopId = req.params.shopId || req.body.shopId;
    if (!shopId) return res.status(400).json({ message: "shopId required" });
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (!shop.ownerId || String(shop.ownerId) !== String(userId)) {
      return res.status(403).json({ message: "Not authorized for this shop" });
    }
    req.shop = shop;
    next();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

// Get my shop info
router.get("/my-shop", authMiddleware, async (req, res) => {
  let shop = await Shop.findOne({ ownerId: req.user });
  if (!shop) {
    // Fallback: use user's shopId if linked
    const user = await User.findById(req.user);
    if (user?.shopId) {
      shop = await Shop.findById(user.shopId);
    }
  }
  res.json(shop);
});

// Get a specific shop by id (owner only)
router.get("/shops/:shopId", authMiddleware, ownerGuard, async (req, res) => {
  res.json(req.shop);
});

// Add menu item (canteen)
router.post("/shops/:shopId/menu", authMiddleware, ownerGuard, async (req, res) => {
  const { item, price } = req.body;
  if (!item || price == null) return res.status(400).json({ message: "item and price are required" });
  req.shop.menu = req.shop.menu || [];
  req.shop.menu.push({ item, price });
  await req.shop.save();
  res.json(req.shop);
});

// Add time slot (barber/laundry)
router.post("/shops/:shopId/slots", authMiddleware, ownerGuard, async (req, res) => {
  const { slot } = req.body;
  if (!slot) return res.status(400).json({ message: "slot is required" });
  req.shop.slots = req.shop.slots || [];
  // Check if slot already exists
  const exists = req.shop.slots.find(s => s.time === slot);
  if (!exists) {
    req.shop.slots.push({ time: slot, isBookable: true });
  }
  await req.shop.save();
  res.json(req.shop);
});

// Manage laundry catalog items
router.post("/shops/:shopId/laundry/catalog", authMiddleware, ownerGuard, async (req, res) => {
  const { category, name, price } = req.body;
  if (!laundryCategories.includes(category)) {
    return res.status(400).json({ message: "Invalid laundry category" });
  }
  if (!name || price == null) {
    return res.status(400).json({ message: "name and price are required" });
  }
  req.shop.laundryCatalog = req.shop.laundryCatalog || { laundry: [], dryclean: [], iron: [] };
  req.shop.laundryCatalog[category].push({ name, price: Number(price) });
  await req.shop.save();
  res.json(req.shop.laundryCatalog);
});

router.put("/shops/:shopId/laundry/catalog/:itemId", authMiddleware, ownerGuard, async (req, res) => {
  const { itemId } = req.params;
  const { name, price } = req.body;
  if (!name && price == null) {
    return res.status(400).json({ message: "Nothing to update" });
  }
  req.shop.laundryCatalog = req.shop.laundryCatalog || { laundry: [], dryclean: [], iron: [] };
  let updated = null;
  laundryCategories.forEach((cat) => {
    const list = req.shop.laundryCatalog[cat] || [];
    const idx = list.findIndex((item) => String(item._id) === itemId);
    if (idx !== -1) {
      if (name) list[idx].name = name;
      if (price != null) list[idx].price = Number(price);
      updated = list[idx];
    }
  });
  if (!updated) {
    return res.status(404).json({ message: "Laundry item not found" });
  }
  await req.shop.save();
  res.json(updated);
});

router.delete("/shops/:shopId/laundry/catalog/:itemId", authMiddleware, ownerGuard, async (req, res) => {
  const { itemId } = req.params;
  req.shop.laundryCatalog = req.shop.laundryCatalog || { laundry: [], dryclean: [], iron: [] };
  let removed = false;
  laundryCategories.forEach((cat) => {
    const list = req.shop.laundryCatalog[cat] || [];
    const newList = list.filter((item) => String(item._id) !== itemId);
    if (newList.length !== list.length) {
      req.shop.laundryCatalog[cat] = newList;
      removed = true;
    }
  });
  if (!removed) {
    return res.status(404).json({ message: "Laundry item not found" });
  }
  await req.shop.save();
  res.json({ success: true });
});

// Toggle slot status (bookable/not bookable)
router.put("/shops/:shopId/slots/:slotTime", authMiddleware, ownerGuard, async (req, res) => {
  let { slotTime } = req.params;
  slotTime = decodeURIComponent(slotTime); // Decode URL-encoded slot time
  const { isBookable } = req.body;
  req.shop.slots = req.shop.slots || [];
  // Handle both old format (string) and new format (object)
  let slot = req.shop.slots.find(s => {
    const time = typeof s === 'string' ? s : s.time;
    return time === slotTime;
  });
  
  if (!slot) {
    // If slot doesn't exist, create it as not bookable if toggling off
    req.shop.slots.push({ time: slotTime, isBookable: isBookable !== undefined ? isBookable : false });
    slot = req.shop.slots[req.shop.slots.length - 1];
  } else {
    // Convert old format to new format if needed
    if (typeof slot === 'string') {
      const index = req.shop.slots.indexOf(slot);
      req.shop.slots[index] = { time: slot, isBookable: true };
      slot = req.shop.slots[index];
    }
    slot.isBookable = isBookable !== undefined ? isBookable : !slot.isBookable;
  }
  
  await req.shop.save();
  res.json(req.shop);
});

// View bookings for my shop
router.get("/shops/:shopId/bookings", authMiddleware, ownerGuard, async (req, res) => {
  // Show only recent (last ~24 hours) bookings/orders for each shop
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (req.shop.type === "canteen") {
    // Show orders that contain items from this shop by shop name
    const orders = await Order.find({
      "items.shop": req.shop.name,
      status: { $ne: "cancelled" },
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .populate("userId", "studentId email");
    return res.json(orders);
  }
  if (req.shop.type === "barber") {
    const bookings = await BarberBooking.find({
      status: { $ne: "cancelled" },
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .populate("userId", "studentId email");
    return res.json(bookings);
  }
  if (req.shop.type === "laundry") {
    const bookings = await LaundryBooking.find({
      shopId: req.shop._id,
      status: { $ne: "cancelled" },
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .populate("userId", "studentId email");
    return res.json(bookings);
  }
  res.json([]);
});

// Update FOOD order status (accepted | rejected | prepared | completed)
router.put("/shops/:shopId/orders/:orderId", authMiddleware, ownerGuard, async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "status required" });
  // Ensure the order belongs to this shop by at least one item
  const order = await Order.findOne({ _id: orderId, "items.shop": req.shop.name });
  if (!order) return res.status(404).json({ message: "Order not found for this shop" });
  order.status = status;
  if (status === "completed") order.deliveredAt = new Date();
  await order.save();
  res.json(order);
});

// Update BARBER booking status (accepted | rejected | completed)
router.put("/shops/:shopId/barber/:id", authMiddleware, ownerGuard, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "status required" });
  const booking = await BarberBooking.findById(id);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  booking.status = status;
  if (status === "completed") booking.deliveredAt = new Date();
  await booking.save();
  res.json(booking);
});

// Update LAUNDRY booking status (accepted | rejected | completed)
router.put("/shops/:shopId/laundry/:id", authMiddleware, ownerGuard, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "status required" });
  const booking = await LaundryBooking.findOne({ _id: id, shopId: req.shop._id });
  if (!booking) return res.status(404).json({ message: "Booking not found for this shop" });
  booking.status = status;
  if (status === "completed") booking.deliveredAt = new Date();
  await booking.save();
  res.json(booking);
});

export default router;


