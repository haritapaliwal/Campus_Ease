import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [{ item: String, price: Number, shop: String }],
    orderType: { type: String, enum: ["daytime", "night"], required: true },
    status: { type: String, default: "pending" },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
