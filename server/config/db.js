import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");

    // Best-effort: drop legacy non-sparse unique index on studentId to allow multiple nulls
    try {
      const User = (await import("../models/User.js")).default;
      const indexes = await User.collection.indexes();
      const hasLegacy = indexes.find(i => i.name === "studentId_1" && !i.sparse);
      if (hasLegacy) {
        await User.collection.dropIndex("studentId_1");
        await User.syncIndexes();
        console.log("Refreshed studentId index (sparse unique)");
      }
    } catch (e) {
      // ignore if collection/index not present yet
    }
  } catch (error) {
    console.error("MongoDB Error:", error.message);
    process.exit(1);
  }
};

export default connectDB;
