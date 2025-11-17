import mongoose from "mongoose";

const barberBookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    slot: { type: String, required: true },
    status: { type: String, default: "booked" },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("BarberBooking", barberBookingSchema);
