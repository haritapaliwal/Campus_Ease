import { useState, useRef, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import api from "../api.jsx";

/**
 * =============================================================================
 * AIChatBot.jsx — The Floating AI Chat UI (Frontend)
 * =============================================================================
 *
 * WHAT THIS DOES:
 * - Shows a floating bot button (bottom-right) only to logged-in customers
 * - Clicking it opens an animated chat window
 * - Users type questions about food/barber/laundry
 * - Each message is sent to our backend /api/ai/chat (RAG-powered)
 * - The backend retrieves relevant context, calls Gemini, returns a reply
 * - The reply is shown in the chat window with a typing animation
 *
 * CONVERSATION STATE:
 * We maintain a `messages` array: [{ role: "user"|"model", content: "..." }]
 * =============================================================================
 */

const extractTags = (text) => {
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
};

const parseMessage = (text) => {
  if (!text) return { text: "", proposal: null };
  const tags = extractTags(text);
  if (tags.length > 0) {
    const tag = tags[0]; // Match first proposal
    const cleanText = text.replace(tag.rawTag, "").trim();
    try {
      const payload = JSON.parse(tag.rawJson);
      return { text: cleanText, proposal: { type: tag.type, payload } };
    } catch (e) {
      console.error("Failed to parse proposal JSON", e);
    }
  }
  return { text, proposal: null };
};


export default function AIChatBot() {
  const { token, role } = useContext(AuthContext);

  // ── State ──────────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);       // Chat window visible?
  const [messages, setMessages] = useState([         // Full conversation history
    {
      role: "model",
      content:
        "👋 Hi! I'm CampusEase AI. Ask me anything about food canteens, barber shops, or laundry services on campus!",
    },
  ]);
  const [inputText, setInputText] = useState("");    // Current input field value
  const [isLoading, setIsLoading] = useState(false); // Waiting for AI response?
  const [error, setError] = useState(null);          // Error message (if any)

  const messagesEndRef = useRef(null); // For auto-scrolling to bottom

  // Auto-scroll to the latest message whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Only render for logged-in customers
  if (!token || role !== "customer") return null;

  // ── Send a message ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    setError(null);

    // 1. Optimistically add the user's message to the UI
    const newUserMsg = { role: "user", content: trimmed, rawContent: trimmed };
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    setInputText("");
    setIsLoading(true);

    try {
      // 2. Send full conversation history using rawContent to maintain proposal contexts
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.rawContent || m.content,
      }));

      const response = await api.post("/ai/chat", { messages: apiMessages });
      const aiReply = response.data.reply;

      // Parse proposal blocks in the reply
      const parsed = parseMessage(aiReply);
      
      const aiMsgIndex = newMessages.length;
      const aiMsg = {
        role: "model",
        content: parsed.text,
        rawContent: aiReply,
        proposal: parsed.proposal ? { ...parsed.proposal, status: "pending" } : null,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // If it is PLACE_ORDER_NOW, execute immediately
      if (parsed.proposal && parsed.proposal.type === "PLACE_ORDER_NOW") {
        setTimeout(() => {
          executePlacement(parsed.proposal.payload, aiMsgIndex);
        }, 100);
      }

    } catch (err) {
      const errMsg =
        err.response?.data?.message || "Something went wrong. Please try again.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Execute order/booking placement ─────────────────────────────────────────
  const executePlacement = async (payload, msgIndex) => {
    if (!payload) return;

    // Set status to loading
    setMessages((prev) => {
      const updated = [...prev];
      if (updated[msgIndex]) {
        updated[msgIndex] = {
          ...updated[msgIndex],
          proposal: {
            ...updated[msgIndex].proposal,
            status: "loading",
            errorMsg: null,
          },
        };
      }
      return updated;
    });

    try {
      let bookingId = "";
      let followUpText = "";

      if (payload.category === "canteen") {
        // Food Order Placement
        const orderItems = [];
        payload.items.forEach((it) => {
          const qty = Number(it.quantity) || 1;
          for (let i = 0; i < qty; i++) {
            orderItems.push({
              item: it.item || it.name,
              price: Number(it.price) || 0,
              shop: it.shop || payload.shopName,
              shopId: it.shopId || payload.shopId,
            });
          }
        });

        const response = await api.post("/food/order", {
          items: orderItems,
          orderType: payload.orderType || "daytime",
        });

        bookingId = response.data?.[0]?._id || "Food Order Placed";
        followUpText = `🎉 Excellent! Your food order has been placed successfully. Order ID: **${bookingId}**. You can track it on the My Bookings page! 🍕`;

      } else if (payload.category === "barber") {
        // Barber Slot Booking
        const response = await api.post("/barber/book", {
          slot: payload.slot,
          bookingDate: payload.bookingDate,
          shopId: payload.shopId,
        });

        bookingId = response.data?._id || "Barber Booking Confirmed";
        followUpText = `🎉 Awesome! Your barber haircut slot at **${payload.slot}** on **${payload.bookingDate}** is booked! Booking ID: **${bookingId}**. See you there! 💇‍♂️`;

      } else if (payload.category === "laundry") {
        // Laundry Service booking
        const bookingItems = payload.items.map((it) => ({
          itemId: it.itemId,
          quantity: Number(it.quantity) || 1,
        }));

        const response = await api.post("/laundry/book", {
          shopId: payload.shopId,
          items: bookingItems,
          pickupDate: payload.pickupDate,
          pickupTime: payload.pickupTime,
          deliveryOption: payload.deliveryOption || "standard",
          serviceType: payload.serviceType || "laundry",
        });

        bookingId = response.data?._id || "Laundry Booking Confirmed";
        followUpText = `🎉 Wonderful! Your laundry service request has been submitted. Booking ID: **${bookingId}**. Total Amount: **₹${response.data?.totalAmount || "..."}**. 🧺`;
      }

      // Update proposal state to success and append a follow up AI message turn
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[msgIndex]) {
          updated[msgIndex] = {
            ...updated[msgIndex],
            proposal: {
              ...updated[msgIndex].proposal,
              status: "success",
              placedId: bookingId,
            },
          };
        }
        return [
          ...updated,
          {
            role: "model",
            content: followUpText,
          },
        ];
      });

    } catch (err) {
      const errMsg =
        err.response?.data?.message || "Failed to place order/booking. Please try again.";
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[msgIndex]) {
          updated[msgIndex] = {
            ...updated[msgIndex],
            proposal: {
              ...updated[msgIndex].proposal,
              status: "error",
              errorMsg: errMsg,
            },
          };
        }
        return updated;
      });
    }
  };

  // ── Render Proposal Confirmation Card ────────────────────────────────────────
  const renderProposalCard = (proposal, index) => {
    const { payload, status, errorMsg, placedId } = proposal;
    const isPlaced = status === "success";
    const isLoading = status === "loading";
    const isError = status === "error";

    let headerBg = "linear-gradient(135deg, #f59e0b, #d97706)"; // Food default
    let icon = "🍔";
    let title = "Confirm Canteen Order";
    let placeText = "Place Food Order";

    if (payload.category === "barber") {
      headerBg = "linear-gradient(135deg, #3b82f6, #1d4ed8)";
      icon = "💇‍♂️";
      title = "Confirm Barber Booking";
      placeText = "Book Haircut Slot";
    } else if (payload.category === "laundry") {
      headerBg = "linear-gradient(135deg, #10b981, #047857)";
      icon = "🧺";
      title = "Confirm Laundry Booking";
      placeText = "Submit Laundry Request";
    }

    return (
      <div className="ai-proposal-card">
        {/* Header */}
        <div className="ai-card-header" style={{ background: headerBg }}>
          <span className="ai-card-icon">{icon}</span>
          <span className="ai-card-title">{title}</span>
        </div>

        {/* Body */}
        <div className="ai-card-body">
          <div className="ai-card-shop">{payload.shopName}</div>

          {/* Details based on category */}
          {payload.category === "canteen" && (
            <div className="ai-card-details">
              <div className="ai-item-list">
                {payload.items.map((it, idx) => (
                  <div key={idx} className="ai-item-row">
                    <span>{it.quantity}x {it.item || it.name}</span>
                    <span>₹{it.price * it.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="ai-card-divider" />
              <div className="ai-total-row">
                <span>Total Amount</span>
                <span>₹{payload.items.reduce((sum, it) => sum + (it.price * it.quantity), 0)}</span>
              </div>
            </div>
          )}

          {payload.category === "barber" && (
            <div className="ai-card-details">
              <div className="ai-detail-row">
                <span className="label">Date:</span>
                <span className="value">{payload.bookingDate}</span>
              </div>
              <div className="ai-detail-row">
                <span className="label">Slot Time:</span>
                <span className="value font-semibold">{payload.slot}</span>
              </div>
            </div>
          )}

          {payload.category === "laundry" && (
            <div className="ai-card-details">
              <div className="ai-item-list">
                {payload.items.map((it, idx) => (
                  <div key={idx} className="ai-item-row">
                    <span>{it.quantity}x {it.name} ({it.category || 'wash'})</span>
                    <span>₹{it.price * it.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="ai-card-divider" />
              {payload.pickupDate && (
                <div className="ai-detail-row">
                  <span className="label">Pickup Date:</span>
                  <span className="value">{payload.pickupDate}</span>
                </div>
              )}
              {payload.pickupTime && (
                <div className="ai-detail-row">
                  <span className="label">Pickup Time:</span>
                  <span className="value">{payload.pickupTime}</span>
                </div>
              )}
              <div className="ai-detail-row">
                <span className="label">Delivery Speed:</span>
                <span className="value uppercase text-xs tracking-wider font-bold">
                  {payload.deliveryOption || 'standard'}
                </span>
              </div>
              <div className="ai-card-divider" />
              <div className="ai-total-row">
                <span>Estimated Total</span>
                <span>
                  ₹{payload.items.reduce((sum, it) => sum + (it.price * it.quantity), 0) + 
                    (payload.deliveryOption === "express" ? 25 : 0)}
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {status === "pending" && (
            <div className="ai-card-actions">
              <button 
                className="ai-btn-confirm" 
                onClick={() => executePlacement(payload, index)}
              >
                {placeText}
              </button>
              <button 
                className="ai-btn-cancel" 
                onClick={() => {
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[index] = {
                      ...updated[index],
                      proposal: null, // Hide card
                    };
                    return updated;
                  });
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {isLoading && (
            <div className="ai-card-status loading">
              <div className="spinner" />
              <span>Processing with shop...</span>
            </div>
          )}

          {isPlaced && (
            <div className="ai-card-status success">
              <span>✅ Confirmed & Placed!</span>
              <span className="id-badge">ID: {placedId}</span>
            </div>
          )}

          {isError && (
            <div className="ai-card-status error-state">
              <span>❌ Booking Failed</span>
              <p className="error-msg">{errorMsg}</p>
              <button 
                className="ai-btn-retry" 
                onClick={() => executePlacement(payload, index)}
              >
                Retry Request
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Send on Enter key (Shift+Enter = new line)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── STYLES ── */}
      <style>{`
        /* Floating Bot Button */
        .ai-fab {
          position: fixed;
          bottom: 28px;
          right: 28px;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(99,102,241,0.5);
          transition: transform 0.2s, box-shadow 0.2s;
          z-index: 9999;
        }
        .ai-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 28px rgba(99,102,241,0.65);
        }
        .ai-fab svg { color: white; }

        /* Pulse animation on the button */
        .ai-fab::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: rgba(99,102,241,0.4);
          animation: ai-pulse 2.5s ease-out infinite;
          z-index: -1;
        }
        @keyframes ai-pulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        /* Chat Window */
        .ai-window {
          position: fixed;
          bottom: 98px;
          right: 28px;
          width: 340px;
          height: 460px;
          border-radius: 20px;
          background: #0f0f1a;
          border: 1px solid rgba(99,102,241,0.3);
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 9998;
          animation: ai-slide-up 0.25s cubic-bezier(.16,1,.3,1);
        }
        @keyframes ai-slide-up {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }

        /* Header */
        .ai-header {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ai-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          font-weight: 700;
          font-size: 15px;
        }
        .ai-header-dot {
          width: 9px; height: 9px;
          background: #4ade80;
          border-radius: 50%;
          animation: blink 1.5s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        .ai-close-btn {
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 8px;
          width: 28px; height: 28px;
          cursor: pointer;
          color: white;
          font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s;
        }
        .ai-close-btn:hover { background: rgba(255,255,255,0.28); }

        /* Message List */
        .ai-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          scrollbar-width: thin;
          scrollbar-color: #6366f1 transparent;
        }

        /* Individual Message Bubble */
        .ai-bubble {
          max-width: 82%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 13.5px;
          line-height: 1.5;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .ai-bubble.user {
          align-self: flex-end;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .ai-bubble.model {
          align-self: flex-start;
          background: #1e1e35;
          color: #e2e8f0;
          border-bottom-left-radius: 4px;
        }

        /* Typing Indicator (3 animated dots) */
        .ai-typing {
          align-self: flex-start;
          background: #1e1e35;
          padding: 12px 16px;
          border-radius: 16px;
          border-bottom-left-radius: 4px;
          display: flex;
          gap: 5px;
        }
        .ai-typing span {
          width: 7px; height: 7px;
          background: #8b5cf6;
          border-radius: 50%;
          animation: bounce 1.2s infinite;
        }
        .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%            { transform: translateY(-7px); }
        }

        /* Error Banner */
        .ai-error {
          margin: 0 12px;
          padding: 8px 12px;
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.35);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 12.5px;
        }

        /* Input Area */
        .ai-input-area {
          padding: 12px;
          background: #0a0a14;
          border-top: 1px solid rgba(99,102,241,0.18);
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }
        .ai-textarea {
          flex: 1;
          background: #1e1e35;
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 12px;
          padding: 10px 14px;
          color: #e2e8f0;
          font-size: 13.5px;
          resize: none;
          outline: none;
          max-height: 100px;
          font-family: inherit;
          line-height: 1.5;
          transition: border-color 0.2s;
        }
        .ai-textarea:focus { border-color: #6366f1; }
        .ai-textarea::placeholder { color: #4a4a70; }
        .ai-send-btn {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: opacity 0.2s, transform 0.15s;
        }
        .ai-send-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .ai-send-btn:not(:disabled):hover { transform: scale(1.08); }
        .ai-send-btn svg { color: white; }

        /* RAG Badge */
        .ai-rag-badge {
          text-align: center;
          font-size: 10px;
          color: #4a4a70;
          padding: 4px 0 2px;
          letter-spacing: 0.04em;
        }

        /* Interactive Proposal Cards */
        .ai-message-turn {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ai-proposal-card {
          margin: 4px 10px 12px 10px;
          border-radius: 16px;
          background: #16162a;
          border: 1px solid rgba(99, 102, 241, 0.25);
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          animation: card-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes card-slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ai-card-header {
          padding: 8px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: white;
          font-weight: 700;
          font-size: 13px;
        }
        .ai-card-icon {
          font-size: 15px;
        }
        .ai-card-title {
          letter-spacing: 0.02em;
        }
        .ai-card-body {
          padding: 12px 14px;
        }
        .ai-card-shop {
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 8px;
        }
        .ai-card-details {
          background: #0c0c16;
          border-radius: 10px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ai-item-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ai-item-row {
          display: flex;
          justify-content: space-between;
          font-size: 12.5px;
          color: #cbd5e1;
        }
        .ai-card-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 4px 0;
        }
        .ai-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 700;
          color: #38bdf8;
        }
        .ai-detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 12.5px;
          color: #cbd5e1;
        }
        .ai-detail-row .label {
          color: #64748b;
        }
        .ai-detail-row .value {
          color: #f1f5f9;
        }
        .ai-card-actions {
          margin-top: 12px;
          display: flex;
          gap: 8px;
        }
        .ai-btn-confirm {
          flex: 2;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          color: white;
          padding: 8px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.15s, opacity 0.15s;
        }
        .ai-btn-confirm:hover {
          transform: translateY(-1px);
        }
        .ai-btn-cancel {
          flex: 1;
          background: #272740;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          padding: 8px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ai-btn-cancel:hover {
          background: #2f2f4c;
          color: #f1f5f9;
        }
        .ai-card-status {
          margin-top: 10px;
          padding: 8px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 12.5px;
          font-weight: 700;
        }
        .ai-card-status.loading {
          background: rgba(99, 102, 241, 0.08);
          color: #a5b4fc;
          display: flex;
          flex-direction: row;
          gap: 8px;
        }
        .ai-card-status.success {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #34d399;
        }
        .ai-card-status.success .id-badge {
          font-size: 10.5px;
          color: #6ee7b7;
          background: rgba(16, 185, 129, 0.15);
          padding: 2px 6px;
          border-radius: 6px;
          font-family: monospace;
          margin-top: 2px;
        }
        .ai-card-status.error-state {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
        }
        .ai-card-status.error-state .error-msg {
          font-size: 11.5px;
          color: #fca5a5;
          font-weight: 400;
          text-align: center;
          margin: 2px 0 6px 0;
        }
        .ai-btn-retry {
          background: #3b1f22;
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 11px;
          cursor: pointer;
        }
        .ai-btn-retry:hover {
          background: #4f282c;
        }

        /* Spinner for loading */
        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(165, 180, 252, 0.3);
          border-top-color: #a5b4fc;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── FLOATING BUTTON ── */}
      <button
        className="ai-fab"
        onClick={() => setIsOpen((v) => !v)}
        title="Ask CampusEase AI"
        aria-label="Open AI Chat"
      >
        {isOpen ? (
          // X icon when open
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          // Sparkle/Bot icon when closed
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1H1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            <circle cx="9" cy="13" r="1" fill="currentColor"/>
            <circle cx="15" cy="13" r="1" fill="currentColor"/>
          </svg>
        )}
      </button>

      {/* ── CHAT WINDOW ── */}
      {isOpen && (
        <div className="ai-window" role="dialog" aria-label="CampusEase AI Chat">
          {/* Header */}
          <div className="ai-header">
            <div className="ai-header-title">
              <div className="ai-header-dot" />
              <span>CampusEase AI</span>
            </div>
            <button
              className="ai-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* RAG Badge */}
          <div className="ai-rag-badge">⚡ Powered by RAG + Gemini 2.0 Flash</div>

          {/* Messages */}
          <div className="ai-messages" role="log" aria-live="polite">
            {messages.map((msg, i) => (
              <div key={i} className="ai-message-turn">
                <div className={`ai-bubble ${msg.role}`}>
                  {msg.content}
                </div>
                {msg.proposal && renderProposalCard(msg.proposal, i)}
              </div>
            ))}

            {/* Typing indicator — shown while waiting for AI */}
            {isLoading && (
              <div className="ai-typing" aria-label="AI is typing">
                <span/><span/><span/>
              </div>
            )}

            {/* Error message */}
            {error && <div className="ai-error">⚠ {error}</div>}

            {/* Invisible div to scroll to */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ai-input-area">
            <textarea
              className="ai-textarea"
              placeholder="Ask about food, barber slots, laundry..."
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              aria-label="Message input"
            />
            <button
              className="ai-send-btn"
              onClick={sendMessage}
              disabled={!inputText.trim() || isLoading}
              aria-label="Send message"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
