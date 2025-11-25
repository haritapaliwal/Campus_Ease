import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import api from "../../api";

const BARBER_DEFAULT_SLOTS = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];
const BARBER_SLOT_CAPACITY = 3;

export default function OwnerDashboard() {
  const { role } = useContext(AuthContext);
  const [shop, setShop] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [newItem, setNewItem] = useState({ item: "", price: "" });
  const [newSlot, setNewSlot] = useState("");
  const [query, setQuery] = useState("");
  const [activeMenuTab, setActiveMenuTab] = useState("all");
  const [newLaundryItem, setNewLaundryItem] = useState({ category: "laundry", name: "", price: "" });
  const [editingLaundryItem, setEditingLaundryItem] = useState(null);

  const loadShop = async () => {
    try {
      let res = await api.get("/admin/my-shop");
      let data = res.data;
      if (!data) {
        const storedId = localStorage.getItem("shopId");
        if (storedId) {
          const r2 = await api.get(`/admin/shops/${storedId}`);
          data = r2.data;
        }
      }
      setShop(data);
      if (data?._id) {
        const b = await api.get(`/admin/shops/${data._id}/bookings`);
        setBookings(b.data || []);
      }
    } catch (e) {
      console.error("Failed loading shop", e);
    }
  };

  useEffect(() => {
    loadShop();
  }, []);

  if (role !== "owner") {
    return <div className="container-padded py-10">Not authorized.</div>;
  }

  const handleAddItem = async () => {
    if (!newItem.item || !newItem.price) return;
    const res = await api.post(`/admin/shops/${shop._id}/menu`, { item: newItem.item, price: Number(newItem.price) });
    setShop(res.data);
    setNewItem({ item: "", price: "" });
  };

  const handleAddSlot = async () => {
    const slotValue = (newSlot || "").trim();
    if (!slotValue || !shop?._id) return;
    try {
      await api.post(`/admin/shops/${shop._id}/slots`, { slot: slotValue });
      setNewSlot("");
      await loadShop(); // Reload shop data
    } catch (e) {
      console.error("Failed to add slot", e);
    }
  };

  const handleAddLaundryItem = async () => {
    if (!newLaundryItem.name || !newLaundryItem.price || !shop?._id) return;
    try {
      await api.post(`/admin/shops/${shop._id}/laundry/catalog`, {
        category: newLaundryItem.category,
        name: newLaundryItem.name,
        price: Number(newLaundryItem.price),
      });
      setNewLaundryItem((prev) => ({ ...prev, name: "", price: "" }));
      await loadShop();
    } catch (e) {
      console.error("Failed to add laundry item", e);
    }
  };

  const handleSaveLaundryItem = async () => {
    if (!editingLaundryItem?._id || !shop?._id) return;
    try {
      await api.put(`/admin/shops/${shop._id}/laundry/catalog/${editingLaundryItem._id}`, {
        name: editingLaundryItem.name,
        price: Number(editingLaundryItem.price),
      });
      setEditingLaundryItem(null);
      await loadShop();
    } catch (e) {
      console.error("Failed to update laundry item", e);
    }
  };

  const handleDeleteLaundryItem = async (itemId) => {
    if (!shop?._id) return;
    const confirmed = window.confirm("Remove this laundry item?");
    if (!confirmed) return;
    try {
      await api.delete(`/admin/shops/${shop._id}/laundry/catalog/${itemId}`);
      await loadShop();
    } catch (e) {
      console.error("Failed to delete laundry item", e);
    }
  };

  const startEditLaundryItem = (item, category) => {
    setEditingLaundryItem({
      ...item,
      category,
      price: item.price,
    });
  };

  const isBarberShop = shop?.type === "barber";

  const barberSlotCounts = useMemo(() => {
    if (!isBarberShop) return {};
    return (bookings || []).reduce((acc, booking) => {
      const slotTime = booking.slot;
      if (!slotTime) return acc;
      const status = (booking.status || "").toLowerCase();
      // Exclude cancelled, rejected, and completed bookings from slot count
      // Completed bookings free up the slot for new customers
      if (status === "cancelled" || status === "rejected" || status === "completed") return acc;
      acc[slotTime] = (acc[slotTime] || 0) + 1;
      return acc;
    }, {});
  }, [isBarberShop, bookings]);

  const normalizedBarberSlots = useMemo(() => {
    if (!isBarberShop) return [];
    const slotMap = new Map();
    (shop?.slots || []).forEach((slot) => {
      const time = typeof slot === "string" ? slot : slot?.time;
      if (!time) return;
      slotMap.set(time, {
        time,
        isBookable: typeof slot === "string" ? true : slot.isBookable !== false,
      });
    });
    BARBER_DEFAULT_SLOTS.forEach((time) => {
      if (!slotMap.has(time)) {
        slotMap.set(time, { time, isBookable: true, isDefault: true });
      }
    });
    return Array.from(slotMap.values()).sort((a, b) => {
      const ai = BARBER_DEFAULT_SLOTS.indexOf(a.time);
      const bi = BARBER_DEFAULT_SLOTS.indexOf(b.time);
      if (ai === -1 && bi === -1) return a.time.localeCompare(b.time);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [isBarberShop, shop]);

  const toggleBarberSlot = async (time, nextState) => {
    if (!shop?._id || !time) return;
    try {
      const encoded = encodeURIComponent(time);
      await api.put(`/admin/shops/${shop._id}/slots/${encoded}`, { isBookable: nextState });
      await loadShop();
    } catch (e) {
      console.error("Failed to update slot", e);
    }
  };

  const filteredMenu = useMemo(() => {
    const items = (shop?.menu || []).filter(m => m.item.toLowerCase().includes(query.toLowerCase()));
    if (activeMenuTab === "all") return items;
    // simple category inference by name keywords
    const map = {
      burger: ["burger"],
      pizza: ["pizza"],
      beverage: ["coffee", "shake", "tea", "drink"],
      bakery: ["bread", "bun", "brownie"],
      snacks: ["roll", "kachori", "maggie", "paratha", "dosa"],
    };
    const keys = map[activeMenuTab] || [];
    return items.filter(i => keys.some(k => i.item.toLowerCase().includes(k)));
  }, [shop, query, activeMenuTab]);

  return (
    <div className="min-h-screen bg-gray-50">
      {!shop ? (
        <div className="container-padded py-10 text-gray-600">
          <p className="mb-2">Loading shop...</p>
          <p className="text-sm">If this persists, log out and log back in with your owner credentials.</p>
        </div>
      ) : (
        <div className="container-padded py-8 space-y-8">
          <div className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">Owner workspace</p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{shop.name}</h1>
              <p className="text-xs uppercase tracking-widest text-gray-400 mt-1">{shop.type}</p>
            </div>
            {shop.type === "canteen" && (
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-96">
                  <input
                    type="text"
                    placeholder="Search menu"
                    value={query}
                    onChange={(e)=>setQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
                </div>
                <button onClick={handleAddItem} className="px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600">
                  Add New Menu
                </button>
              </div>
            )}
          </div>

          {shop.type === "canteen" && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="text-lg font-bold mb-4">Add New Menu Item</h3>
                <div className="flex flex-col gap-3 md:flex-row">
                  <input value={newItem.item} onChange={e=>setNewItem(v=>({...v,item:e.target.value}))} placeholder="Item name (e.g. Veg Maggie)" className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
                  <input value={newItem.price} onChange={e=>setNewItem(v=>({...v,price:e.target.value}))} placeholder="Price" className="md:w-40 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
                  <button onClick={handleAddItem} className="px-5 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold">Add</button>
                </div>
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">Current Menu</h4>
                  {filteredMenu.length === 0 ? (
                    <p className="text-sm text-gray-500">No menu items yet.</p>
                  ) : (
                    <CardGrid items={filteredMenu} emptyText="No menu items yet." />
                  )}
                </div>
              </div>

              <OrdersByStudent shop={shop} orders={bookings} refresh={loadShop} />
            </div>
          )}

          {shop.type === "barber" && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Slot availability</h3>
                    <p className="text-sm text-gray-500">
                      Each slot supports up to {BARBER_SLOT_CAPACITY} appointments. When the limit is reached it is
                      automatically shown as booked—no extra clicks needed.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={newSlot}
                      onChange={e=>setNewSlot(e.target.value)}
                      placeholder="e.g. 10:30 AM"
                      className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={handleAddSlot}
                      className="px-5 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold whitespace-nowrap"
                    >
                      Add slot
                    </button>
                  </div>
                </div>
                {normalizedBarberSlots.length === 0 ? (
                  <p className="mt-6 text-sm text-gray-500">No slots configured yet. Start by adding your first time slot.</p>
                ) : (
                  <div className="mt-6 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {normalizedBarberSlots.map((slot) => {
                      const bookingCount = barberSlotCounts[slot.time] || 0;
                      const isAutoFull = bookingCount >= BARBER_SLOT_CAPACITY;
                      const isBookable = slot.isBookable !== false;
                      const remaining = Math.max(0, BARBER_SLOT_CAPACITY - bookingCount);
                      const status = isAutoFull
                        ? { label: "Fully booked", tone: "bg-red-100 text-red-700" }
                        : isBookable
                        ? { label: remaining === BARBER_SLOT_CAPACITY ? "Available" : "In progress", tone: "bg-emerald-100 text-emerald-700" }
                        : { label: "Marked booked", tone: "bg-gray-200 text-gray-700" };

                      return (
                        <div
                          key={slot.time}
                          className={`border-2 rounded-2xl p-4 flex flex-col gap-3 ${
                            isAutoFull
                              ? "border-red-200 bg-red-50"
                              : isBookable
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-900">{slot.time}</p>
                              <p className="text-xs text-gray-600">{Math.min(bookingCount, BARBER_SLOT_CAPACITY)}/{BARBER_SLOT_CAPACITY} booked</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.tone}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {isAutoFull ? "Max capacity reached" : `${remaining} spot${remaining === 1 ? "" : "s"} left`}
                          </p>
                          <button
                            disabled={isAutoFull}
                            onClick={() => toggleBarberSlot(slot.time, !isBookable)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                              isAutoFull
                                ? "bg-red-200 text-red-700 cursor-not-allowed"
                                : isBookable
                                ? "bg-red-100 text-red-600 hover:bg-red-200"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {isBookable ? "Mark booked" : "Mark available"}
                          </button>
                          {isAutoFull && (
                            <p className="text-[11px] text-red-600">
                              This slot will open automatically once a booking is cancelled or moved.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-lg font-bold">Customer bookings</h3>
                  <p className="text-sm text-gray-500">Tap a status to update the appointment progress.</p>
                </div>
                {bookings.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No bookings yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {bookings.map((b)=> (
                      <div key={b._id} className="border rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Booking #{b._id.slice(-6)}</p>
                          <p className="font-semibold text-gray-900">Slot: {b.slot}</p>
                          {b.bookingDate && (
                            <p className="text-xs text-gray-600">
                              Date:{" "}
                              <span className="font-semibold">
                                {new Date(b.bookingDate).toLocaleDateString('en-US', { 
                                  weekday: 'short', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </span>
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            Status: <span className="font-semibold capitalize">{b.status}</span>
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Student ID:{" "}
                            <span className="font-mono">
                              {b.userId?.studentId || "N/A"}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">
                            Email:{" "}
                            <span className="font-mono">
                              {b.userId?.email || "unknown"}
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={async()=>{await api.put(`/admin/shops/${shop._id}/barber/${b._id}`,{status:'accepted'}); await loadShop();}} className="px-3 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-semibold">Accept</button>
                          <button onClick={async()=>{await api.put(`/admin/shops/${shop._id}/barber/${b._id}`,{status:'rejected'}); await loadShop();}} className="px-3 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-semibold">Reject</button>
                          <button onClick={async()=>{await api.put(`/admin/shops/${shop._id}/barber/${b._id}`,{status:'completed'}); await loadShop();}} className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold">Completed</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {shop.type === "laundry" && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Laundry Catalog</h3>
                    <p className="text-sm text-gray-500">Add clothes and set pricing per service.</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { key: "laundry", title: "Laundry (Wash & Fold)", accent: "bg-blue-50 text-blue-700" },
                    { key: "dryclean", title: "Dry Clean", accent: "bg-purple-50 text-purple-700" },
                    { key: "iron", title: "Ironing", accent: "bg-emerald-50 text-emerald-700" },
                  ].map(({ key, title, accent }) => {
                    const items = shop.laundryCatalog?.[key] || [];
                    return (
                      <div key={key} className="border rounded-2xl p-4 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">{title}</h4>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${accent}`}>{items.length} items</span>
                        </div>
                        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                          {items.length === 0 && (
                            <p className="text-sm text-gray-500">No clothes added yet.</p>
                          )}
                          {items.map((item) => {
                            const isEditing = editingLaundryItem?._id === item._id;
                            return (
                              <div key={item._id} className="border border-gray-100 rounded-xl p-3">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <input
                                      value={editingLaundryItem.name}
                                      onChange={(e)=>setEditingLaundryItem(v=>({...v,name:e.target.value}))}
                                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    />
                                    <input
                                      type="number"
                                      value={editingLaundryItem.price}
                                      onChange={(e)=>setEditingLaundryItem(v=>({...v,price:e.target.value}))}
                                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={handleSaveLaundryItem} className="flex-1 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold">Save</button>
                                      <button onClick={()=>setEditingLaundryItem(null)} className="flex-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                                      <p className="text-xs text-gray-500">₹{item.price}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={()=>startEditLaundryItem(item, key)} className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg">Edit</button>
                                      <button onClick={()=>handleDeleteLaundryItem(item._id)} className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 rounded-lg">Remove</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex flex-col gap-3 md:flex-row">
                  <select value={newLaundryItem.category} onChange={(e)=>setNewLaundryItem(v=>({...v,category:e.target.value}))} className="border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500">
                    <option value="laundry">Laundry (Wash & Fold)</option>
                    <option value="dryclean">Dry Clean</option>
                    <option value="iron">Iron</option>
                  </select>
                  <input value={newLaundryItem.name} onChange={(e)=>setNewLaundryItem(v=>({...v,name:e.target.value}))} placeholder="Cloth name" className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
                  <input type="number" value={newLaundryItem.price} onChange={(e)=>setNewLaundryItem(v=>({...v,price:e.target.value}))} placeholder="Price" className="md:w-40 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
                  <button onClick={handleAddLaundryItem} className="px-5 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold">
                    Add cloth
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="text-lg font-bold mb-4">Customer Bookings</h3>
                {bookings.length === 0 ? (
                  <p className="text-sm text-gray-500">No bookings yet.</p>
                ) : (
                  <div className="space-y-4">
                    {bookings.map((b)=> (
                      <div key={b._id} className="border rounded-2xl p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-xs text-gray-500">Booking #{b._id.slice(-6)}</p>
                            <p className="font-semibold text-gray-900 capitalize">{b.serviceType || "laundry"} service</p>
                            <p className="text-xs text-gray-500">Status: <span className="font-semibold capitalize">{b.status}</span></p>
                            <p className="text-xs text-gray-600 mt-1">
                              Student ID:{" "}
                              <span className="font-mono">
                                {b.userId?.studentId || "N/A"}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500">
                              Email:{" "}
                              <span className="font-mono">
                                {b.userId?.email || "unknown"}
                              </span>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={async()=>{await api.put(`/admin/shops/${shop._id}/laundry/${b._id}`,{status:'accepted'}); await loadShop();}} className="px-3 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-semibold">Accept</button>
                            <button onClick={async()=>{await api.put(`/admin/shops/${shop._id}/laundry/${b._id}`,{status:'rejected'}); await loadShop();}} className="px-3 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-semibold">Reject</button>
                            <button onClick={async()=>{await api.put(`/admin/shops/${shop._id}/laundry/${b._id}`,{status:'completed'}); await loadShop();}} className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold">Completed</button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Items</p>
                            {(b.items || []).length === 0 ? (
                              <p className="text-sm text-gray-600">No items submitted.</p>
                            ) : (
                              <ul className="space-y-1 text-sm text-gray-700">
                                {b.items.map((item) => (
                                  <li key={item._id || item.itemId} className="flex items-center justify-between">
                                    <span>{item.name} <span className="text-gray-400 text-xs capitalize">({item.category})</span></span>
                                    <span className="font-semibold">x{item.quantity}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Timeline</p>
                            <div className="space-y-1 text-sm text-gray-700">
                              {b.pickupDate && (
                                <div className="flex items-center justify-between">
                                  <span>Pickup</span>
                                  <span className="font-semibold">{b.pickupDate} {b.pickupTime || ""}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span>Delivery</span>
                                <span className="font-semibold">{b.deliveryOption === "express" ? "Express" : "Standard"}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Total</span>
                                <span className="font-bold text-purple-600">₹{b.totalAmount || 0}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, className = "" }){
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <h3 className="text-sm font-extrabold text-gray-800">{title}</h3>
      <button className="text-xs text-gray-500 hover:text-purple-600 font-semibold">View all →</button>
    </div>
  );
}

function CardGrid({ items, promo = false, emptyText }){
  if (!items || items.length === 0){
    return <div className="mt-3 text-sm text-gray-500">{emptyText}</div>;
  }
  return (
    <div className="mt-3 grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((m, i) => (
        <div key={i} className={`bg-white rounded-2xl shadow p-4 border ${promo? 'border-red-200' : 'border-gray-100'}`}>
          {promo && (
            <span className="inline-block mb-2 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full">15% Off</span>
          )}
          <div className="h-28 flex items-center justify-center text-5xl">🍔</div>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900 truncate">{m.item}</p>
              <span className="text-sm font-bold text-purple-600">₹{m.price}</span>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">Sold 1k • 15% ⭐</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersByStudent({ shop, orders, refresh }){
  // Group orders by userId and compute total for this shop
  const groups = useMemo(() => {
    const map = new Map();
    (orders || []).forEach(o => {
      const rawUser = o.userId || "unknown";
      const userId = typeof rawUser === "object" && rawUser !== null ? rawUser._id || "unknown" : rawUser;
      const arr = map.get(userId) || [];
      arr.push(o);
      map.set(userId, arr);
    });
    return Array.from(map.entries()).map(([userId, userOrders]) => {
      const anyOrder = userOrders[0] || {};
      const user = anyOrder.userId && typeof anyOrder.userId === "object" ? anyOrder.userId : null;
      const total = userOrders.reduce((sum, ord) => {
        const shopItems = (ord.items || []).filter(i => i.shop === shop.name);
        const orderSum = shopItems.reduce((s, i) => s + Number(i.price || 0), 0);
        return sum + orderSum;
      }, 0);
      const statuses = new Set(userOrders.map(o => o.status));
      return { userId, orders: userOrders, total, statuses, user };
    });
  }, [orders, shop]);

  const updateAll = async (userGroup, status) => {
    await Promise.all(
      userGroup.orders.map(o => api.put(`/admin/shops/${shop._id}/orders/${o._id}`, { status }))
    );
    await refresh();
  };

  return (
    <div className="mt-8 bg-white rounded-2xl shadow p-6">
      <h3 className="text-lg font-bold mb-4">Food Orders</h3>
      {(!groups || groups.length === 0) ? (
        <p className="text-sm text-gray-500">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.userId} className="border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-700">
                    Student ID:{" "}
                    <span className="font-mono">
                      {g.user?.studentId || "N/A"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Email:{" "}
                    <span className="font-mono">
                      {g.user?.email || "unknown"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">Statuses: {[...g.statuses].join(', ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Amount</p>
                  <p className="text-xl font-extrabold text-purple-600">₹{g.total}</p>
                </div>
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-2">
                {g.orders.map(o => (
                  <div key={o._id} className="rounded-lg border p-3 text-xs text-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Order #{o._id.slice(-6)}</span>
                      <span className="capitalize">{o.status}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500 truncate">
                      {(o.items||[]).filter(i=>i.shop===shop.name).map(i=>i.item).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={()=>updateAll(g,'accepted')} className="px-3 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-semibold">Accept</button>
                <button onClick={()=>updateAll(g,'rejected')} className="px-3 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-semibold">Reject</button>
                <button onClick={()=>updateAll(g,'prepared')} className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold">Prepared</button>
                <button onClick={()=>updateAll(g,'completed')} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">Completed</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


