import mongoose from "mongoose";

const laundryBookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" },
    slot: { type: String }, // Keep for backward compatibility
    status: { type: String, default: "booked" },
    deliveredAt: { type: Date },
    // New order fields
    items: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId },
        name: String,
        category: { type: String, enum: ["laundry", "dryclean", "iron"] },
        quantity: { type: Number, default: 0 },
        price: { type: Number, default: 0 },
      },
    ],
    pickupDate: { type: String },
    pickupTime: { type: String },
    deliveryOption: { type: String, default: "standard" }, // "standard" or "express"
    serviceType: { type: String, default: "laundry" }, // "laundry", "dryclean", "iron"
    totalAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("LaundryBooking", laundryBookingSchema);
