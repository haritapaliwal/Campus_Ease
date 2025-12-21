import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  // For students this can be their student id; for owners we can store an identifier or skip
  studentId: { type: String },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["student", "owner"], default: "student" },
  // If owner, the shop they manage
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" }
});

// Ensure studentId is unique only when present (ignore nulls)
userSchema.index({ studentId: 1 }, { unique: true, sparse: true });

export default mongoose.model("User", userSchema);
