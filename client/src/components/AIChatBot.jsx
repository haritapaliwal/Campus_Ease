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
 * The FULL array is sent every time — this gives the AI conversation memory.
 * =============================================================================
 */

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
    const newMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInputText("");
    setIsLoading(true);

    try {
      // 2. Send full conversation history to the backend
      //    The backend will:
      //      a) Extract last user message as query
      //      b) Run RAG retrieval (embed query → cosine similarity → top-3 chunks)
      //      c) Call Gemini Flash with context + history
      //      d) Return { reply: "..." }
      const response = await api.post("/ai/chat", { messages: newMessages });
      const aiReply = response.data.reply;

      // 3. Add AI response to conversation history
      setMessages((prev) => [...prev, { role: "model", content: aiReply }]);
    } catch (err) {
      const errMsg =
        err.response?.data?.message || "Something went wrong. Please try again.";
      setError(errMsg);
      // Don't add failed response to message history
    } finally {
      setIsLoading(false);
    }
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
              <div key={i} className={`ai-bubble ${msg.role}`}>
                {msg.content}
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
