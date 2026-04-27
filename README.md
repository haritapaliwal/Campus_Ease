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
- [AI Chatbot — How RAG Works](#ai-chatbot--how-rag-works)
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

## AI Chatbot — How RAG Works

The chatbot uses a custom **Retrieval-Augmented Generation (RAG)** pipeline — no third-party vector database required.

### Phase 1 — Indexing (on server startup)
1. Fetches all active shops from MongoDB
2. Converts each shop's data (menu, slots, catalog) into a human-readable text chunk
3. Calls the **Gemini Embedding API** to convert each chunk into a 768-dimensional vector
4. Stores `{ text, vector, shopId }` in the `EmbeddingDoc` MongoDB collection

### Phase 2 — Retrieval (on user question)
1. Embeds the user's question using the `RETRIEVAL_QUERY` task type
2. Loads all stored document vectors from MongoDB
3. Computes **cosine similarity** between the query vector and every document vector
4. Returns the top-3 most semantically relevant chunks

### Phase 3 — Generation (Groq / LLaMA 3)
1. Injects the retrieved chunks as context into a prompt
2. Sends to **Groq's LLaMA 3** API for fast, accurate answer generation
3. Streams the response back to the user in the chat UI

This approach means the AI actually *knows* what's on the canteen menu today, which barber slots are open, and what the laundry pricing is — without any hallucination.

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
