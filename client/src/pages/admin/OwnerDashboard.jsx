import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import api from "../../api";

export default function OwnerDashboard() {
  const { role } = useContext(AuthContext);
  const [shop, setShop] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [newItem, setNewItem] = useState({ item: "", price: "" });
  const [newSlot, setNewSlot] = useState("");
  const [query, setQuery] = useState("");
  const [activeMenuTab, setActiveMenuTab] = useState("all");

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
    if (!newSlot) return;
    try {
      await api.post(`/admin/shops/${shop._id}/slots`, { slot: newSlot });
      setNewSlot("");
      await loadShop(); // Reload shop data
    } catch (e) {
      console.error("Failed to add slot", e);
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
        <div className="grid grid-cols-12 gap-0">
          {/* Sidebar */}
          <aside className="col-span-12 md:col-span-3 lg:col-span-2 bg-white border-r border-gray-200 min-h-screen p-4">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-gray-900">{shop.name}</h2>
              <p className="text-xs text-gray-500 capitalize">{shop.type}</p>
            </div>
            <nav className="space-y-2">
              {[
                { label: "Dashboard", icon: "📊" },
                { label: shop.type === "canteen" ? "Menu" : "Slots", icon: "📋" },
                { label: shop.type === "canteen" ? "Food Order" : "Bookings", icon: "🧾" },
                { label: "Reviews", icon: "⭐" },
                { label: "Setting", icon: "⚙️" },
              ].map((i) => (
                <div key={i.label} className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-100 cursor-default">
                  <span className="text-lg">{i.icon}</span>
                  <span className="text-sm font-semibold">{i.label}</span>
                </div>
              ))}
            </nav>
            <div className="mt-8 p-4 rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-400 text-white shadow">
              <p className="text-sm font-semibold">Upgrade your Account to get more benefits</p>
              <button className="mt-3 px-4 py-2 bg-white/90 text-amber-700 rounded-xl text-sm font-bold hover:bg-white">Upgrade</button>
            </div>
          </aside>

          {/* Main */}
          <main className="col-span-12 md:col-span-9 lg:col-span-10 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Menu</h1>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-96">
                  <input
                    type="text"
                    placeholder="Search"
                    value={query}
                    onChange={(e)=>setQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
                </div>
                {shop.type === "canteen" && (
                  <button onClick={handleAddItem} className="px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600">
                    Add New Menu
                  </button>
                )}
              </div>
            </div>

            {/* CATEGORIES for food */}
            {shop.type === "canteen" && (
              <div className="mb-6">
                <h3 className="text-sm font-extrabold text-gray-800 mb-3">Category</h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {[
                    {key:"all", label:"All", icon:"🍽️"},
                    {key:"bakery", label:"Bakery", icon:"🧁"},
                    {key:"burger", label:"Burger", icon:"🍔"},
                    {key:"beverage", label:"Beverage", icon:"🥤"},
                    {key:"pizza", label:"Pizza", icon:"🍕"},
                    {key:"snacks", label:"Snacks", icon:"🥟"},
                  ].map(c => (
                    <button
                      key={c.key}
                      onClick={()=>setActiveMenuTab(c.key)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold whitespace-nowrap ${activeMenuTab===c.key? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white border-transparent' : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300'}`}
                    >
                      <span>{c.icon}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* GRID SECTIONS */}
            {shop.type === "canteen" ? (
              <>
                {/* Popular This Week */}
                <SectionHeader title="Popular This Week" />
                <CardGrid items={filteredMenu} emptyText="No menu items yet." />

                {/* Best Seller */}
                <SectionHeader title="Best Seller" className="mt-8" />
                <CardGrid items={filteredMenu.slice(0,8)} emptyText="No best sellers yet." />

                {/* Promo */}
                <SectionHeader title="Promo" className="mt-8" />
                <CardGrid items={filteredMenu.slice(0,6)} promo emptyText="No promos yet." />

                {/* Orders management */}
                <OrdersByStudent shop={shop} orders={bookings} refresh={loadShop} />

                {/* Add new item inline */}
                <div className="mt-8 bg-white rounded-2xl shadow p-6">
                  <h3 className="text-lg font-bold mb-4">Add New Menu Item</h3>
                  <div className="flex gap-3">
                    <input value={newItem.item} onChange={e=>setNewItem(v=>({...v,item:e.target.value}))} placeholder="Item name (e.g. Veg Maggie)" className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
                    <input value={newItem.price} onChange={e=>setNewItem(v=>({...v,price:e.target.value}))} placeholder="Price" className="w-40 border-2 border-gray-2 00 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
                    <button onClick={handleAddItem} className="px-5 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold">Add</button>
                  </div>
                </div>
              </>
            ) : (
              // Barber / Laundry UI
              <>
                <div className="bg-white rounded-2xl shadow p-6">
                  <h3 className="text-lg font-bold mb-2">Time Slots Management</h3>
                  <p className="text-sm text-gray-500 mb-4">Highlight bookable slots and toggle availability.</p>
                  <div className="grid sm:grid-cols-2 gap-3 mb-4 max-h-80 overflow-y-auto">
                    {(shop.slots || []).map((s, i) => {
                      const slotTime = typeof s === 'string' ? s : s.time;
                      const isBookable = typeof s === 'string' ? true : (s.isBookable !== false);
                      return (
                        <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 ${isBookable? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                          <span className={`font-semibold ${isBookable? 'text-green-700' : 'text-gray-600'}`}>{slotTime}</span>
                          <button
                            onClick={async ()=>{
                              try{
                                const encoded = encodeURIComponent(slotTime);
                                await api.put(`/admin/shops/${shop._id}/slots/${encoded}`, { isBookable: !isBookable });
                                await loadShop();
                              }catch(e){ console.error(e); }
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold ${isBookable? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                          >
                            {isBookable? 'Mark Booked' : 'Mark Available'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3">
                    <input value={newSlot} onChange={e=>setNewSlot(e.target.value)} placeholder="e.g. 10:30 AM" className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
                    <button onClick={handleAddSlot} className="px-5 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold">Add Slot</button>
                  </div>
                </div>

                <div className="mt-8 bg-white rounded-2xl shadow p-6">
                  <h3 className="text-lg font-bold mb-4">Bookings</h3>
                  {bookings.length === 0 ? (
                    <p className="text-sm text-gray-500">No bookings yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {bookings.map((b)=> (
                        <div key={b._id} className="border rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Booking #{b._id.slice(-6)}</p>
                            <p className="font-semibold text-gray-900">Slot: {b.slot}</p>
                            <p className="text-xs text-gray-500">Status: <span className="font-semibold capitalize">{b.status}</span></p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={async()=>{await api.put(`/admin/shops/${shop._id}/${shop.type==='barber'?'barber':'laundry'}/${b._id}`,{status:'accepted'}); await loadShop();}} className="px-3 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-semibold">Accept</button>
                            <button onClick={async()=>{await api.put(`/admin/shops/${shop._id}/${shop.type==='barber'?'barber':'laundry'}/${b._id}`,{status:'rejected'}); await loadShop();}} className="px-3 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-semibold">Reject</button>
                            <button onClick={async()=>{await api.put(`/admin/shops/${shop._id}/${shop.type==='barber'?'barber':'laundry'}/${b._id}`,{status:'completed'}); await loadShop();}} className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold">Completed</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
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
      const userId = o.userId || "unknown";
      const arr = map.get(userId) || [];
      arr.push(o);
      map.set(userId, arr);
    });
    return Array.from(map.entries()).map(([userId, userOrders]) => {
      const total = userOrders.reduce((sum, ord) => {
        const shopItems = (ord.items || []).filter(i => i.shop === shop.name);
        const orderSum = shopItems.reduce((s, i) => s + Number(i.price || 0), 0);
        return sum + orderSum;
      }, 0);
      const statuses = new Set(userOrders.map(o => o.status));
      return { userId, orders: userOrders, total, statuses };
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
                  <p className="text-sm text-gray-500">Student: <span className="font-mono">{String(g.userId).slice(-6)}</span></p>
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


