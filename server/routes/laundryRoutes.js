import express from "express";
import LaundryBooking from "../models/LaundryBooking.js";
import Shop from "../models/Shop.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Example static slots
const laundrySlots = ["9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM", "5:00 PM"];

// Get all laundry shops
router.get("/shops", async (req, res) => {
  const shops = await Shop.find({ type: "laundry" }); // add `type` field to Shop schema if needed
  res.json(shops);
});

// Book laundry slot
router.post("/book", authMiddleware, async (req, res) => {
  const { shopId, slot, items, pickupDate, pickupTime, deliveryOption, serviceType } = req.body;
  try {
    // Support both old format (slot only) and new format (items-based order)
    if (!slot && !items) {
      return res.status(400).json({ message: "Slot or items are required" });
    }

    // Calculate total amount if items are provided
    let totalAmount = 0;
    if (items) {
      // Laundry (Wash & Fold) pricing
      if (items.washFold) {
        const prices = { tshirt: 20, pant: 30, shirt: 40, jacket: 50 };
        Object.entries(items.washFold).forEach(([item, qty]) => {
          totalAmount += (prices[item] || 0) * (qty || 0);
        });
      }
      // Dry Clean pricing
      if (items.dryClean) {
        const prices = { suit: 150, blazer: 120, dress: 100, coat: 180 };
        Object.entries(items.dryClean).forEach(([item, qty]) => {
          totalAmount += (prices[item] || 0) * (qty || 0);
        });
      }
      // Ironing pricing
      if (items.ironing) {
        const prices = { shirt: 15, pant: 20, kurta: 25, saree: 30 };
        Object.entries(items.ironing).forEach(([item, qty]) => {
          totalAmount += (prices[item] || 0) * (qty || 0);
        });
      }
      if (deliveryOption === "express") {
        totalAmount += 25;
      }
    }

    // For backward compatibility, check slot uniqueness if slot is provided
    if (slot) {
      const query = shopId ? { shopId, slot } : { slot };
      const existing = await LaundryBooking.findOne(query);
      if (existing) return res.status(400).json({ message: "Slot already booked" });
    }

    const booking = await LaundryBooking.create({
      userId: req.user,
      shopId: shopId || undefined,
      slot: slot || `${pickupDate} ${pickupTime}`,
      items: items || undefined,
      pickupDate: pickupDate || undefined,
      pickupTime: pickupTime || undefined,
      deliveryOption: deliveryOption || "standard",
      serviceType: serviceType || "laundry",
      totalAmount,
    });
    
    // Populate user info if needed
    const populatedBooking = await LaundryBooking.findById(booking._id).populate("userId", "name email");
    res.json(populatedBooking || booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get user's laundry bookings
router.get("/my-bookings", authMiddleware, async (req, res) => {
  const bookings = await LaundryBooking.find({ userId: req.user }).populate("shopId");
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
