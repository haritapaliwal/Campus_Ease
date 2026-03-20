import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import BarberBooking from "./models/BarberBooking.js";
import SlotCounter from "./models/SlotCounter.js";

dotenv.config();

/**
 * syncSlotCounters.js
 * 
 * This script synchronizes the SlotCounter collection with the current
 * state of BarberBookings. Run this once after deploying the SlotCounter
 * changes to ensure existing bookings are correctly counted.
 */
async function sync() {
  try {
    await connectDB();
    console.log("Connected to DB, starting SlotCounter sync...");

    // 1. Clear existing counters to start fresh for a full sync
    // This is safe because it's a maintenance script
    await SlotCounter.deleteMany({});
    console.log("Cleared existing counters.");

    // 2. Aggregate active bookings from the main bookings collection
    // We only count bookings that are NOT in a terminal state
    const activeBookingGroups = await BarberBooking.aggregate([
      {
        $match: {
          status: { $nin: ["cancelled", "rejected", "completed"] }
        }
      },
      {
        $group: {
          _id: {
            shopId: "$shopId",
            slot: "$slot",
            bookingDate: "$bookingDate"
          },
          count: { $sum: 1 }
        }
      }
    ]);

    console.log(`Found ${activeBookingGroups.length} unique (shop, slot, date) combinations with active bookings.`);

    // 3. Create the corresponding SlotCounter documents
    for (const group of activeBookingGroups) {
      if (!group._id.shopId || !group._id.slot || !group._id.bookingDate) {
        console.warn("Skipping group with missing fields:", group._id);
        continue;
      }

      await SlotCounter.create({
        shopId: group._id.shopId,
        slot: group._id.slot,
        bookingDate: group._id.bookingDate,
        count: group.count
      });
    }

    console.log("SlotCounter sync completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

sync();
