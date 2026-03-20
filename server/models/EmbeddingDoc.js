import mongoose from "mongoose";

/**
 * =============================================================================
 * EmbeddingDoc — The "Vector Store" for our RAG pipeline
 * =============================================================================
 *
 * WHAT IS THIS?
 * In RAG (Retrieval-Augmented Generation), we need a place to store
 * "embeddings" — the numerical representation of our data.
 *
 * WHAT IS AN EMBEDDING?
 * An embedding converts text like:
 *   "Campus Cuts barber shop offers haircuts at 10am, 2pm, 4pm"
 * into a long array of numbers like:
 *   [0.023, -0.412, 0.881, 0.002, ... 768 numbers total]
 *
 * WHY NUMBERS?
 * Because math works on numbers, not words. Similar meanings = similar vectors.
 * This is how the AI finds relevant information — by measuring distance/angle
 * between vectors (cosine similarity).
 *
 * WHAT IS STORED HERE?
 * - text      : The original readable chunk of campus data
 * - embedding : The 768-dimensional vector representation of that text
 * - category  : Which service this is about (canteen/barber/laundry)
 * - shopId    : Reference back to the original Shop document
 * - updatedAt : So we can refresh stale embeddings
 * =============================================================================
 */
const embeddingDocSchema = new mongoose.Schema(
  {
    // The raw human-readable text chunk we embedded
    // Example: "Sharma Canteen serves: Dosa (₹30), Idli (₹20), Chai (₹10)"
    text: {
      type: String,
      required: true,
    },

    // The 768-dimensional vector from Gemini text-embedding-004
    // This is the "encoded knowledge" — looks like [0.023, -0.41, 0.88, ...]
    embedding: {
      type: [Number],
      required: true,
    },

    // Which service category: canteen | barber | laundry
    category: {
      type: String,
      enum: ["canteen", "barber", "laundry"],
      required: true,
    },

    // Reference to the original Shop document in MongoDB
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
    },

    // Unique key so we can upsert (update if exists, insert if not)
    // prevents duplicate embeddings for the same shop on restarts
    chunkId: {
      type: String,
      unique: true,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("EmbeddingDoc", embeddingDocSchema);
