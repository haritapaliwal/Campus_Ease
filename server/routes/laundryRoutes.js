import express from "express";
import LaundryBooking from "../models/LaundryBooking.js";
import Shop from "../models/Shop.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all laundry shops
router.get("/shops", async (req, res) => {
  const shops = await Shop.find({ type: "laundry" }); // add `type` field to Shop schema if needed
  res.json(shops);
});

// Book laundry slot
router.post("/book", authMiddleware, async (req, res) => {
  const { shopId, items, pickupDate, pickupTime, deliveryOption, serviceType } = req.body;
  try {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one laundry item is required" });
    }

    const shop = shopId
      ? await Shop.findById(shopId)
      : await Shop.findOne({ type: "laundry" });

    if (!shop) {
      return res.status(404).json({ message: "Laundry shop not found" });
    }

    const catalogMap = new Map();
    ["laundry", "dryclean", "iron"].forEach((cat) => {
      (shop.laundryCatalog?.[cat] || []).forEach((entry) => {
        catalogMap.set(String(entry._id), { ...entry.toObject(), category: cat });
      });
    });

    let totalAmount = 0;
    const normalizedItems = [];

    items.forEach((line) => {
      const entry = catalogMap.get(String(line.itemId));
      const qty = Number(line.quantity) || 0;
      if (!entry || qty <= 0) return;
      normalizedItems.push({
        itemId: entry._id,
        name: entry.name,
        category: entry.category,
        quantity: qty,
        price: entry.price,
      });
      totalAmount += entry.price * qty;
    });

    if (normalizedItems.length === 0) {
      return res.status(400).json({ message: "Valid laundry items are required" });
    }

    if (deliveryOption === "express") {
      totalAmount += 25;
    }

    const booking = await LaundryBooking.create({
      userId: req.user,
      shopId: shop._id,
      items: normalizedItems,
      pickupDate: pickupDate || undefined,
      pickupTime: pickupTime || undefined,
      deliveryOption: deliveryOption || "standard",
      serviceType: serviceType || normalizedItems[0].category || "laundry",
      totalAmount,
    });
    
    // Populate user info if needed
    const populatedBooking = await LaundryBooking.findById(booking._id).populate("userId", "name email");
    res.json(populatedBooking || booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get user's laundry bookings (last 24 hours only for customer "My Bookings" view)
router.get("/my-bookings", authMiddleware, async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const bookings = await LaundryBooking.find({
    userId: req.user,
    createdAt: { $gte: since },
  }).populate("shopId");
  res.json(bookings);
});

// Update a laundry booking (slot/status)
router.put("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { slot, status } = req.body;
  try {
    const updated = await LaundryBooking.findOneAndUpdate(
      { _id: id, userId: req.user },
      { ...(slot ? { slot } : {}), ...(status ? { status } : {}) },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Booking not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Cancel a laundry booking
router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await LaundryBooking.findOneAndUpdate(
      { _id: id, userId: req.user },
      { status: "cancelled" },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Booking not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
