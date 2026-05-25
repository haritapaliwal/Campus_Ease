import Shop from "../models/Shop.js";
import EmbeddingDoc from "../models/EmbeddingDoc.js";
import mongoose from "mongoose";

async function createVectorSearchIndex() {
  try {
    const conn = mongoose.connection;
    if (conn.readyState !== 1) {
      console.log("⏳ RAG: Waiting for DB connection to build Vector Search Index...");
      return;
    }
    const collection = conn.collection("embeddingdocs");
    const indexes = await collection.listSearchIndexes().toArray();
    const hasIndex = indexes.some((idx) => idx.name === "vector_index");
    if (!hasIndex) {
      console.log("🔄 RAG: Creating Atlas Vector Search index 'vector_index'...");
      await collection.createSearchIndex({
        name: "vector_index",
        type: "vectorSearch",
        definition: {
          fields: [
            {
              type: "vector",
              path: "embedding",
              numDimensions: 768,
              similarity: "cosine",
            },
          ],
        },
      });
      console.log("✅ RAG: Atlas Vector Search index 'vector_index' created.");
    } else {
      console.log("✅ RAG: Atlas Vector Search index 'vector_index' already exists.");
    }
  } catch (err) {
    console.warn(
      "⚠️ RAG: Programmatic Atlas Search Index creation skipped/failed. " +
        "If you are not running on MongoDB Atlas (e.g. running locally), this is normal. " +
        "RAG will automatically fall back to high-precision in-memory cosine similarity. Error: " +
        err.message
    );
  }
}


/**
 * =============================================================================
 * ragService.js — The RAG Brain
 * =============================================================================
 *
 * RAG = Retrieval-Augmented Generation
 *
 * This file handles all 3 phases of RAG:
 *
 *  PHASE 1 — INDEXING  (buildAndIndexChunks)
 *  ─────────────────────────────────────────
 *  Read your MongoDB data → turn it into readable text chunks
 *  → call Gemini Embedding API to convert each chunk into a vector
 *  → store {text + vector} in the EmbeddingDoc collection
 *
 *  PHASE 2 — RETRIEVAL  (retrieveRelevantChunks)
 *  ───────────────────────────────────────────────
 *  User asks a question → embed the question → compare against all stored
 *  vectors using cosine similarity → return top-K most relevant chunks
 *
 *  PHASE 3 — GENERATION  (done in aiRoutes.js)
 *  ──────────────────────────────────────────
 *  Take the retrieved chunks → build a prompt → call Gemini Flash → get answer
 *
 * =============================================================================
 */

// text-embedding-004 was SHUT DOWN on January 14, 2026.
// Its official replacement is gemini-embedding-001 (stable, free, same dimensions)
const GEMINI_EMBEDDING_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

// ⚠️ WHY NOT: const GEMINI_API_KEY = process.env.GEMINI_API_KEY  (at module level)?
// With ES Modules, ALL imports are resolved before ANY module code runs.
// So this file's top-level code executes BEFORE dotenv.config() in server.js.
// Result: process.env.GEMINI_API_KEY is undefined at module load time.
// FIX: Always read process.env inside functions — they run AFTER dotenv.config().

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Cosine Similarity
// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHAT IS COSINE SIMILARITY?
 *
 * It measures the "angle" between two vectors in multi-dimensional space.
 * Value range: -1 (opposite) to +1 (identical meaning).
 *
 * WHY COSINE AND NOT EUCLIDEAN DISTANCE?
 * Cosine similarity cares about DIRECTION (meaning), not magnitude (length).
 * "barber shop" and "haircut salon" might have different word lengths,
 * but their meaning vectors point in similar directions → high cosine score.
 *
 * FORMULA:
 *   cosine(A, B) = (A · B) / (|A| × |B|)
 *
 * Where:
 *   A · B   = dot product = sum of (A[i] × B[i]) for all dimensions
 *   |A|     = magnitude = sqrt(sum of A[i]²)
 *   |B|     = magnitude = sqrt(sum of B[i]²)
 *
 * EXAMPLE (simplified to 3D instead of 768D):
 *   Query: "barber" → [0.9, 0.1, 0.0]
 *   Chunk1: "Campus Cuts barber shop" → [0.85, 0.15, 0.05]  → similarity: 0.99
 *   Chunk2: "Sharma Canteen food menu" → [0.1,  0.05, 0.9]  → similarity: 0.15
 *   → Chunk1 is retrieved, Chunk2 is not
 */
function cosineSimilarity(vecA, vecB) {
  // Step 1: Dot product — multiply each dimension pair and sum them up
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }

  // Step 2: Magnitude of each vector (the "length" of the vector in space)
  let magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  let magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

  // Step 3: Divide dot product by product of magnitudes
  // If either vector is zero-length, return 0 (avoid division by zero)
  if (magA === 0 || magB === 0) return 0;

  return dotProduct / (magA * magB);
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Call Gemini Embedding API
// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHAT IS AN EMBEDDING API?
 *
 * We send a piece of text → the API returns a 768-number array.
 * That array is the text's "semantic fingerprint" in vector space.
 *
 * WHY 768 DIMENSIONS?
 * Gemini's text-embedding-004 model was trained to represent meaning
 * across 768 "features" or "aspects" of language. Think of each dimension
 * as capturing something like:
 *   dim[0]  → formality level
 *   dim[1]  → topic: food vs. services
 *   dim[2]  → sentiment
 *   ... (the model learns what each means during training)
 *
 * TASK TYPE: "RETRIEVAL_DOCUMENT" vs "RETRIEVAL_QUERY"
 * Gemini supports task-specific embeddings:
 *   - Use "RETRIEVAL_DOCUMENT" when embedding things you store (knowledge base)
 *   - Use "RETRIEVAL_QUERY" when embedding the user's search question
 * This asymmetry is intentional — query vectors are optimized to find docs.
 */
async function getEmbedding(text, taskType = "RETRIEVAL_DOCUMENT") {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // read at call-time, not module-load-time
  const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // ✅ Do NOT include "model" here — it's already in the URL path.
      // Including it in BOTH the URL and body causes a 404 conflict.
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: 768,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Embedding API error: ${err}`);
  }

  const data = await response.json();
  // The API returns: { embedding: { values: [0.023, -0.41, 0.88, ...] } }
  return data.embedding.values;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1: INDEXING — Build Text Chunks from DB + Store Embeddings
// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHAT IS CHUNKING?
 *
 * We can't embed your entire database as one blob — the model has context limits
 * and mixing all data makes retrieval imprecise.
 *
 * Instead we cut data into "chunks" — focused, self-contained pieces of info.
 * Each chunk answers ONE topic about ONE shop.
 *
 * EXAMPLE CHUNKS PRODUCED:
 *   Chunk 1: "Sharma Canteen is a food(canteen) shop. Menu: Dosa ₹30, Idli ₹20"
 *   Chunk 2: "Campus Cuts is a barber shop. Available time slots: 10:00 AM, 02:00 PM, 04:00 PM"
 *   Chunk 3: "CleanCo is a laundry shop. Laundry: Shirt ₹20. Dryclean: Jacket ₹80"
 *
 * HOW OFTEN SHOULD INDEXING RUN?
 * It runs once at server startup. For a production system, you'd also run it:
 *   - When a new shop is added
 *   - When shop slots/menu changes
 *   - On a schedule (e.g., nightly cron job)
 */
export async function buildAndIndexChunks() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // read at call-time
  if (!GEMINI_API_KEY) {
    console.warn("⚠️  GEMINI_API_KEY not set — RAG indexing skipped.");
    return;
  }

  // Create Atlas Vector Search index (best-effort)
  await createVectorSearchIndex();

  console.log("🔄 RAG: Starting indexing of campus data...");

  // Step 1: Fetch all shops from MongoDB
  const shops = await Shop.find({ status: "active" });
  console.log(`📦 RAG: Found ${shops.length} active shops to index.`);

  let indexed = 0;

  for (const shop of shops) {
    // Step 2: Build a human-readable text chunk for this shop
    let chunkText = "";
    const shopType = shop.category; // "canteen" | "barber" | "laundry"

    if (shopType === "canteen") {
      // Build a description with the food menu
      const menuStr =
        shop.menu && shop.menu.length > 0
          ? shop.menu.map((m) => `${m.item} ₹${m.price}`).join(", ")
          : "Menu not listed";

      chunkText = `${shop.name} is a food canteen shop on campus. Menu items: ${menuStr}.`;

    } else if (shopType === "barber") {
      // Build a description with available slots
      const slotsStr =
        shop.slots && shop.slots.length > 0
          ? shop.slots
              .filter((s) => s.isBookable)
              .map((s) => s.time)
              .join(", ")
          : "No slots available";

      chunkText = `${shop.name} is a barber shop on campus. Bookable time slots: ${slotsStr}.`;

    } else if (shopType === "laundry") {
      // Build a description with the laundry catalog
      const laundryItems =
        shop.laundryCatalog?.laundry?.map((i) => `${i.name} ₹${i.price}`).join(", ") || "N/A";
      const drycleanItems =
        shop.laundryCatalog?.dryclean?.map((i) => `${i.name} ₹${i.price}`).join(", ") || "N/A";
      const ironItems =
        shop.laundryCatalog?.iron?.map((i) => `${i.name} ₹${i.price}`).join(", ") || "N/A";

      chunkText =
        `${shop.name} is a laundry shop on campus. ` +
        `Laundry: ${laundryItems}. Dry clean: ${drycleanItems}. Iron: ${ironItems}.`;
    }

    if (!chunkText) continue;

    // Step 3: Call Gemini Embedding API to get the vector for this chunk
    // Each chunk becomes a point in 768-dimensional "meaning space"
    try {
      const embedding = await getEmbedding(chunkText, "RETRIEVAL_DOCUMENT");

      // Step 4: Upsert into MongoDB (update if exists, insert if new)
      // chunkId ensures we don't create duplicates on every server restart
      const chunkId = `shop_${shop._id.toString()}`;
      await EmbeddingDoc.findOneAndUpdate(
        { chunkId },
        {
          text: chunkText,
          embedding,
          category: shopType,
          shopId: shop._id,
          chunkId,
        },
        { upsert: true, new: true }
      );

      indexed++;
      console.log(`  ✅ Indexed: "${shop.name}" (${shopType})`);
    } catch (err) {
      console.error(`  ❌ Failed to index shop "${shop.name}":`, err.message);
    }
  }

  console.log(`🎯 RAG: Indexing complete. ${indexed}/${shops.length} shops indexed.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: RETRIEVAL — Find the Most Relevant Chunks for a Query
// ─────────────────────────────────────────────────────────────────────────────
/**
 * HOW RETRIEVAL WORKS:
 *
 * 1. We receive the user's question (e.g., "Which barber shops have slots?")
 * 2. We embed that question using "RETRIEVAL_QUERY" task type
 * 3. We try native MongoDB Atlas Vector Search using aggregation $vectorSearch
 * 4. Fallback: load all embeddings from DB and calculate local cosine similarity
 * 5. Sort by similarity score (highest first)
 * 6. Return top-K chunks
 *
 * @param {string} query - the user's question
 * @param {number} topK  - how many relevant chunks to return (default: 3)
 * @returns {Array<{text, similarity, category}>}
 */
export async function retrieveRelevantChunks(query, topK = 3) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // read at call-time
  if (!GEMINI_API_KEY) {
    return []; // gracefully degrade if no API key
  }

  // Step 1: Embed the user's query
  const queryEmbedding = await getEmbedding(query, "RETRIEVAL_QUERY");

  // Step 2: Native MongoDB Atlas Vector Search
  try {
    const results = await EmbeddingDoc.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: topK,
        },
      },
    ]);

    if (results && results.length > 0) {
      console.log(`🔍 RAG [Atlas Vector Search]: Query "${query.slice(0, 40)}..." matched ${results.length} docs.`);
      return results.map((doc) => ({
        text: doc.text,
        category: doc.category,
        shopId: doc.shopId,
        similarity: doc.score || 1.0,
      }));
    }
  } catch (err) {
    console.warn(
      "⚠️ RAG [Atlas Vector Search Fallback Alert]: Native Atlas Search unavailable or not yet built. " +
        "Using high-precision local cosine similarity search instead. Detail:",
      err.message
    );
  }

  // Step 3 (Fallback): Load all stored document embeddings from MongoDB
  const allDocs = await EmbeddingDoc.find({});

  if (allDocs.length === 0) {
    console.warn("⚠️  RAG: No embeddings found in DB. Have you indexed yet?");
    return [];
  }

  // Step 4: Score each document using cosine similarity
  const scored = allDocs.map((doc) => ({
    text: doc.text,
    category: doc.category,
    shopId: doc.shopId,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  // Step 5: Sort descending by similarity score (best match first)
  scored.sort((a, b) => b.similarity - a.similarity);

  // Step 6: Return only the top-K results
  const topChunks = scored.slice(0, topK);

  console.log(
    `🔍 RAG [Cosine Fallback]: Query "${query.slice(0, 40)}..." → Top matches:`,
    topChunks.map((c) => `[${c.similarity.toFixed(3)}] ${c.text.slice(0, 50)}`)
  );

  return topChunks;
}
