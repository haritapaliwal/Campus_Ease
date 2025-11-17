import mongoose from "mongoose";

const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["canteen", "laundry", "barber"], required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // For canteen shops
  menu: [{ item: String, price: Number }],
  // For barber and laundry shops - stores slot time and whether it's bookable
  slots: [{ 
    time: String,
    isBookable: { type: Boolean, default: true }
  }]
});

export default mongoose.model("Shop", shopSchema);
