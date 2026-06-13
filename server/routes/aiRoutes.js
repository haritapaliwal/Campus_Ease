import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { retrieveRelevantChunks } from "../services/ragService.js";
import Shop from "../models/Shop.js";

/**
 * =============================================================================
 * aiRoutes.js — PHASE 3: GENERATION (powered by Groq)
 * =============================================================================
 */

const router = express.Router();

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Robust character-by-character brace tracker to extract JSON blocks
 * from custom brackets in conversational responses without regex failure.
 */
export function extractTags(text) {
  if (!text) return [];
  const tags = [];
  const markers = ["ORDER_PROPOSAL:", "PLACE_ORDER_NOW:"];

  for (const marker of markers) {
    let searchIdx = 0;
    while (true) {
      const startTagIdx = text.indexOf("[" + marker, searchIdx);
      if (startTagIdx === -1) break;

      const jsonStartIdx = text.indexOf("{", startTagIdx);
      if (jsonStartIdx === -1) break;

      let braceCount = 0;
      let jsonEndIdx = -1;
      for (let i = jsonStartIdx; i < text.length; i++) {
        if (text[i] === "{") braceCount++;
        else if (text[i] === "}") {
          braceCount--;
          if (braceCount === 0) {
            jsonEndIdx = i;
            break;
          }
        }
      }

      if (jsonEndIdx !== -1) {
        const closingBracketIdx = text.indexOf("]", jsonEndIdx);
        if (closingBracketIdx !== -1) {
          const rawTag = text.substring(startTagIdx, closingBracketIdx + 1);
          const rawJson = text.substring(jsonStartIdx, jsonEndIdx + 1);
          tags.push({
            type: marker.replace(":", ""),
            rawTag,
            rawJson,
          });
          searchIdx = closingBracketIdx + 1;
          continue;
        }
      }
      searchIdx = startTagIdx + 1;
    }
  }
  return tags;
}

/**
 * Resolves text-based shop names and item names to real MongoDB ObjectIds.
 */
export async function resolveProposalIds(reply) {
  const tags = extractTags(reply);
  let newReply = reply;

  for (const tag of tags) {
    try {
      const payload = JSON.parse(tag.rawJson);

      if (payload.shopName) {
        const shop = await Shop.findOne({
          name: new RegExp("^" + payload.shopName.trim() + "$", "i"),
          status: "active",
        });

        if (shop) {
          payload.shopId = shop._id.toString();

          if (payload.category === "laundry" && Array.isArray(payload.items)) {
            const catalog = shop.laundryCatalog || {};
            const resolvedItems = [];
            for (const item of payload.items) {
              let foundItem = null;
              for (const subcat of ["laundry", "dryclean", "iron"]) {
                const matchEntry = (catalog[subcat] || []).find(
                  (entry) => entry.name.toLowerCase() === item.name.toLowerCase()
                );
                if (matchEntry) {
                  foundItem = {
                    itemId: matchEntry._id.toString(),
                    name: matchEntry.name,
                    price: matchEntry.price,
                    quantity: Number(item.quantity) || 1,
                  };
                  break;
                }
              }
              resolvedItems.push(foundItem || { name: item.name, price: item.price || 0, quantity: Number(item.quantity) || 1 });
            }
            payload.items = resolvedItems;
          }

          if (payload.category === "canteen" && Array.isArray(payload.items)) {
            const resolvedItems = [];
            const allCanteenShops = await Shop.find({ category: "canteen", status: "active" });

            for (const item of payload.items) {
              const nameToMatch = item.item || item.name;
              let matchingShop = shop;
              let menuEntry = (shop.menu || []).find(
                (entry) => entry.item.toLowerCase() === nameToMatch.toLowerCase()
              );

              if (!menuEntry) {
                for (const otherShop of allCanteenShops) {
                  if (otherShop.name !== shop.name) {
                    const entry = (otherShop.menu || []).find(
                      (e) => e.item.toLowerCase() === nameToMatch.toLowerCase()
                    );
                    if (entry) {
                      menuEntry = entry;
                      matchingShop = otherShop;
                      break;
                    }
                  }
                }
              }

              resolvedItems.push({
                item: menuEntry ? menuEntry.item : nameToMatch,
                price: menuEntry ? menuEntry.price : (item.price || 0),
                quantity: Number(item.quantity) || 1,
                shop: matchingShop ? matchingShop.name : (item.shop || shop.name),
                shopId: matchingShop ? matchingShop._id.toString() : (item.shopId || payload.shopId || shop._id.toString())
              });
            }
            payload.items = resolvedItems;
          }
        }
      }

      const newTag = `[${tag.type}:${JSON.stringify(payload)}]`;
      newReply = newReply.replace(tag.rawTag, newTag);
    } catch (parseErr) {
      console.warn("RAG resolution parser warning:", parseErr.message);
    }
  }

  return newReply;
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC SERVER-SIDE INTENT DETECTOR
// Instead of asking the LLM to produce structured tags (unreliable),
// we detect intent ourselves and build the proposal directly from the DB.
// ─────────────────────────────────────────────────────────────────────────────

function detectIntent(query) {
  const q = query.toLowerCase();

  const barberKeywords = [
    "haircut", "hair cut", "shave", "trim", "barber", "salon", 
    "book slot", "book a slot", "book the slot", "book a haircut", 
    "book again", "slot booking", "hair slot"
  ];
  const laundryKeywords = [
    "wash", "laundry", "iron", "dry clean", "dryclean", "press my", 
    "clean my clothes", "ironing", "washing"
  ];
  const orderKeywords = ["order", "want", "get me", "give me", "buy", "place", "add", "i'll have", "can i get", "i need"];
  const foodKeywords = [
    "sandwich", "burger", "shake", "pizza", "chai", "coffee", "dosa", "idli",
    "maggie", "maggi", "paratha", "samosa", "roll", "paneer", "food", "eat",
    "meal", "snack", "canteen", "ccd", "amul", "vinayak", "cibus",
  ];

  if (barberKeywords.some((kw) => q.includes(kw)) || (q.includes("book") && q.includes("slot"))) return "barber";
  if (laundryKeywords.some((kw) => q.includes(kw))) return "laundry";
  if (orderKeywords.some((kw) => q.includes(kw)) || foodKeywords.some((kw) => q.includes(kw))) return "canteen";

  return null;
}

function parseQuantity(str) {
  const wordNums = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const wordMatch = str.match(/\b(one|two|three|four|five|six)\b/i);
  if (wordMatch) return wordNums[wordMatch[1].toLowerCase()];
  const numMatch = str.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1]);
  return 1;
}

// Extract quantity specifically associated with an item name in the query string.
// e.g. "order 2 sandwiches and 1 brownie shake" -> getItemQuantity(q, "brownie shake") = 1
function getItemQuantity(q, itemName) {
  // Try to find a number immediately before the item name
  const escaped = itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = new RegExp(`(\\d+|one|two|three|four|five|six)\\s+${escaped}`, 'i');
  const m = q.match(before);
  if (m) return parseQuantity(m[1]);
  return 1;
}

async function buildCanteenProposal(query, messages = []) {
  const canteens = await Shop.find({ category: "canteen", status: "active" });
  if (canteens.length === 0) return null;

  const queriesToCheck = [query.toLowerCase()];
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user") {
        const text = (m.content || "").toLowerCase().trim();
        if (text.length > 4 && !queriesToCheck.includes(text)) {
          queriesToCheck.push(text);
        }
      }
    }
  }

  // Flatten all menu items across all canteens into one lookup list
  // Sort longer names first so "brownie shake" is checked before "shake"
  const itemMap = [];
  for (const shop of canteens) {
    for (const menuItem of shop.menu || []) {
      itemMap.push({ item: menuItem.item, price: menuItem.price, shopName: shop.name, shopId: shop._id.toString() });
    }
  }
  itemMap.sort((a, b) => b.item.length - a.item.length);

  for (const q of queriesToCheck) {
    // Check if a specific shop is mentioned
    let targetShop = null;
    for (const shop of canteens) {
      if (q.includes(shop.name.toLowerCase())) {
        targetShop = shop;
        break;
      }
    }

    const matchedItems = [];
    const usedRanges = []; // track which characters in q are already claimed by a longer match

    for (const entry of itemMap) {
      if (targetShop && entry.shopName !== targetShop.name) continue;
      const itemLower = entry.item.toLowerCase();
      const idx = q.indexOf(itemLower);
      if (idx === -1) continue;

      // Check this position isn't already claimed by a longer item
      const alreadyClaimed = usedRanges.some(([s, e]) => idx >= s && idx < e);
      if (alreadyClaimed) continue;

      // Avoid duplicate item matches for same shop
      if (matchedItems.find((m) => m.item === entry.item && m.shopName === entry.shopName)) continue;

      const qty = getItemQuantity(q, itemLower);
      matchedItems.push({ item: entry.item, price: entry.price, quantity: qty, shop: entry.shopName, shopName: entry.shopName, shopId: entry.shopId });
      usedRanges.push([idx, idx + itemLower.length]);
    }

    if (matchedItems.length > 0) {
      // Group by shop, pick shop with most matched items
      const shopGroups = {};
      for (const it of matchedItems) {
        if (!shopGroups[it.shopName]) shopGroups[it.shopName] = { shopId: it.shopId, shopName: it.shopName, items: [] };
        shopGroups[it.shopName].items.push({ 
          item: it.item, 
          price: it.price, 
          quantity: it.quantity, 
          shop: it.shopName,
          shopId: it.shopId
        });
      }
      const bestGroup = Object.values(shopGroups).sort((a, b) => b.items.length - a.items.length)[0];

      return { category: "canteen", shopName: bestGroup.shopName, shopId: bestGroup.shopId, items: bestGroup.items, orderType: "daytime" };
    }
  }

  return null;
}

/**
 * Normalize a time string like "2 pm", "2:00 pm", "14:00" → "02:00 PM"
 */
function normalizeTimeString(raw) {
  const s = raw.trim().toLowerCase();
  // Handle 24-hour like 14:00
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    let h = parseInt(h24[1]);
    const m = h24[2];
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
  }
  // Handle 12-hour like "2:00 pm" or "2 pm"
  const h12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (h12) {
    const h = String(parseInt(h12[1])).padStart(2, "0");
    const m = h12[2] || "00";
    const ampm = h12[3].toUpperCase();
    return `${h}:${m} ${ampm}`;
  }
  return null;
}

/**
 * Find the closest available bookable slot to the requested time.
 * Returns { slot, isExactMatch, availableSlots }
 */
function findBestSlot(requestedTime, bookableSlots) {
  if (bookableSlots.length === 0) return { slot: "10:00 AM", isExactMatch: false, availableSlots: [] };
  const availableTimes = bookableSlots.map((s) => s.time);

  if (!requestedTime) {
    return { slot: availableTimes[0], isExactMatch: false, availableSlots: availableTimes };
  }

  const norm = normalizeTimeString(requestedTime);
  if (!norm) return { slot: availableTimes[0], isExactMatch: false, availableSlots: availableTimes };

  // Try exact match first
  const exact = availableTimes.find((t) => t.toUpperCase() === norm.toUpperCase());
  if (exact) return { slot: exact, isExactMatch: true, availableSlots: availableTimes };

  // Try partial match (same hour)
  const hourOnly = norm.split(":")[0];
  const partial = availableTimes.find((t) => t.startsWith(hourOnly + ":"));
  if (partial) return { slot: partial, isExactMatch: false, availableSlots: availableTimes };

  // Fall back to first available
  return { slot: availableTimes[0], isExactMatch: false, availableSlots: availableTimes };
}

async function buildBarberProposal(query, messages = []) {
  const barbers = await Shop.find({ category: "barber", status: "active" });
  if (barbers.length === 0) return null;

  const q = query.toLowerCase();
  let targetShop = barbers[0];
  for (const shop of barbers) {
    if (q.includes(shop.name.toLowerCase())) { targetShop = shop; break; }
  }

  const bookableSlots = (targetShop.slots || []).filter(
    (s) => s.isBookable && s.time && s.time !== "undefined"
  );

  // Extract requested time from query
  const timePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{2}:\d{2})/gi;
  let timeMatches = query.match(timePattern);
  let requestedTime = timeMatches ? timeMatches[0] : null;

  // If not found in current query, check history for most recent time mention
  if (!requestedTime && Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user") {
        const historyMatches = (m.content || "").match(timePattern);
        if (historyMatches) {
          requestedTime = historyMatches[0];
          break;
        }
      }
    }
  }

  const { slot, isExactMatch, availableSlots } = findBestSlot(requestedTime, bookableSlots);

  // Tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bookingDate = tomorrow.toISOString().split("T")[0];

  return {
    category: "barber",
    shopName: targetShop.name,
    shopId: targetShop._id.toString(),
    slot,
    bookingDate,
    requestedTime: requestedTime ? normalizeTimeString(requestedTime) : null,
    isExactMatch,
    availableSlots,
  };
}

async function buildLaundryProposal(query, messages = []) {
  const laundryShops = await Shop.find({ category: "laundry", status: "active" });
  if (laundryShops.length === 0) return null;

  const queriesToCheck = [query.toLowerCase()];
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user") {
        const text = (m.content || "").toLowerCase().trim();
        if (text.length > 4 && !queriesToCheck.includes(text)) {
          queriesToCheck.push(text);
        }
      }
    }
  }

  for (const q of queriesToCheck) {
    let targetShop = laundryShops[0];
    for (const shop of laundryShops) {
      if (q.includes(shop.name.toLowerCase())) { targetShop = shop; break; }
    }

    const catalog = targetShop.laundryCatalog || {};
    const allItems = [
      ...(catalog.laundry || []).map((i) => ({ ...i.toObject(), subcat: "laundry" })),
      ...(catalog.dryclean || []).map((i) => ({ ...i.toObject(), subcat: "dryclean" })),
      ...(catalog.iron || []).map((i) => ({ ...i.toObject(), subcat: "iron" })),
    ];

    const matchedItems = [];
    for (const entry of allItems) {
      if (q.includes(entry.name.toLowerCase())) {
        const qty = parseQuantity(q);
        matchedItems.push({ itemId: entry._id.toString(), name: entry.name, price: entry.price, quantity: qty });
      }
    }

    if (matchedItems.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const pickupDate = tomorrow.toISOString().split("T")[0];

      return {
        category: "laundry",
        shopName: targetShop.name,
        shopId: targetShop._id.toString(),
        items: matchedItems,
        pickupDate,
        pickupTime: "10:00 AM",
        deliveryOption: "standard",
        serviceType: "laundry",
      };
    }
  }

  // Fallback to default first item if nothing matched
  let targetShop = laundryShops[0];
  const catalog = targetShop.laundryCatalog || {};
  const allItems = [
    ...(catalog.laundry || []).map((i) => ({ ...i.toObject(), subcat: "laundry" })),
    ...(catalog.dryclean || []).map((i) => ({ ...i.toObject(), subcat: "dryclean" })),
    ...(catalog.iron || []).map((i) => ({ ...i.toObject(), subcat: "iron" })),
  ];
  if (allItems.length > 0) {
    const first = allItems[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pickupDate = tomorrow.toISOString().split("T")[0];
    return {
      category: "laundry",
      shopName: targetShop.name,
      shopId: targetShop._id.toString(),
      items: [{ itemId: first._id.toString(), name: first.name, price: first.price, quantity: 1 }],
      pickupDate,
      pickupTime: "10:00 AM",
      deliveryOption: "standard",
      serviceType: "laundry",
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/chat
// ─────────────────────────────────────────────────────────────────────────────
router.post("/chat", authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages array is required." });
    }

    // STEP 1: Extract latest user query
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUserMessage?.content || "";

    // STEP 2: RAG RETRIEVAL for conversational context
    let contextText = "";
    try {
      const relevantChunks = await retrieveRelevantChunks(query, 3);
      if (relevantChunks.length > 0) {
        contextText = relevantChunks.map((chunk, idx) => `${idx + 1}. ${chunk.text}`).join("\n");
      }
    } catch (ragErr) {
      console.warn("RAG retrieval failed, proceeding without context:", ragErr.message);
    }

    // STEP 3: Fetch active shops from database to seed the live inventory catalog
    const activeShops = await Shop.find({ status: "active" });
    let catalogText = "";
    for (const s of activeShops) {
      catalogText += `- SHOP: "${s.name}" (ID: ${s._id.toString()})\n`;
      catalogText += `  Category: ${s.category}\n`;
      if (s.category === "canteen" && Array.isArray(s.menu)) {
        catalogText += `  Menu Items:\n`;
        for (const item of s.menu) {
          catalogText += `    * "${item.item}" (Price: ₹${item.price})\n`;
        }
      } else if (s.category === "barber" && Array.isArray(s.slots)) {
        const bookable = s.slots.filter((slot) => slot.isBookable).map((slot) => slot.time);
        catalogText += `  Available Bookable Slots: ${bookable.join(", ")}\n`;
      } else if (s.category === "laundry" && s.laundryCatalog) {
        catalogText += `  Laundry Catalog:\n`;
        const cat = s.laundryCatalog;
        for (const subcat of ["laundry", "dryclean", "iron"]) {
          if (cat[subcat] && cat[subcat].length > 0) {
            catalogText += `    Category "${subcat}":\n`;
            for (const item of cat[subcat]) {
              catalogText += `      * "${item.name}" (Price: ₹${item.price}, ID: ${item._id.toString()})\n`;
            }
          }
        }
      }
      catalogText += "\n";
    }

    // STEP 4: UNIFIED COGNITIVE SYSTEM PROMPT
    const systemPrompt =
      `You are CampusEase AI — an extremely intelligent, conversational, and helpful campus assistant for IIT/NIT students.\n\n` +
      `Today's date is 2026-05-25. Barber slot bookings and laundry pickups are always scheduled for tomorrow (date: 2026-05-26).\n\n` +
      (contextText ? `CAMPUS CONTEXT DATA:\n${contextText}\n\n` : "") +
      `CAMPUS INVENTORY & SERVICES:\n${catalogText}\n` +
      `YOUR TASK:\n` +
      `Analyze the conversation history and the user's latest message. Determine the user's intent, formulate a friendly conversational reply, and optionally generate a structured booking/ordering proposal or placement command.\n\n` +
      `You must respond ONLY with a JSON object in the following format:\n` +
      `{\n` +
      `  "reply": "Friendly conversational reply (under 3 sentences. Be warm and helpful. Use emojis occasionally. If there is a slot/item mismatch, mention it clearly in the reply and list alternatives)",\n` +
      `  "intent": "canteen" | "barber" | "laundry" | "cancel" | "chat",\n` +
      `  "proposal": {\n` +
      `    "category": "canteen" | "barber" | "laundry",\n` +
      `    "shopName": "Exact shop name from the catalog",\n` +
      `    "shopId": "Exact shop ID from the catalog",\n` +
      `    \n` +
      `    // For canteen category:\n` +
      `    "items": [{"item": "Item Name", "price": 30, "quantity": 2, "shop": "Shop Name"}],\n` +
      `    "orderType": "daytime",\n` +
      `    \n` +
      `    // For barber category:\n` +
      `    "slot": "Exact slot time selected from the available slots list (e.g. '02:00 PM' or closest)",\n` +
      `    "bookingDate": "2026-05-26",\n` +
      `    \n` +
      `    // For laundry category:\n` +
      `    "items": [{"itemId": "Exact Item ID from the laundry catalog", "name": "Item Name", "price": 20, "quantity": 1}],\n` +
      `    "pickupDate": "2026-05-26",\n` +
      `    "pickupTime": "10:00 AM",\n` +
      `    "deliveryOption": "standard" | "express",\n` +
      `    "serviceType": "laundry"\n` +
      `  } | null,\n` +
      `  "executePlacement": true | false\n` +
      `}\n\n` +
      `INTENT & PROPOSAL RULES:\n` +
      `1. Fresh Requests (e.g. "book a slot", "i want 2pm slot", "order Maggi", "clean my shirts"): Set "intent" to the matching category and build a "proposal" object matching items/slots/shops exactly against the CAMPUS INVENTORY catalog.\n` +
      `   - For Barber: Match their requested time to the available slots. If they change the time in history (e.g. from 11:00 AM to 2:00 PM), immediately create a new proposal matching the new time slot (e.g. "02:00 PM").\n` +
      `   - For Canteen: Match food items exactly, grouping them by the shop with the most matches.\n` +
      `   - For Laundry: Match clothes to the catalog.\n` +
      `2. Confirmations (e.g. "yes", "confirm", "go ahead", "book it now"): If the user is saying yes or confirming the previously proposed slot/order from history, reconstruct the "proposal" object exactly as proposed in the history and set "executePlacement" to true. Set "reply" to a friendly booking confirmation message.\n` +
      `3. Cancellations (e.g. "cancel", "no", "forget it"): If the user cancels, set "intent" to "cancel", "proposal" to null, "executePlacement" to false, and reply with a clean cancellation confirmation.\n` +
      `4. Casual Chat: If the user is just chatting or asking factual questions, set "intent" to "chat", "proposal" to null, "executePlacement" to false, and answer using CAMPUS CONTEXT DATA.\n`;

    // STEP 5: Call Groq in JSON Mode
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: (m.content || "").trim(),
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
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error("Groq API error in Unified model:", errText);
      return res.status(502).json({ message: "AI service error. Please try again." });
    }

    const groqData = await groqResponse.json();
    const jsonStr = groqData?.choices?.[0]?.message?.content || "{}";

    let parsedRes;
    try {
      parsedRes = JSON.parse(jsonStr);
    } catch (e) {
      try {
        const cleanJson = jsonStr.replace(/```json|```/g, "").trim();
        parsedRes = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.error("Failed to parse Groq response JSON:", jsonStr);
        return res.status(502).json({ message: "AI response format error. Please try again." });
      }
    }

    let finalReply = parsedRes.reply || "";

    // STEP 6: DB RESOLVER INTERFACE — ensures complete catalog ObjectId and Price safety
    if (parsedRes.proposal) {
      let serverProposalTag = "";
      if (parsedRes.executePlacement) {
        const resolved = await resolveProposalIds(`[PLACE_ORDER_NOW:${JSON.stringify(parsedRes.proposal)}]`);
        serverProposalTag = resolved;
      } else {
        const resolved = await resolveProposalIds(`[ORDER_PROPOSAL:${JSON.stringify(parsedRes.proposal)}]`);
        serverProposalTag = resolved;
      }
      finalReply += `\n${serverProposalTag}`;
    }

    console.log("FINAL REPLY TO CLIENT (LLM Unified):\n", finalReply);
    return res.json({ reply: finalReply });

  } catch (error) {
    console.error("AI Chat error:", error);
    return res.status(500).json({ message: "Internal server error in AI chat." });
  }
});

export default router;
