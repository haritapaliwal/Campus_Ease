# Campus Ease Project Flow and Interview Guide

This document explains the Campus Ease project end to end: how the app starts, where requests enter, how API calls move through the system, how each feature lives from UI action to database update, and what every project file is responsible for.

Use this as your interview preparation guide. If someone asks "what happens when the user clicks this?", trace the relevant lifecycle section.

---

## 1. One-Minute Project Summary

Campus Ease is a full-stack campus services platform. Students can:

- Browse and order food from campus canteens.
- Book barber appointments by date, shop, and time slot.
- Book laundry, dry-clean, or ironing services.
- View recent orders and bookings.
- Ask an AI chatbot questions about campus food, barber, and laundry services.

Admins can create and delete shops and owners, and view platform revenue. Shop owners can manage their own menu, slots, laundry catalog, and incoming customer orders/bookings.

The stack is:

- Frontend: React 18, Vite, React Router, Tailwind CSS, Axios, Sonner.
- Backend: Node.js, Express, Mongoose, JWT, bcrypt, cookie-parser, CORS.
- Database: MongoDB.
- AI: Gemini embeddings for retrieval, Groq Llama chat completion for answer generation.

---

## 2. Runtime Architecture

At runtime the application has four main layers:

```txt
Browser
  |
  | React pages/components
  | Axios instance from client/src/api.jsx
  v
Express API server
  |
  | Feature routers mounted in server/server.js
  | Auth middleware checks JWT cookie
  v
MongoDB collections
  |
  | User, Shop, Order, BarberBooking,
  | LaundryBooking, SlotCounter, EmbeddingDoc
  v
External AI providers
  |
  | Gemini: embeddings
  | Groq: chat response generation
```

Important idea: the browser never talks to MongoDB directly. It only talks to Express API endpoints. Express validates the request, runs middleware, calls Mongoose models, and returns JSON.

---

## 3. Main Entry Points

### Frontend entry point

The frontend starts from:

```txt
client/index.html
  -> client/src/index.jsx
  -> client/src/App.jsx
```

`client/index.html` contains:

```html
<div id="root"></div>
<script type="module" src="/src/index.jsx"></script>
```

That means Vite loads `src/index.jsx`. Then React renders `App` into the `root` element.

`client/src/index.jsx` does three important things:

```jsx
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Toaster richColors position="top-right" />
  </React.StrictMode>
);
```

- Mounts the React app.
- Enables React strict checks during development.
- Adds the global `Sonner` toast system.

### Backend entry point

The backend starts from:

```txt
server/server.js
```

Root scripts can start it:

```json
"start:server": "node server/server.js",
"dev:server": "nodemon server/server.js"
```

The backend entry point does this:

```js
dotenv.config();
const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

connectDB().then(() => {
  buildAndIndexChunks().catch((err) =>
    console.error("RAG indexing failed:", err.message)
  );
});

app.use("/api/auth", authRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/barber", barberRoutes);
app.use("/api/laundry", laundryRoutes);
app.use("/api/admin", superAdminRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/ai", aiRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

So the server lifecycle is:

1. Load `.env`.
2. Create Express app.
3. Configure CORS.
4. Enable JSON request body parsing.
5. Enable cookie parsing.
6. Connect to MongoDB.
7. Start RAG indexing after DB connection.
8. Mount route modules under `/api/...`.
9. Listen on the configured port.

---

## 4. How Requests Travel Through the App

The basic request flow is:

```txt
User action in React page
  -> calls api.get/post/put/delete(...)
  -> api.jsx prefixes request with backend base URL + /api
  -> Express receives request
  -> route module handles matching endpoint
  -> authMiddleware runs if route is protected
  -> Mongoose model reads/writes MongoDB
  -> Express returns JSON
  -> React updates component state
  -> UI rerenders
```

Example: placing a food order:

```txt
FoodPage.jsx
  confirmOrder()
  api.post("/food/order", { items: cart, orderType })
    |
    v
POST /api/food/order
  foodRoutes.js
  authMiddleware checks JWT
  items grouped by shop
  Order.create(...) for each shop group
    |
    v
MongoDB orders collection
    |
    v
JSON response to React
    |
    v
FoodPage clears cart and shows success dialog
```

---

## 5. Authentication and Authorization Flow

Authentication is based on JWT stored in an HttpOnly cookie named `token`.

### Signup flow

Frontend:

```txt
SignupPage.jsx
  -> validate studentId, email, password
  -> api.post("/auth/signup", { studentId, email, password })
```

Backend:

```txt
POST /api/auth/signup
  -> hash password with bcrypt
  -> create User with role "customer"
  -> sign JWT with id, role, shopId
  -> set HttpOnly cookie
  -> return { id, role }
```

Important code:

```js
const hashed = await bcrypt.hash(password, 10);
const user = await User.create({
  studentId,
  email,
  passwordHash: hashed,
  role: "customer",
});

const token = jwt.sign(
  { id: user._id, role: user.role, shopId: null },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);
```

The frontend then calls:

```js
login(null, res.data.role, res.data.shopId ?? null);
```

This saves the role in localStorage and updates React auth state.

### Login flow

Frontend:

```txt
LoginPage.jsx
  -> validates email/password
  -> user selects customer/shop_owner/admin
  -> api.post("/auth/login", { email, password })
  -> verifies returned role matches selected role
  -> stores role and shopId in AuthContext/localStorage
  -> navigates to correct dashboard
```

Backend:

```txt
POST /api/auth/login
  -> find user by email
  -> compare password using bcrypt.compare
  -> sign JWT with id, role, shopId
  -> set cookie
  -> return role and shopId
```

### Auth middleware

Protected routes use `server/middleware/authMiddleware.js`.

```js
const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

if (!token) return res.status(401).json({ message: "Unauthorized" });

const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded.id;
req.userRole = decoded.role;
next();
```

It supports two token sources:

- `req.cookies.token`: main app behavior.
- `Authorization: Bearer ...`: backward compatibility.

### Role authorization

The helper:

```js
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        message: `Role ${req.userRole} is not authorized to access this route.`,
      });
    }
    next();
  };
};
```

Examples:

- Admin routes use `authorizeRoles("admin")`.
- Shop-owner routes use `authorizeRoles("shop_owner")`.

### Frontend protected routing

`ProtectedRoute.jsx` protects pages by role:

```jsx
if (!token) {
  return <Navigate to="/login" replace />;
}

if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
  return <Navigate to="/" replace />;
}
```

The frontend prevents casual navigation to forbidden pages, but the backend is the real security layer.

---

## 6. Data Model Explanation

### User model

File: `server/models/User.js`

Stores login identity and role.

Fields:

- `studentId`: optional student identifier. Unique only when present.
- `email`: required and unique.
- `passwordHash`: bcrypt-hashed password.
- `role`: one of `customer`, `shop_owner`, `admin`.
- `shopId`: reference to the shop owned by a shop owner.

Important index:

```js
userSchema.index({ studentId: 1 }, { unique: true, sparse: true });
```

Sparse unique means multiple users can have no studentId, but if a studentId exists, it must be unique.

### Shop model

File: `server/models/Shop.js`

Represents a campus service provider.

Fields:

- `name`: shop name.
- `category`: `canteen`, `laundry`, or `barber`.
- `status`: `active` or `inactive`.
- `ownerId`: User reference for the shop owner.
- `menu`: canteen items as `{ item, price }`.
- `slots`: barber/laundry time slots as `{ time, isBookable }`.
- `laundryCatalog`: categorized laundry items:
  - `laundry`
  - `dryclean`
  - `iron`

One model supports all shop categories. Category controls which fields are used.

### Order model

File: `server/models/Order.js`

Stores canteen food orders.

Fields:

- `userId`: customer reference.
- `shopId`: canteen shop reference.
- `items`: ordered food items.
- `orderType`: `daytime` or `night`.
- `status`: starts as `pending`.
- `deliveredAt`: set when completed.
- timestamps: `createdAt`, `updatedAt`.

Food order lifecycle:

```txt
pending -> accepted/rejected/prepared/completed
pending -> cancelled
```

The code does not enforce a strict status enum. It trusts route handlers to use expected values.

### BarberBooking model

File: `server/models/BarberBooking.js`

Stores barber appointments.

Fields:

- `userId`
- `shopId`
- `slot`
- `bookingDate`
- `status`, default `booked`
- `deliveredAt`
- timestamps

Barber lifecycle:

```txt
booked -> accepted -> completed
booked -> rejected
booked -> cancelled
```

When barber bookings become terminal (`cancelled`, `rejected`, `completed`), slot capacity is released.

### LaundryBooking model

File: `server/models/LaundryBooking.js`

Stores laundry, dry-clean, and ironing orders.

Fields:

- `userId`
- `shopId`
- `status`
- `items`: normalized item lines with name, category, quantity, price.
- `pickupDate`
- `pickupTime`
- `deliveryOption`: `standard` or `express`.
- `serviceType`: `laundry`, `dryclean`, or `iron`.
- `totalAmount`
- `deliveredAt`
- timestamps

Laundry lifecycle:

```txt
booked -> accepted -> completed
booked -> rejected
booked -> cancelled
```

### SlotCounter model

File: `server/models/SlotCounter.js`

Prevents barber overbooking.

Fields:

- `shopId`
- `slot`
- `bookingDate`
- `count`

Unique compound index:

```js
slotCounterSchema.index(
  { shopId: 1, slot: 1, bookingDate: 1 },
  { unique: true }
);
```

This ensures there is only one counter document for one shop, one slot, one date.

The booking route atomically increments the counter only if it is below capacity:

```js
const counter = await SlotCounter.findOneAndUpdate(
  {
    shopId,
    slot,
    bookingDate: targetDate,
    count: { $lt: SLOT_CAPACITY },
  },
  { $inc: { count: 1 } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
```

This is the main concurrency protection.

### EmbeddingDoc model

File: `server/models/EmbeddingDoc.js`

Acts as a simple vector store for RAG.

Fields:

- `text`: readable shop data chunk.
- `embedding`: array of numbers from Gemini embedding model.
- `category`: canteen/barber/laundry.
- `shopId`: original Shop reference.
- `chunkId`: unique ID so startup indexing updates instead of duplicating.

This collection lets the AI retrieve campus data by semantic similarity.

---

## 7. Feature Lifecycle: Food Ordering

### Frontend lifecycle

File: `client/src/pages/FoodPage.jsx`

When the Food page loads:

```js
useEffect(() => {
  const load = async () => {
    const res = await api.get("/food/shops");
    setShops((res.data || []).map(addMeta));
  };
  load();
}, []);
```

Flow:

1. User opens `/food`.
2. React calls `GET /api/food/shops`.
3. Backend returns canteen shops and menus.
4. User filters by shop/search.
5. User adds items to local `cart`.
6. If not logged in, `AuthPrompt` opens.
7. User chooses `daytime` or `night`.
8. User clicks checkout.
9. Confirmation modal opens.
10. User confirms.
11. Frontend sends `POST /api/food/order`.
12. On success, cart is cleared and success dialog is shown.

Important local states:

- `cart`: selected food items.
- `orderType`: daytime or night.
- `shops`: canteen data from API.
- `recentItems`: last 24-hour order suggestions.
- `showAuthPrompt`, `showOrderConfirm`, `showOrderSuccess`: modal state.

### Backend lifecycle

File: `server/routes/foodRoutes.js`

#### Get canteen shops

```js
router.get("/shops", async (req, res) => {
  const shops = await Shop.find({ category: "canteen" });
  res.json(shops);
});
```

This is public. It does not require login because menus can be browsed before ordering.

#### Place order

```js
router.post("/order", authMiddleware, async (req, res) => {
  const { items, orderType } = req.body;
  ...
});
```

This is protected.

Logic:

1. Validate that `items` is a non-empty array.
2. Group cart items by `item.shop`.
3. For each shop group:
   - find the shop document by name.
   - normalize price to number.
   - create an Order document.
4. Return created order documents.

Why grouping matters:

If the cart contains items from two canteens, each shop receives its own order. This makes the shop owner dashboard simpler because each owner sees only the order relevant to their shop.

#### My orders

```js
router.get("/my-orders", authMiddleware, async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orders = await Order.find({
    userId: req.user,
    createdAt: { $gte: since },
  });
  res.json(orders);
});
```

The My Bookings page and "Order again" section show only recent orders from the last 24 hours.

#### Cancel food order

```js
router.delete("/orders/:id", authMiddleware, async (req, res) => {
  const updated = await Order.findOneAndUpdate(
    { _id: id, userId: req.user },
    { status: "cancelled" },
    { new: true }
  );
});
```

It does not delete the record. It marks the order as cancelled, preserving history.

---

## 8. Feature Lifecycle: Barber Booking

### Frontend lifecycle

File: `client/src/pages/BarberPage.jsx`

When the page loads:

```js
useEffect(() => {
  loadShops();
}, []);
```

`loadShops` calls:

```js
const res = await api.get("/barber/shops");
```

After a shop is selected or date changes:

```js
useEffect(() => {
  if (activeShopId) {
    loadSlots();
  }
}, [selectedDate, activeShopId]);
```

`loadSlots` calls:

```js
api.get(`/barber/slots?date=${dateStr}&shopId=${activeShopId}`);
```

Booking flow:

1. User opens `/barber`.
2. Page loads barber shops.
3. First shop is selected by default.
4. User chooses one of next 7 dates.
5. Frontend fetches available slots for that shop/date.
6. User selects available slot.
7. User clicks "Book Appointment".
8. Frontend sends:

```js
api.post("/barber/book", {
  slot: selectedSlot,
  bookingDate: dateStr,
  shopId: activeShopId,
});
```

9. Backend creates booking if capacity is available.
10. Frontend shows success screen and reloads slots.

### Backend slot availability

File: `server/routes/barberRoutes.js`

Default slots:

```js
const slots = [
  "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM",
  "03:00 PM", "04:00 PM", "05:00 PM"
];
const SLOT_CAPACITY = 3;
```

`GET /api/barber/slots`:

1. Reads `date` and optional `shopId` from query params.
2. Normalizes date to start of day.
3. Finds active bookings for that date.
4. Excludes `cancelled`, `rejected`, and `completed`.
5. Counts bookings by slot.
6. Reads shop-level manual slot settings.
7. Combines default slots and owner-defined slots.
8. Removes manually blocked slots.
9. Removes full slots.
10. Returns available times.

Key rule:

```js
return (bookingCounts[time] || 0) < SLOT_CAPACITY;
```

### Backend booking creation

`POST /api/barber/book`:

1. Requires login.
2. Requires `slot`, `bookingDate`, and `shopId`.
3. Normalizes booking date.
4. Confirms shop exists and is a barber shop.
5. Confirms slot is valid.
6. Confirms owner has not manually blocked the slot.
7. Atomically increments `SlotCounter` if below capacity.
8. Creates `BarberBooking`.
9. Rolls back counter if booking creation fails.

Rollback code:

```js
await SlotCounter.updateOne(
  { shopId, slot, bookingDate: targetDate },
  { $inc: { count: -1 } }
);
```

This prevents the slot count from staying wrong if booking creation fails after counter increment.

### Booking cancellation and slot release

When a user cancels:

```js
booking.status = "cancelled";
await booking.save();

await SlotCounter.updateOne(
  { shopId: booking.shopId, slot: booking.slot, bookingDate: booking.bookingDate },
  { $inc: { count: -1 } }
);
```

When a shop owner rejects or completes a booking, the owner route also decrements the counter if the previous status was active.

---

## 9. Feature Lifecycle: Laundry Booking

### Frontend lifecycle

File: `client/src/pages/LaundryPage.jsx`

When page loads:

1. Default pickup date is set to tomorrow.
2. Laundry shops are fetched:

```js
const res = await api.get("/laundry/shops");
```

3. First shop becomes active.
4. Its `laundryCatalog` becomes the visible catalog.

Main states:

- `currentView`: `home` or `checkout`.
- `selectedService`: laundry/dryclean/iron.
- `laundryShops`: shops from backend.
- `activeShopId`: selected laundry shop.
- `catalog`: active shop catalog.
- `quantities`: item ID to quantity map.
- `pickupDate`, `pickupTime`, `deliveryOption`.

Booking flow:

1. User chooses laundry partner.
2. User chooses service: laundry, dryclean, or iron.
3. App moves from `home` to `checkout`.
4. User increments item quantities.
5. App calculates item count and total.
6. Express adds Rs. 25 for express delivery.
7. User selects pickup date/time and delivery option.
8. User confirms.
9. Frontend sends:

```js
api.post("/laundry/book", {
  shopId: activeShopId,
  items: selectedOrderItems.map((item) => ({
    itemId: item._id,
    quantity: item.quantity,
  })),
  pickupDate,
  pickupTime,
  deliveryOption,
  serviceType: selectedService || "laundry",
});
```

### Backend lifecycle

File: `server/routes/laundryRoutes.js`

`POST /api/laundry/book`:

1. Requires login.
2. Requires at least one item.
3. Finds selected shop, or first laundry shop if `shopId` missing.
4. Builds a `catalogMap` from shop catalog item IDs.
5. Validates each submitted item against the real shop catalog.
6. Ignores unknown item IDs and quantities <= 0.
7. Calculates total on the backend.
8. Adds Rs. 25 if express delivery.
9. Creates `LaundryBooking`.
10. Returns the created booking.

Important security detail:

The frontend sends only `itemId` and `quantity`. The backend fetches actual item name and price from MongoDB:

```js
const entry = catalogMap.get(String(line.itemId));
...
totalAmount += entry.price * qty;
```

That prevents users from changing prices in the browser.

Cancellation:

```js
LaundryBooking.findOneAndUpdate(
  { _id: id, userId: req.user },
  { status: "cancelled" },
  { new: true }
);
```

Like food, it preserves the record and changes status.

---

## 10. Feature Lifecycle: My Bookings

File: `client/src/pages/MyBookings.jsx`

This page combines three backend APIs:

```js
const foodRes = await api.get("/food/my-orders");
const barberRes = await api.get("/barber/my-bookings");
const laundryRes = await api.get("/laundry/my-bookings");
```

Lifecycle:

1. User opens `/my-bookings`.
2. `ProtectedRoute` ensures only logged-in customers can access it.
3. Page fetches recent food, barber, and laundry records.
4. User switches tab between Food, Barber, Laundry.
5. Cards render status, items, dates, and action buttons.
6. Cancel buttons call the relevant DELETE endpoint.
7. After cancellation, `refresh()` reloads all three categories.

Cancel endpoints:

- Food: `DELETE /api/food/orders/:id`
- Barber: `DELETE /api/barber/:id`
- Laundry: `DELETE /api/laundry/:id`

The page does not directly edit MongoDB. It only asks the backend to change status.

---

## 11. Feature Lifecycle: Shop Owner Dashboard

File: `client/src/pages/shopOwner/ShopOwnerDashboard.jsx`

Only users with role `shop_owner` can access `/shop-owner`.

### Loading owner shop

```js
let res = await api.get("/shop/my-shop");
let data = res.data;

if (!data) {
  const storedId = localStorage.getItem("shopId");
  if (storedId) {
    const r2 = await api.get(`/shop/shops/${storedId}`);
    data = r2.data;
  }
}
```

Then bookings/orders are loaded:

```js
const b = await api.get(`/shop/shops/${data._id}/bookings`);
```

### Backend owner protection

File: `server/routes/shopRoutes.js`

All shop routes require owner role:

```js
router.use(authMiddleware, authorizeRoles("shop_owner"));
```

Most shop-specific routes also use `ownerGuard`:

```js
if (!shop.ownerId || String(shop.ownerId) !== String(userId)) {
  return res.status(403).json({ message: "Not authorized for this shop" });
}
```

This ensures a shop owner can only modify their own shop.

### Canteen owner lifecycle

Owner can:

- Add menu item: `POST /api/shop/shops/:shopId/menu`
- Delete menu item: `DELETE /api/shop/shops/:shopId/menu/:itemId`
- View recent food orders: `GET /api/shop/shops/:shopId/bookings`
- Update order status: `PUT /api/shop/shops/:shopId/orders/:orderId`

Status flow for food:

```txt
pending -> accepted -> prepared -> completed
pending -> rejected
```

The owner dashboard groups orders by student and can update all orders from one student group.

### Barber owner lifecycle

Owner can:

- Add slot: `POST /api/shop/shops/:shopId/slots`
- Toggle slot bookable/unbookable: `PUT /api/shop/shops/:shopId/slots/:slotTime`
- Remove slot: `DELETE /api/shop/shops/:shopId/slots/:slotTime`
- See customer appointments.
- Accept, reject, or complete bookings.

The dashboard merges default barber slots and custom slots. Capacity is displayed using active booking counts.

Important owner update endpoint:

```js
router.put("/shops/:shopId/barber/:id", ownerGuard, async (req, res) => {
  const { status } = req.body;
  ...
});
```

If status becomes terminal, the slot counter is decremented.

### Laundry owner lifecycle

Owner can:

- Add catalog items.
- Edit catalog items.
- Delete catalog items.
- View customer bookings.
- Accept, reject, or complete laundry bookings.

Catalog endpoints:

- `POST /api/shop/shops/:shopId/laundry/catalog`
- `PUT /api/shop/shops/:shopId/laundry/catalog/:itemId`
- `DELETE /api/shop/shops/:shopId/laundry/catalog/:itemId`

Booking status endpoint:

- `PUT /api/shop/shops/:shopId/laundry/:id`

---

## 12. Feature Lifecycle: Admin Dashboard

File: `client/src/pages/admin/AdminDashboard.jsx`

Only users with role `admin` can access `/admin`.

### Frontend lifecycle

On mount:

```js
useEffect(() => {
  fetchDashboard();
}, []);
```

Dashboard fetch:

```js
const res = await api.get("/admin/dashboard", {
  headers: { Authorization: `Bearer ${token}` }
});
```

The app already uses cookies, so the manual Authorization header is mostly backward compatibility.

Admin can:

- View total users.
- View total platform revenue.
- View revenue by shop.
- Register new shop and owner.
- Delete shop and linked owner.

### Backend lifecycle

File: `server/routes/superAdminRoutes.js`

All routes require:

```js
router.use(authMiddleware, authorizeRoles("admin"));
```

#### Dashboard endpoint

`GET /api/admin/dashboard`

Steps:

1. Define `since` as last 24 hours.
2. Count total customer users.
3. Aggregate completed food order revenue.
4. Aggregate completed barber bookings.
5. Aggregate completed laundry revenue.
6. Load all shops.
7. Map revenue and booking counts per shop.
8. Return:

```js
{
  totalUsers,
  totalRevenue,
  breakdown
}
```

Food revenue aggregation:

```js
const orderRevenue = await Order.aggregate([
  { $match: { status: "completed", updatedAt: { $gte: since } } },
  { $unwind: "$items" },
  { $group: { _id: "$shopId", total: { $sum: "$items.price" } } }
]);
```

Barber revenue uses a fixed rate:

```js
revenue += bRev ? bRev.count * 100 : 0;
```

Laundry revenue uses stored `totalAmount`.

#### Create shop and owner

`POST /api/admin/shops`

Steps:

1. Validate shop name, category, owner email, owner password.
2. Ensure owner email is not already used.
3. Hash owner password.
4. Create User with role `shop_owner`.
5. Create Shop linked to owner.
6. Save shop ID back onto user.

This creates both sides of the owner-shop relationship:

```js
owner user.shopId -> shop._id
shop.ownerId -> user._id
```

#### Delete shop and owner

`DELETE /api/admin/shops/:shopId`

Steps:

1. Find shop.
2. Delete linked owner user if present.
3. Delete shop.
4. Return success message.

Note: this does not delete historical orders/bookings for that shop.

---

## 13. Feature Lifecycle: AI Chatbot and RAG

AI has three phases:

```txt
Indexing -> Retrieval -> Generation
```

Files:

- Frontend UI: `client/src/components/AIChatBot.jsx`
- Chat route: `server/routes/aiRoutes.js`
- RAG service: `server/services/ragService.js`
- Vector model: `server/models/EmbeddingDoc.js`

### Frontend chatbot lifecycle

`AIChatBot.jsx` renders only for logged-in customers:

```jsx
if (!token || role !== "customer") return null;
```

Conversation state:

```js
const [messages, setMessages] = useState([
  {
    role: "model",
    content: "Hi! I'm CampusEase AI...",
  },
]);
```

When the user sends a message:

1. Trim input.
2. Add user message to UI immediately.
3. Send full conversation history:

```js
const response = await api.post("/ai/chat", { messages: newMessages });
```

4. Backend returns `{ reply }`.
5. Add AI reply to message list.

### RAG indexing phase

Triggered in `server/server.js` after DB connection:

```js
connectDB().then(() => {
  buildAndIndexChunks().catch(...);
});
```

`buildAndIndexChunks` does:

1. Check `GEMINI_API_KEY`.
2. Load active shops:

```js
const shops = await Shop.find({ status: "active" });
```

3. Convert each shop to a text chunk:

Canteen:

```txt
<shop name> is a food canteen shop on campus. Menu items: ...
```

Barber:

```txt
<shop name> is a barber shop on campus. Bookable time slots: ...
```

Laundry:

```txt
<shop name> is a laundry shop on campus. Laundry: ... Dry clean: ... Iron: ...
```

4. Send chunk text to Gemini Embedding API.
5. Upsert into `EmbeddingDoc` using `chunkId`.

### Retrieval phase

When the user asks a question, `aiRoutes.js` calls:

```js
const relevantChunks = await retrieveRelevantChunks(query, 3);
```

`retrieveRelevantChunks`:

1. Embeds the user query with task type `RETRIEVAL_QUERY`.
2. Loads all stored embeddings from MongoDB.
3. Computes cosine similarity between query vector and each document vector.
4. Sorts by highest similarity.
5. Returns top 3 chunks.

Cosine similarity logic:

```js
cosine(A, B) = (A dot B) / (|A| * |B|)
```

In code:

```js
dotProduct += vecA[i] * vecB[i];
magA = sqrt(sum(vecA[i]^2));
magB = sqrt(sum(vecB[i]^2));
return dotProduct / (magA * magB);
```

Interview answer:

"We are using MongoDB as a simple vector store. Since the campus dataset is small, we load all embeddings and compare in memory. At large scale, I would replace this with MongoDB Atlas Vector Search, pgvector, Pinecone, Qdrant, or another vector database."

### Generation phase

File: `server/routes/aiRoutes.js`

`POST /api/ai/chat`:

1. Requires login.
2. Validates `messages` array.
3. Finds latest user message.
4. Retrieves top 3 campus chunks.
5. Builds a system prompt with campus context.
6. Maps frontend role `model` to Groq role `assistant`.
7. Calls Groq chat completions endpoint.
8. Returns generated reply.

Important code:

```js
const groqMessages = [
  { role: "system", content: systemPrompt },
  ...messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  })),
];
```

The prompt tells the AI:

- Use campus data for factual answers.
- Do not invent prices, shops, or slots.
- For bookings, tell users to use the app pages.
- Politely redirect out-of-scope questions.

---

## 14. API Endpoint Reference

All endpoints are mounted under `/api` by `client/src/api.jsx`.

### Auth

Base: `/api/auth`

| Method | Path | Protected | Purpose |
|---|---|---:|---|
| POST | `/signup` | No | Create customer account and set JWT cookie |
| POST | `/login` | No | Verify credentials and set JWT cookie |
| POST | `/logout` | No | Clear JWT cookie |

### Food

Base: `/api/food`

| Method | Path | Protected | Purpose |
|---|---|---:|---|
| GET | `/shops` | No | List canteen shops and menus |
| POST | `/order` | Yes | Place food order |
| GET | `/orders` | Yes | Get all orders for current user |
| GET | `/my-orders` | Yes | Get last 24h orders for current user |
| PUT | `/orders/:id` | Yes | Update own order status/deliveredAt |
| DELETE | `/orders/:id` | Yes | Cancel own order |

### Barber

Base: `/api/barber`

| Method | Path | Protected | Purpose |
|---|---|---:|---|
| GET | `/slots` | No | Get available slots by date/shop |
| GET | `/shops` | No | List barber shops |
| POST | `/book` | Yes | Create barber booking |
| GET | `/my-bookings` | Yes | Get last 24h barber bookings |
| PUT | `/:id` | Yes | Update own booking status |
| DELETE | `/:id` | Yes | Cancel own booking |

### Laundry

Base: `/api/laundry`

| Method | Path | Protected | Purpose |
|---|---|---:|---|
| GET | `/shops` | No | List laundry shops and catalogs |
| POST | `/book` | Yes | Create laundry booking |
| GET | `/my-bookings` | Yes | Get last 24h laundry bookings |
| PUT | `/:id` | Yes | Update own laundry booking |
| DELETE | `/:id` | Yes | Cancel own laundry booking |

### Shop Owner

Base: `/api/shop`

All routes are protected and require `shop_owner`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/my-shop` | Load owner shop |
| GET | `/shops/:shopId` | Load a shop after owner guard |
| POST | `/shops/:shopId/menu` | Add canteen menu item |
| DELETE | `/shops/:shopId/menu/:itemId` | Delete canteen menu item |
| POST | `/shops/:shopId/slots` | Add slot |
| PUT | `/shops/:shopId/slots/:slotTime` | Toggle slot bookable state |
| DELETE | `/shops/:shopId/slots/:slotTime` | Delete slot |
| POST | `/shops/:shopId/laundry/catalog` | Add laundry catalog item |
| PUT | `/shops/:shopId/laundry/catalog/:itemId` | Edit laundry catalog item |
| DELETE | `/shops/:shopId/laundry/catalog/:itemId` | Delete laundry catalog item |
| GET | `/shops/:shopId/bookings` | Load recent orders/bookings |
| PUT | `/shops/:shopId/orders/:orderId` | Update food order status |
| PUT | `/shops/:shopId/barber/:id` | Update barber booking status |
| PUT | `/shops/:shopId/laundry/:id` | Update laundry booking status |

### Admin

Base: `/api/admin`

All routes are protected and require `admin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | Revenue/user/shop dashboard |
| POST | `/shops` | Create shop and owner |
| DELETE | `/shops/:shopId` | Delete shop and owner |

### AI

Base: `/api/ai`

| Method | Path | Protected | Purpose |
|---|---|---:|---|
| POST | `/chat` | Yes | RAG-powered chatbot response |

---

## 15. File-by-File Explanation

### Root files

#### `.gitignore`

Defines files Git should ignore. Usually includes dependencies, environment files, build outputs, and logs. It protects secrets such as `.env` from being committed.

#### `package.json`

Root project scripts and shared dependencies.

Important scripts:

```json
"start:server": "node server/server.js",
"dev:server": "nodemon server/server.js",
"start:client": "npm --prefix client run dev",
"build:client": "npm --prefix client run build",
"dev": "concurrently \"npm run dev:server\" \"npm run start:client\""
```

This lets you run both server and client together with `npm run dev`.

#### `package-lock.json`

Locks exact dependency versions for reproducible installs. It should generally be committed so teammates and deployment get the same dependency tree.

#### `README.md`

High-level project description, feature list, architecture, API summary, setup instructions, and environment variables. It is more of an overview than a deep flow guide.

#### `rag_explained.md`

An existing detailed explanation focused on RAG. It appears to be a separate AI/RAG explanation document. This new guide includes RAG as part of the full application flow.

---

### Client configuration files

#### `client/package.json`

Frontend package definition.

Key dependencies:

- `react`, `react-dom`: UI framework.
- `react-router-dom`: route handling.
- `axios`: API calls.
- `sonner`: toast notifications.
- `framer-motion`: animation support.
- `tailwindcss`, `@tailwindcss/vite`: styling.
- `vite`: frontend dev/build tool.

Scripts:

```json
"dev": "vite",
"build": "vite build",
"preview": "vite preview"
```

#### `client/vite.config.js`

Configures Vite.

```js
export default defineConfig({
  plugins: [tailwindcss(), react()],
  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" }
    }
  },
  server: { port: 5173 },
});
```

The JSX loader setting lets Vite process JSX-like code in `.js` dependencies if needed.

#### `client/index.html`

The browser shell. It contains the root div and imports `src/index.jsx`.

#### `client/src/index.css`

Global CSS.

Key parts:

- Imports Tailwind CSS.
- Sets full height for `html`, `body`, and `#root`.
- Defines body background/text color.
- Defines `.container-padded`, a shared max-width layout helper.

---

### Client core files

#### `client/src/index.jsx`

React startup file. Renders `App` and global toaster.

#### `client/src/App.jsx`

Frontend route map and top-level providers.

Structure:

```jsx
<AuthProvider>
  <Router>
    <Navbar />
    <Routes>...</Routes>
    <AIChatBot />
  </Router>
</AuthProvider>
```

Routes:

- `/login`
- `/signup`
- `/`
- `/food`
- `/barber`
- `/laundry`
- `/my-bookings`
- `/shop-owner`
- `/admin`

`CustomerOnly` redirects owners/admins away from customer pages:

```jsx
if (effectiveRole === "shop_owner") return <Navigate to="/shop-owner" replace />;
if (effectiveRole === "admin") return <Navigate to="/admin" replace />;
```

#### `client/src/api.jsx`

Central Axios instance.

It normalizes `VITE_API_URL` so the base URL always ends with `/api`.

```js
baseURL = trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
```

It sends cookies:

```js
withCredentials: true
```

That is essential because auth JWT is stored in an HttpOnly cookie.

Response interceptor:

```js
if (error.response?.status === 401) {
  localStorage.removeItem("role");
  localStorage.removeItem("shopId");
}
```

This clears client-side auth hints when the backend rejects the session.

#### `client/src/context/AuthContext.jsx`

Global auth state.

Stores:

- `role`
- `shopId`
- `isLoggedIn`

It uses localStorage for persistence across reloads. The real token is an HttpOnly cookie and cannot be read by JavaScript, so the context exposes `token: "present"` when logged in.

`login`:

```js
setRole(userRole);
setShopId(userShopId);
setIsLoggedIn(true);
localStorage.setItem("role", userRole);
```

`logout`:

1. Calls `/auth/logout`.
2. Clears React state.
3. Clears localStorage.

---

### Client components

#### `client/src/components/Navbar.jsx`

Top navigation bar.

Responsibilities:

- Shows logo.
- Shows customer navigation links.
- Shows owner/admin dashboard links based on role.
- Shows login/signup when logged out.
- Shows logout when logged in.

It uses `AuthContext` to decide visible links:

```jsx
{token && role === "shop_owner" && <Link to="/shop-owner">Shop Dashboard</Link>}
{token && role === "admin" && <Link to="/admin">Admin Panel</Link>}
```

Logout flow:

```js
logout();
navigate("/login");
```

#### `client/src/components/ProtectedRoute.jsx`

Route guard for pages requiring login and/or role.

If no token:

```jsx
return <Navigate to="/login" replace />;
```

If role is wrong:

```jsx
return <Navigate to="/" replace />;
```

#### `client/src/components/AuthPrompt.jsx`

Modal shown when unauthenticated users try to book/order.

Used by:

- Food page
- Barber page
- Laundry page

It gives actions:

- Sign In
- Create Account
- Cancel

#### `client/src/components/AIChatBot.jsx`

Floating customer-only AI chat widget.

Responsibilities:

- Render floating chat button.
- Open/close chat window.
- Store conversation messages.
- Send messages to `/api/ai/chat`.
- Show loading state, error state, and AI replies.

Important implementation detail:

The frontend uses role `model` for AI messages, while Groq expects `assistant`. The backend maps this.

---

### Client pages

#### `client/src/pages/HomePage.jsx`

Customer landing/dashboard page.

Responsibilities:

- Hero/search UI.
- Filter service cards by All/Food/Barber/Laundry.
- Navigate to feature pages.

Search is local UI logic. It does not call the backend. For example, if the user searches "hair", it sets filter to Barber.

#### `client/src/pages/LoginPage.jsx`

Login UI.

Responsibilities:

- Capture email/password.
- Validate email/password presence.
- Let user select login role.
- Call `/auth/login`.
- Block login if selected role does not match backend role.
- Store auth state through `AuthContext.login`.
- Navigate based on role.

Navigation:

```js
if (res.data.role === "admin") navigate("/admin");
else if (res.data.role === "shop_owner") navigate("/shop-owner");
else navigate("/");
```

#### `client/src/pages/SignupPage.jsx`

Customer registration page.

Responsibilities:

- Validate student ID.
- Validate email format.
- Validate strong password.
- Call `/auth/signup`.
- Store auth state.
- Navigate to home.

Shop owners cannot sign up here. Admin creates owners.

#### `client/src/pages/FoodPage.jsx`

Food ordering page.

Responsibilities:

- Load canteen shops and menus.
- Filter by shop and search term.
- Maintain cart.
- Add/update/remove cart items.
- Select order type.
- Submit order.
- Show recent "order again" items.

Most important API calls:

- `GET /food/shops`
- `GET /food/my-orders`
- `POST /food/order`

#### `client/src/pages/BarberPage.jsx`

Barber appointment booking page.

Responsibilities:

- Load barber shops.
- Generate next 7 date options.
- Fetch available slots for selected date/shop.
- Let user select slot.
- Book appointment.
- Show confirmation screen.

Most important API calls:

- `GET /barber/shops`
- `GET /barber/slots?date=...&shopId=...`
- `POST /barber/book`

#### `client/src/pages/LaundryPage.jsx`

Laundry, dry-clean, and ironing page.

Responsibilities:

- Load laundry shops and catalog.
- Let user select partner and service.
- Let user choose catalog items and quantities.
- Let user choose pickup date/time.
- Let user choose standard/express delivery.
- Calculate frontend estimate.
- Send normalized item IDs/quantities to backend.

Most important API calls:

- `GET /laundry/shops`
- `POST /laundry/book`

#### `client/src/pages/MyBookings.jsx`

Customer booking history page.

Responsibilities:

- Fetch recent food, barber, and laundry records.
- Display tabs for each service.
- Render status and timeline details.
- Allow cancellation.

Most important API calls:

- `GET /food/my-orders`
- `GET /barber/my-bookings`
- `GET /laundry/my-bookings`
- `DELETE /food/orders/:id`
- `DELETE /barber/:id`
- `DELETE /laundry/:id`

#### `client/src/pages/admin/AdminDashboard.jsx`

Admin dashboard page.

Responsibilities:

- Fetch dashboard statistics.
- Show total users and revenue.
- Show revenue by shop.
- Create shop owner and shop.
- Delete shop and owner.

Most important API calls:

- `GET /admin/dashboard`
- `POST /admin/shops`
- `DELETE /admin/shops/:shopId`

#### `client/src/pages/shopOwner/ShopOwnerDashboard.jsx`

Shop owner dashboard.

Responsibilities depend on shop category.

For canteen:

- Add/delete menu items.
- View food orders.
- Accept/reject/prepare/complete orders.

For barber:

- Add/delete/toggle slots.
- View bookings.
- Accept/reject/complete bookings.
- Display capacity usage.

For laundry:

- Manage catalog items.
- View bookings.
- Accept/reject/complete bookings.

Most important API calls:

- `GET /shop/my-shop`
- `GET /shop/shops/:shopId/bookings`
- `POST /shop/shops/:shopId/menu`
- `POST /shop/shops/:shopId/slots`
- `PUT /shop/shops/:shopId/slots/:slotTime`
- `POST /shop/shops/:shopId/laundry/catalog`
- `PUT /shop/shops/:shopId/orders/:orderId`
- `PUT /shop/shops/:shopId/barber/:id`
- `PUT /shop/shops/:shopId/laundry/:id`

---

### Server configuration files

#### `server/package.json`

Backend package definition.

Important dependencies:

- `express`: API server.
- `mongoose`: MongoDB ODM.
- `jsonwebtoken`: JWT auth.
- `bcryptjs`: password hashing.
- `cookie-parser`: reads cookies into `req.cookies`.
- `cors`: cross-origin browser access.
- `dotenv`: environment variables.

Scripts:

```json
"start": "node server.js",
"dev": "nodemon server.js"
```

#### `server/server.js`

Main backend entry point.

Responsibilities:

- Load env variables.
- Create Express app.
- Configure CORS.
- Parse JSON.
- Parse cookies.
- Connect database.
- Start RAG indexing.
- Mount all routers.
- Start HTTP server.

#### `server/config/db.js`

Database connection helper.

Responsibilities:

- Sets DNS servers to Google DNS.
- Connects to MongoDB using `process.env.MONGO_URI`.
- Logs successful connection.
- Attempts to remove a legacy non-sparse `studentId` index.
- Exits process if MongoDB connection fails.

Important interview detail:

It calls `process.exit(1)` on DB failure because the API server cannot work correctly without the database.

#### `server/middleware/authMiddleware.js`

Authentication and role authorization.

Responsibilities:

- Read JWT from cookie or Authorization header.
- Verify token.
- Attach user ID and role to request.
- Provide `authorizeRoles`.

---

### Server model files

#### `server/models/User.js`

Defines users and roles. Explained in the data model section.

#### `server/models/Shop.js`

Defines shops for canteen, barber, and laundry. Explained in the data model section.

#### `server/models/Order.js`

Defines food orders. Explained in the data model section.

#### `server/models/BarberBooking.js`

Defines barber bookings. Explained in the data model section.

#### `server/models/LaundryBooking.js`

Defines laundry bookings. Explained in the data model section.

#### `server/models/SlotCounter.js`

Defines atomic capacity counters for barber slots. Explained in the data model section.

#### `server/models/EmbeddingDoc.js`

Defines vector documents for RAG. Explained in the data model and AI sections.

---

### Server route files

#### `server/routes/authRoutes.js`

Authentication routes:

- Signup
- Login
- Logout

Core logic:

- Passwords are never stored directly.
- `bcrypt.hash` stores password hash.
- `bcrypt.compare` verifies password.
- JWT stores user ID, role, and shop ID.
- Cookie stores token.

#### `server/routes/foodRoutes.js`

Food routes:

- Public shop/menu listing.
- Protected order creation.
- Protected user order history.
- Protected order update/cancel.

Main business rule:

Cart items are grouped by shop so each canteen receives its own order.

#### `server/routes/barberRoutes.js`

Barber routes:

- Public slot availability.
- Public barber shop list.
- Protected booking.
- Protected user booking list.
- Protected update/cancel.

Main business rule:

Each slot can hold up to 3 active bookings per shop per date. The `SlotCounter` model handles capacity atomically.

#### `server/routes/laundryRoutes.js`

Laundry routes:

- Public laundry shop/catalog listing.
- Protected booking.
- Protected user booking list.
- Protected update/cancel.

Main business rule:

Backend calculates total amount from the shop catalog, not from frontend-submitted prices.

#### `server/routes/shopRoutes.js`

Shop-owner routes:

- Owner shop loading.
- Menu management.
- Slot management.
- Laundry catalog management.
- Recent orders/bookings.
- Status updates.

Main business rule:

`ownerGuard` ensures a shop owner can only read or update their own shop.

#### `server/routes/superAdminRoutes.js`

Admin routes:

- Dashboard stats.
- Create shop and owner.
- Delete shop and owner.

Main business rule:

Admins manage platform structure. Shop owners manage day-to-day operations.

#### `server/routes/aiRoutes.js`

AI chat route.

Main business rule:

The chat response is grounded by retrieved campus context. The model is instructed not to invent factual campus data.

#### `server/services/ragService.js`

RAG service.

Responsibilities:

- Convert active shop data into text chunks.
- Call Gemini embedding API.
- Store embeddings in MongoDB.
- Embed user queries.
- Compute cosine similarity.
- Return top matching chunks.

Important note:

There is a small comment mismatch: some comments mention Gemini Flash for generation, but the actual generation route uses Groq. In an interview, explain the real implementation: Gemini is used for embeddings; Groq is used for chat generation.

---

## 16. Environment Variables

Server variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
```

Client variables:

```env
VITE_API_URL=http://localhost:5000
```

How they are used:

- `MONGO_URI`: Mongoose database connection.
- `JWT_SECRET`: signs/verifies JWTs.
- `FRONTEND_URL`: allowed CORS origin.
- `GEMINI_API_KEY`: creates embeddings.
- `GROQ_API_KEY`: generates AI chat responses.
- `VITE_API_URL`: frontend backend URL.

---

## 17. Common Interview Questions and Answers

### Q: What is the main entry point of the frontend?

`client/index.html` loads `client/src/index.jsx`, which renders `App.jsx` into the `root` div.

### Q: What is the main entry point of the backend?

`server/server.js`. It configures Express middleware, connects MongoDB, starts RAG indexing, mounts routers, and starts listening on the configured port.

### Q: How does authentication work?

The backend signs a JWT after login/signup and stores it in an HttpOnly cookie. Browser requests use Axios with `withCredentials: true`, so the cookie is sent automatically. Protected backend routes use `authMiddleware` to verify the token and attach user ID and role to the request.

### Q: Why use HttpOnly cookies?

HttpOnly cookies cannot be read by frontend JavaScript, which reduces the impact of XSS stealing tokens.

### Q: Why is localStorage still used?

Only for frontend UI hints like `role` and `shopId`, so React can render correct navigation after reload. The real authentication token is still the cookie.

### Q: How are roles enforced?

Frontend uses `ProtectedRoute` for user experience. Backend uses `authorizeRoles`, which is the real security boundary.

### Q: How is barber overbooking prevented?

The backend uses `SlotCounter.findOneAndUpdate` with `count: { $lt: SLOT_CAPACITY }` and `$inc`. This atomically increments the counter only if the slot has capacity.

### Q: Why does laundry booking calculate price on the backend?

Because frontend data can be manipulated. The backend uses submitted `itemId` values to look up real catalog prices and calculate the total securely.

### Q: How does the AI chatbot know current campus data?

On server startup, active shop data is converted into text chunks and embedded using Gemini. When a user asks a question, the question is embedded and compared with stored vectors. The top matches are included in the Groq prompt as live campus context.

### Q: Is this using a vector database?

Not a dedicated vector database. MongoDB stores the embeddings, and the app calculates cosine similarity in memory. This is acceptable for a small campus dataset. At scale, use a real vector search solution.

### Q: What happens when a shop owner adds a menu item?

The owner dashboard calls `POST /api/shop/shops/:shopId/menu`. The backend verifies the owner owns that shop, pushes the item into `shop.menu`, saves the shop, and returns the updated shop.

### Q: What happens when admin creates a shop?

The admin route creates a `User` with role `shop_owner`, creates a `Shop` linked to that user, then saves the shop ID back onto the user.

### Q: What are the biggest limitations?

- RAG index refreshes on server startup, not immediately after every menu/catalog update.
- Some status fields are strings without strict enum validation.
- Admin delete removes shop and owner but not historical orders/bookings.
- Chatbot depends on external Gemini and Groq APIs.
- No realtime push; dashboards refresh by explicit fetch or reload logic.

---

## 18. End-to-End Request Examples

### Example 1: Customer logs in

```txt
LoginPage.handleSubmit
  -> api.post("/auth/login", { email, password })
  -> POST /api/auth/login
  -> User.findOne({ email })
  -> bcrypt.compare(password, user.passwordHash)
  -> jwt.sign({ id, role, shopId })
  -> res.cookie("token", token, ...)
  -> frontend login(...)
  -> navigate based on role
```

### Example 2: Customer books barber slot

```txt
BarberPage.handleBooking
  -> api.post("/barber/book", { slot, bookingDate, shopId })
  -> authMiddleware verifies JWT
  -> Shop.findOne({ _id: shopId, category: "barber" })
  -> validate slot and manual availability
  -> SlotCounter.findOneAndUpdate(... $inc count)
  -> BarberBooking.create(...)
  -> response returned
  -> frontend success UI and loadSlots()
```

### Example 3: Shop owner completes food order

```txt
ShopOwnerDashboard button
  -> api.put("/shop/shops/:shopId/orders/:orderId", { status: "completed" })
  -> authMiddleware verifies JWT
  -> authorizeRoles("shop_owner")
  -> ownerGuard verifies ownership
  -> Order.findOne({ _id: orderId, "items.shop": shop.name })
  -> order.status = "completed"
  -> order.deliveredAt = new Date()
  -> save and return order
```

### Example 4: AI chatbot answers "Which canteen has dosa?"

```txt
AIChatBot.sendMessage
  -> api.post("/ai/chat", { messages })
  -> authMiddleware verifies customer session
  -> latest user message extracted
  -> retrieveRelevantChunks(query, 3)
       -> embed query using Gemini
       -> load EmbeddingDoc records
       -> cosine similarity
       -> top 3 chunks
  -> build system prompt with campus context
  -> call Groq chat completions
  -> return { reply }
  -> frontend appends model reply
```

---

## 19. How to Explain the Project Confidently

Use this structure in interviews:

1. "This is a MERN campus services app with three roles: customer, shop owner, admin."
2. "Frontend is React/Vite. Backend is Express/MongoDB."
3. "Requests go through a central Axios instance that sends cookies."
4. "Authentication is JWT in HttpOnly cookies, with role-based authorization on backend routes."
5. "Each feature has its own route module and Mongoose model."
6. "Food orders are grouped by shop."
7. "Barber bookings use atomic slot counters to prevent overbooking."
8. "Laundry pricing is recalculated server-side from catalog data."
9. "Shop owners manage their own data through owner-guarded routes."
10. "Admins create owners and shops and view revenue."
11. "AI uses RAG: shop data is embedded, query retrieves relevant chunks, Groq generates answer from retrieved context."

That sequence explains architecture, security, business logic, and AI clearly.

