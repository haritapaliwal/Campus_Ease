# 🎓 Campus Ease

> A full-stack campus services platform that lets students order food, book barber appointments, and schedule laundry — all in one place — powered by an AI assistant built with RAG (Retrieval-Augmented Generation).

**Live Demo:** [campus-ease-frontend-i3bz.onrender.com](https://campus-ease-frontend-i3bz.onrender.com)

### 🔐 Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | admin@campusease.com | Admin@123 |

> Login as Admin to explore the full admin dashboard, manage shops, and view all users.

---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [AI Chatbot — How RAG & Action Placement Work](#ai-chatbot--how-rag--action-placement-work)
- [User Roles](#user-roles)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)

---

## Overview

Campus Ease is a MERN stack web application designed to streamline on-campus services. Students can browse canteen menus and place food orders, book time slots at the campus barber, and schedule laundry pickups — all without waiting in queues.

Shop owners get a dedicated dashboard to manage their menus, slots, and incoming orders in real time. A super-admin panel oversees all shops and users across the platform.

The platform also features an **AI-powered chatbot** that answers natural language questions about available campus services (e.g., *"Which canteen has Dosa?"*, *"Are there any barber slots available today?"*) using a custom-built RAG pipeline with Google Gemini embeddings.

---

## Features

### 👨‍🎓 For Students
- 🍽️ **Food Ordering** — Browse menus from multiple campus canteens and place orders
- ✂️ **Barber Booking** — View available time slots and book appointments
- 👕 **Laundry Scheduling** — Select laundry, dry clean, or iron services and schedule pickup
- 📋 **My Bookings** — View and track all past and upcoming bookings in one place
- 🤖 **AI Chatbot** — Ask natural language questions about any campus service

### 🏪 For Shop Owners
- 📊 **Dashboard** — Manage shop info, menu items, pricing, and time slots
- 📦 **Order Management** — View and fulfill incoming student orders
- 🕐 **Slot Management** — Enable or disable booking slots dynamically

### 🛡️ For Admins
- 👥 **User Management** — View all registered students and shop owners
- 🏬 **Shop Oversight** — Monitor all active shops across all categories
- ⚙️ **Platform Control** — Manage shop status (active/inactive)

### 🚀 Advanced AI & System Features
- 🤖 **Interactive AI-Driven Orders & Bookings** — Custom interactive confirmation cards are rendered directly inside the chatbot window for canteen orders, barber bookings, and laundry pickups, enabling students to review details and place requests with a single click.
- 💬 **Conversational Action Execution** — Powered by a unified cognitive LLM engine that parses user intent and allows users to confirm bookings or orders conversationally (e.g., *"yes"*, *"confirm"*, *"go ahead"*) or cancel them instantly.
- ⚙️ **Robust Server-Side DB Resolver** — Automatically translates conversational text mentions of shops and items into their actual MongoDB `ObjectIds` and exact catalog prices, eliminating database reference exceptions and ensuring complete pricing security.
- 🔍 **Hybrid Vector Search Space** — Features programmatic initialization of a MongoDB Atlas Vector Search index (`vector_index`), automatically falling back to high-precision in-memory cosine similarity search when running in local development environments.
- 📦 **Automated Multi-Shop Routing** — Correctly groups and splits food order items by their respective canteens under the hood, ensuring separate shop dashboards receive only their corresponding orders.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS v4, Framer Motion |
| **Backend** | Node.js, Express.js (ES Modules) |
| **Database** | MongoDB Atlas (Mongoose ODM) |
| **Authentication** | JWT via HttpOnly cookies (`bcryptjs` for password hashing) |
| **AI / LLM** | Groq API (LLaMA 3) for chat generation |
| **AI / Embeddings** | Google Gemini Embedding API (`gemini-embedding-001`) |
| **HTTP Client** | Axios (with credentials for cookie-based auth) |
| **Notifications** | Sonner (toast notifications) |
| **Dev Tools** | Nodemon, Vite HMR |
| **Deployment** | Render (frontend + backend), MongoDB Atlas |

---

## Architecture

```
┌─────────────────────────────────────┐
│           React Frontend            │
│  (Vite + React Router + Tailwind)   │
│                                     │
│  Pages: Home, Food, Barber,         │
│         Laundry, MyBookings,        │
│         ShopOwner, Admin, Auth      │
│                                     │
│  Auth: HttpOnly Cookie (JWT)        │
│  API: Axios with withCredentials    │
└────────────┬────────────────────────┘
             │  HTTPS REST API
             ▼
┌─────────────────────────────────────┐
│         Express.js Backend          │
│                                     │
│  Routes: /api/auth  /api/food       │
│          /api/barber /api/laundry   │
│          /api/shop  /api/admin      │
│          /api/ai                    │
│                                     │
│  Middleware: CORS, cookieParser,    │
│             JWT auth guard          │
└──────┬────────────────┬─────────────┘
       │                │
       ▼                ▼
┌─────────────┐  ┌──────────────────────┐
│ MongoDB     │  │  AI Services         │
│ Atlas       │  │                      │
│             │  │  Groq API            │
│  Users      │  │  (LLaMA 3 chat)      │
│  Shops      │  │                      │
│  Orders     │  │  Gemini Embeddings   │
│  Bookings   │  │  (RAG vector store)  │
│  Embeddings │  │                      │
└─────────────┘  └──────────────────────┘
```

---

## AI Chatbot — How RAG & Action Placement Work

The chatbot uses a custom **Retrieval-Augmented Generation (RAG)** pipeline integrated with an interactive action-placement protocol and a server-side DB resolver.

### Phase 1 — Indexing (on server startup)
1. **DB Context Extraction**: Fetches all active shops from MongoDB.
2. **Chunk Generation**: Converts each shop's data (menus, slots, laundry catalog) into human-readable text chunks.
3. **Vector Embedding**: Calls the **Gemini Embedding API** (`gemini-embedding-001`) with `outputDimensionality: 768` to convert each chunk into a 768-dimensional vector.
4. **Vector Store**: Programmatically checks and indexes the search space using native **MongoDB Atlas Vector Search** (`vector_index`), storing the payload in the `EmbeddingDoc` collection.

### Phase 2 — Hybrid Retrieval (on user question)
1. **Query Embedding**: Embeds the user's question using the `RETRIEVAL_QUERY` task type.
2. **Atlas Vector Search**: Executes high-speed semantic retrieval using native MongoDB `$vectorSearch` aggregation to obtain closest neighbors.
3. **Local Cosine Fallback**: Automatically falls back to high-precision in-memory cosine similarity calculation over all stored embeddings if running in a non-Atlas environment.
4. Returns the top-3 most semantically relevant chunks.

### Phase 3 — Unified Cognitive Generation (Groq / LLaMA 3)
1. **Context & Live Catalog Injection**: Injects the retrieved chunks along with the live inventory catalog as system context into the conversation history prompt.
2. **Intent Classification & Proposal Output**: Calls **Groq's LLaMA 3** (`llama-3.3-70b-versatile`) in JSON mode to output a conversational reply, user intent classification (`canteen` | `barber` | `laundry` | `cancel` | `chat`), and structured order/booking parameters (`proposal`).
3. **DB Resolver Interface**: Intercepts proposal-bearing replies on the server side to resolve colloquial text shop/item names to exact MongoDB `ObjectIds` and catalog prices, maintaining complete data and transaction security.
4. **Interactive Cards & Placement Execution**:
   - For queries asking about services: Displays an interactive, custom-themed proposal card directly in the chat UI.
   - For confirmations (e.g., *"yes"*, *"confirm"*): Renders the card, marks `executePlacement` as true, and invokes corresponding shop order/booking REST APIs automatically.
   - Updates the card dynamically on the frontend through loading, error/retry, and success states while returning the final confirmation IDs.

---

## User Roles

| Role | Access |
|---|---|
| `customer` | Home, Food, Barber, Laundry, My Bookings, AI Chatbot |
| `shop_owner` | Shop Owner Dashboard (own shop only) |
| `admin` | Admin Dashboard (all shops and users) |

Role-based routing is enforced on both the frontend (React Router guards) and backend (JWT middleware).

---

## API Endpoints

### Auth — `/api/auth`
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/signup` | Register a new student account (sets auth cookie) |
| `POST` | `/login` | Login and receive auth cookie |
| `POST` | `/logout` | Clear the auth cookie |

### Food — `/api/food`
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/shops` | Get all active canteen shops |
| `POST` | `/order` | Place a food order |
| `GET` | `/orders` | Get orders for the logged-in user |

### Barber — `/api/barber`
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/shops` | Get all barber shops with slot availability |
| `POST` | `/book` | Book a barber time slot |
| `GET` | `/bookings` | Get barber bookings for the logged-in user |

### Laundry — `/api/laundry`
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/shops` | Get all laundry shops with catalog |
| `POST` | `/book` | Schedule a laundry pickup |
| `GET` | `/bookings` | Get laundry bookings for the logged-in user |

### AI — `/api/ai`
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Send a message to the AI chatbot (RAG-powered) |

### Shop Owner — `/api/shop`
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/my-shop` | Get own shop details |
| `PUT` | `/update` | Update menu/slots/catalog |
| `GET` | `/orders` | View incoming orders |
| `PUT` | `/order/:id` | Update order status |

### Admin — `/api/admin`
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users` | List all users |
| `GET` | `/shops` | List all shops |
| `PUT` | `/shop/:id/status` | Toggle shop active/inactive |

---

## Project Structure

```
Campus_Ease/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── api.jsx             # Axios instance with cookie credentials
│   │   ├── App.jsx             # Routes & role-based navigation
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Global auth state (role, login, logout)
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── AIChatBot.jsx   # Floating AI chat widget
│   │   └── pages/
│   │       ├── HomePage.jsx
│   │       ├── FoodPage.jsx
│   │       ├── BarberPage.jsx
│   │       ├── LaundryPage.jsx
│   │       ├── MyBookings.jsx
│   │       ├── LoginPage.jsx
│   │       ├── SignupPage.jsx
│   │       ├── admin/
│   │       │   └── AdminDashboard.jsx
│   │       └── shopOwner/
│   │           └── ShopOwnerDashboard.jsx
│   └── .env                    # VITE_API_URL
│
└── server/                     # Node.js + Express backend
    ├── server.js               # App entry point, CORS, routes
    ├── config/
    │   └── db.js               # MongoDB connection
    ├── models/
    │   ├── User.js
    │   ├── Shop.js
    │   ├── Order.js
    │   ├── BarberBooking.js
    │   ├── LaundryBooking.js
    │   ├── SlotCounter.js
    │   └── EmbeddingDoc.js     # RAG vector storage
    ├── routes/
    │   ├── authRoutes.js
    │   ├── foodRoutes.js
    │   ├── barberRoutes.js
    │   ├── laundryRoutes.js
    │   ├── shopRoutes.js
    │   ├── superAdminRoutes.js
    │   └── aiRoutes.js         # RAG chat endpoint
    ├── services/
    │   └── ragService.js       # Full RAG pipeline (index + retrieve)
    ├── middleware/
    └── .env                    # Secrets (not committed)
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- A MongoDB Atlas cluster
- A Groq API key (free at [console.groq.com](https://console.groq.com))
- *(Optional)* A Google Gemini API key for the AI chatbot

### 1. Clone the repository
```bash
git clone https://github.com/your-username/Campus_Ease.git
cd Campus_Ease
```

### 2. Install dependencies
```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 3. Configure environment variables

Create `server/.env`:
```env
PORT=5000
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key   # optional, enables AI chatbot
FRONTEND_URL=http://localhost:5173
```

Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000
```

### 4. Run the development servers
```bash
# In one terminal — backend
cd server && npm run dev

# In another terminal — frontend
cd client && npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

| Variable | Location | Description |
|---|---|---|
| `MONGO_URI` | `server/.env` | MongoDB Atlas connection string |
| `JWT_SECRET` | `server/.env` | Secret key for signing JWTs |
| `GROQ_API_KEY` | `server/.env` | Groq API key for LLaMA 3 chat |
| `GEMINI_API_KEY` | `server/.env` | Google Gemini key for embeddings (RAG) |
| `FRONTEND_URL` | `server/.env` | Allowed CORS origin for the frontend |
| `PORT` | `server/.env` | Backend server port (default: 5000) |
| `VITE_API_URL` | `client/.env` | Backend API base URL for the frontend |

> ⚠️ **Never commit `.env` files.** They are listed in `.gitignore`.

---

## License

MIT
