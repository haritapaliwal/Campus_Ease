import express from "express";
import BarberBooking from "../models/BarberBooking.js";
import Shop from "../models/Shop.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Example static slots fallback (owners can add dynamic ones in Shop.slots)
const slots = ["10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"];

router.get("/slots", async (req, res) => {
  const booked = await BarberBooking.find();
  const bookedSlots = booked.map(b => b.slot);
  // gather dynamic slots from all barber shops
  const shops = await Shop.find({ type: "barber" });
  // Extract bookable slots from shops (new format has {time, isBookable})
  const dynamic = shops.flatMap(s => {
    if (!s.slots) return [];
    return s.slots
      .filter(slot => {
        // Handle both old format (string) and new format (object)
        if (typeof slot === 'string') return true; // Legacy support
        return slot.isBookable !== false; // Only return bookable slots
      })
      .map(slot => typeof slot === 'string' ? slot : slot.time);
  });
  const combined = Array.from(new Set([ ...dynamic, ...slots ]));
  const available = combined.filter(s => !bookedSlots.includes(s));
  res.json(available);
});

// List barber shops (for client display if needed)
router.get("/shops", async (req, res) => {
  const shops = await Shop.find({ type: "barber" });
  res.json(shops);
});

// Book a slot
router.post("/book", authMiddleware, async (req, res) => {
  const { slot } = req.body;
  try {
    const existing = await BarberBooking.findOne({ slot });
    if (existing) return res.status(400).json({ message: "Slot already booked" });

    const booking = await BarberBooking.create({ userId: req.user, slot });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get user's barber bookings
router.get("/my-bookings", authMiddleware, async (req, res) => {
  const bookings = await BarberBooking.find({ userId: req.user });
  res.json(bookings);
});

// Update a booking's slot or status
router.put("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { slot, status } = req.body;
  try {
    const updated = await BarberBooking.findOneAndUpdate(
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

// Cancel a booking
router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await BarberBooking.findOneAndUpdate(
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
