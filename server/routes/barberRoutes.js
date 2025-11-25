import express from "express";
import BarberBooking from "../models/BarberBooking.js";
import Shop from "../models/Shop.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Example static slots fallback (owners can add dynamic ones in Shop.slots)
const slots = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];
const SLOT_CAPACITY = 3;

router.get("/slots", async (req, res) => {
  // Get date from query parameter (YYYY-MM-DD format) or default to today
  const dateParam = req.query.date;
  let targetDate = new Date();
  
  if (dateParam) {
    targetDate = new Date(dateParam);
    // Set to start of day to ensure proper date comparison
    targetDate.setHours(0, 0, 0, 0);
  } else {
    targetDate.setHours(0, 0, 0, 0);
  }
  
  // Calculate end of target date for range query
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Exclude cancelled, rejected, and completed bookings from slot count
  // Only count bookings for the specific date
  // Completed bookings free up the slot for new customers
  const bookings = await BarberBooking.find({ 
    status: { $nin: ["cancelled", "rejected", "completed"] },
    bookingDate: { $gte: targetDate, $lte: endOfDay }
  });
  const bookingCounts = bookings.reduce((acc, booking) => {
    if (!booking.slot) return acc;
    acc[booking.slot] = (acc[booking.slot] || 0) + 1;
    return acc;
  }, {});

  // gather dynamic slots from all barber shops
  const shops = await Shop.find({ type: "barber" });
  const slotSettings = new Map();
  shops.forEach((s) => {
    (s.slots || []).forEach((slot) => {
      const time = typeof slot === "string" ? slot : slot?.time;
      if (!time) return;
      const isBookable = typeof slot === "string" ? true : slot.isBookable !== false;
      slotSettings.set(time, { isBookable });
    });
  });

  const combined = Array.from(new Set([ ...slotSettings.keys(), ...slots ]));
  const available = combined.filter((time) => {
    const manualState = slotSettings.get(time);
    const isManuallyBlocked = manualState && manualState.isBookable === false;
    if (isManuallyBlocked) return false;
    return (bookingCounts[time] || 0) < SLOT_CAPACITY;
  });

  res.json(available);
});

// List barber shops (for client display if needed)
router.get("/shops", async (req, res) => {
  const shops = await Shop.find({ type: "barber" });
  res.json(shops);
});

// Book a slot
router.post("/book", authMiddleware, async (req, res) => {
  const { slot, bookingDate } = req.body;
  try {
    if (!slot) return res.status(400).json({ message: "slot is required" });
    if (!bookingDate) return res.status(400).json({ message: "bookingDate is required" });
    
    // Parse and normalize the booking date
    const targetDate = new Date(bookingDate);
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Exclude cancelled, rejected, and completed bookings from slot count
    // Only count bookings for the specific date
    // Completed bookings free up the slot for new customers
    const activeCount = await BarberBooking.countDocuments({
      slot,
      bookingDate: { $gte: targetDate, $lte: endOfDay },
      status: { $nin: ["cancelled", "rejected", "completed"] },
    });
    if (activeCount >= SLOT_CAPACITY) {
      return res.status(400).json({ message: "Slot already fully booked for this date" });
    }

    // Ensure slot has not been manually disabled by owner
    const shops = await Shop.find({ type: "barber" });
    const slotSettings = new Map();
    shops.forEach((shop) => {
      (shop.slots || []).forEach((entry) => {
        const time = typeof entry === "string" ? entry : entry?.time;
        if (!time) return;
        const isBookable = typeof entry === "string" ? true : entry.isBookable !== false;
        slotSettings.set(time, { isBookable });
      });
    });
    const combined = Array.from(new Set([...slotSettings.keys(), ...slots]));

    if (!combined.includes(slot)) {
      return res.status(400).json({ message: "Invalid slot" });
    }

    const manualEntry = slotSettings.get(slot);
    const isManuallyBlocked = manualEntry && manualEntry.isBookable === false;
    if (isManuallyBlocked) {
      return res.status(400).json({ message: "Slot is not available right now" });
    }

    const booking = await BarberBooking.create({ 
      userId: req.user, 
      slot,
      bookingDate: targetDate
    });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get user's barber bookings (last 24 hours only for customer "My Bookings" view)
router.get("/my-bookings", authMiddleware, async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const bookings = await BarberBooking.find({
    userId: req.user,
    createdAt: { $gte: since },
  }).sort({ bookingDate: 1, slot: 1 }); // Sort by date and time
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
