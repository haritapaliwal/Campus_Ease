import mongoose from "mongoose";

const slotCounterSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    slot: { type: String, required: true },
    bookingDate: { type: Date, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Unique compound index to ensure one counter per slot/date/shop
slotCounterSchema.index({ shopId: 1, slot: 1, bookingDate: 1 }, { unique: true });

export default mongoose.model("SlotCounter", slotCounterSchema);
