import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { retrieveRelevantChunks } from "../services/ragService.js";

/**
 * =============================================================================
 * aiRoutes.js — PHASE 3: GENERATION (powered by Groq)
 * =============================================================================
 *
 * WHY GROQ INSTEAD OF GEMINI FOR GENERATION?
 * Gemini's free tier quota is per Google Cloud PROJECT — once exhausted,
 * ALL Gemini models return 429 regardless of which model you pick.
 *
 * Groq is a completely separate provider:
 *   - Free tier: ~14,400 requests/day (far more generous)
 *   - No credit card required
 *   - Ultra-fast inference (uses custom LPU hardware)
 *   - Uses OpenAI-compatible chat format (simpler than Gemini)
 *   - Get free key at: https://console.groq.com/keys
 *
 * ARCHITECTURE:
 *   Gemini  → embeddings only (gemini-embedding-001) ← still working
 *   Groq    → generation only (llama-3.3-70b-versatile) ← used here
 *
 * GROQ API FORMAT (OpenAI-compatible):
 *   POST https://api.groq.com/openai/v1/chat/completions
 *   Authorization: Bearer GROQ_API_KEY
 *   Body: { model, messages: [{role: "system"|"user"|"assistant", content}] }
 * =============================================================================
 */

const router = express.Router();

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile"; // Free, fast, high quality

// POST /api/ai/chat
// Body: { messages: [{ role: "user" | "model", content: "..." }] }
router.post("/chat", authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages array is required." });
    }

    // -------------------------------------------------------------------------
    // STEP 1: Extract the latest user query for RAG retrieval
    // -------------------------------------------------------------------------
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUserMessage?.content || "";

    // -------------------------------------------------------------------------
    // STEP 2: RETRIEVAL — Find top-3 relevant chunks via cosine similarity
    // -------------------------------------------------------------------------
    let contextText = "";
    try {
      const relevantChunks = await retrieveRelevantChunks(query, 3);
      if (relevantChunks.length > 0) {
        contextText = relevantChunks
          .map((chunk, idx) => `${idx + 1}. ${chunk.text}`)
          .join("\n");
      }
    } catch (ragErr) {
      console.warn("RAG retrieval failed, proceeding without context:", ragErr.message);
    }

    // -------------------------------------------------------------------------
    // STEP 3: BUILD SYSTEM PROMPT with retrieved context
    //
    // KEY DIFFERENCE FROM GEMINI FORMAT:
    // Groq (OpenAI-compatible) supports a dedicated "system" role — cleaner
    // than the user/model turn trick required by Gemini's API.
    // -------------------------------------------------------------------------
    const systemPrompt =
      `You are CampusEase AI — a friendly, witty campus assistant for IIT/NIT students. ` +
      `You are knowledgeable about campus food canteens, barber shops, and laundry services.\n\n` +

      (contextText
        ? `CAMPUS DATA (retrieved live from database):\n${contextText}\n\n`
        : ``) +

      `HOW TO RESPOND:\n` +
      `1. FACTUAL queries (prices, slots, menus, availability):\n` +
      `   → Answer strictly from CAMPUS DATA above. Never invent prices, slot times, or shop names.\n` +
      `   → If data isn't in context, say "I don't have live data on that right now."\n\n` +
      `2. CASUAL / MOOD-BASED queries ("I'm bored", "suggest something", "I'm hungry", "need a fresh look"):\n` +
      `   → Be warm, witty, and helpful. Use the campus data to make personalized suggestions.\n` +
      `   → Match mood to service: bored/hungry → food recommendations from the menu, \n` +
      `     need a fresh look → barber shop suggestions, messy clothes → laundry options.\n` +
      `   → Pick specific items/slots from the context and recommend them enthusiastically.\n\n` +
      `3. OUT-OF-SCOPE queries (weather, politics, general knowledge):\n` +
      `   → Politely say you're specialized for campus services, then pivot to something campus-related.\n\n` +
      `4. ALWAYS:\n` +
      `   → For bookings/orders, tell the student to use the Food/Barber/Laundry page on CampusEase.\n` +
      `   → Keep replies concise (2-4 sentences max for casual, slightly longer for factual).\n` +
      `   → Use emojis occasionally to feel friendly, not robotic.\n`;

    // -------------------------------------------------------------------------
    // STEP 4: CALL GROQ API
    //
    // GROQ MESSAGE FORMAT (OpenAI-compatible):
    //   system    → background instructions + RAG context
    //   user      → what the student typed
    //   assistant → what the AI previously replied
    //
    // Note: Our frontend sends role "model" (Gemini convention).
    // Groq expects "assistant" (OpenAI convention) — we map it below.
    // -------------------------------------------------------------------------
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const groqResponse = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        temperature: 0.4,
        max_tokens: 512,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error("Groq API error:", errText);
      return res.status(502).json({ message: "AI service error. Please try again." });
    }

    const groqData = await groqResponse.json();

    // Groq response (OpenAI format):
    // { choices: [{ message: { role: "assistant", content: "..." } }] }
    const reply =
      groqData?.choices?.[0]?.message?.content ||
      "I'm sorry, I couldn't generate a response. Please try again.";

    return res.json({ reply });

  } catch (error) {
    console.error("AI Chat error:", error);
    return res.status(500).json({ message: "Internal server error in AI chat." });
  }
});

export default router;
