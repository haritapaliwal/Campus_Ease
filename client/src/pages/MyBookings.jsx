import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api";

export default function MyBookings() {
  const [activeTab, setActiveTab] = useState("Food");
  const [foodOrders, setFoodOrders] = useState([]);
  const [barberBookings, setBarberBookings] = useState([]);
  const [laundryBookings, setLaundryBookings] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const foodRes = await api.get("/food/my-orders");
        const barberRes = await api.get("/barber/my-bookings");
        const laundryRes = await api.get("/laundry/my-bookings");

        setFoodOrders(foodRes.data || []);
        setBarberBookings(barberRes.data || []);
        setLaundryBookings(laundryRes.data || []);
      } catch (err) {
        console.error("Error fetching bookings:", err);
      }
    };
    fetchData();
  }, []);

  const refresh = async () => {
    try {
      const [foodRes, barberRes, laundryRes] = await Promise.all([
        api.get("/food/my-orders"),
        api.get("/barber/my-bookings"),
        api.get("/laundry/my-bookings"),
      ]);
      setFoodOrders(foodRes.data || []);
      setBarberBookings(barberRes.data || []);
      setLaundryBookings(laundryRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Actions: cancel / edit
  const cancelFood = async (id) => {
    try {
      await api.delete(`/food/orders/${id}`);
      toast.success("Order cancelled");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel order");
    }
  };

  const completeFood = async (id) => {
    try {
      await api.put(`/food/orders/${id}`, { status: "delivered", deliveredAt: new Date().toISOString() });
      toast.success("Order marked as delivered");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to complete order");
    }
  };

  const cancelBarber = async (id) => {
    try {
      await api.delete(`/barber/${id}`);
      toast.success("Barber booking cancelled");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel booking");
    }
  };

  const completeBarber = async (id) => {
    try {
      await api.put(`/barber/${id}`, { status: "completed", deliveredAt: new Date().toISOString() });
      toast.success("Barber booking completed");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to complete booking");
    }
  };

  const cancelLaundry = async (id) => {
    try {
      await api.delete(`/laundry/${id}`);
      toast.success("Laundry booking cancelled");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel booking");
    }
  };

  const completeLaundry = async (id) => {
    try {
      await api.put(`/laundry/${id}`, { status: "delivered", deliveredAt: new Date().toISOString() });
      toast.success("Laundry booking delivered");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to complete booking");
    }
  };

  const editBarber = async (b) => {
    const newSlot = window.prompt("Enter new slot (e.g., 10:00 AM)", b.slot);
    if (!newSlot || newSlot === b.slot) return;
    try {
      await api.put(`/barber/${b._id}`, { slot: newSlot });
      toast.success("Barber booking updated");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update booking");
    }
  };

  const editLaundry = async (l) => {
    const newSlot = window.prompt("Enter new slot (e.g., 1:00 PM)", l.slot);
    if (!newSlot || newSlot === l.slot) return;
    try {
      await api.put(`/laundry/${l._id}`, { slot: newSlot });
      toast.success("Laundry booking updated");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update booking");
    }
  };

  const formatDateTime = (date) =>
    date ? new Date(date).toLocaleString() : "—";

  const StatusBadge = ({ status }) => {
    const normalized = (status || "").toLowerCase();
    const color =
      normalized === "delivered" || normalized === "completed"
        ? "bg-green-100 text-green-700"
        : normalized === "pending" || normalized === "booked"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-gray-100 text-gray-700";
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
        {status || "Unknown"}
      </span>
    );
  };

  const Card = ({ title, metaLeft, metaRight, children }) => (
    <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <div className="flex items-center gap-3">
          {metaLeft}
          {metaRight}
        </div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-padded py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">My Bookings</h2>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="col-span-12 md:col-span-3">
            <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold">
                Bookings Menu
              </div>
              <nav className="p-2">
                {[
                  { key: "Food", label: "Food bookings" },
                  { key: "Barber", label: "Barber bookings" },
                  { key: "Laundry", label: "Laundry bookings" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                      activeTab === item.key
                        ? "bg-purple-50 text-purple-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="col-span-12 md:col-span-9">
            {/* Food Bookings */}
            {activeTab === "Food" && (
              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900">Food Bookings</h3>
                {foodOrders.length === 0 ? (
                  <div className="text-gray-600">No food orders found.</div>
                ) : (
                  foodOrders.map((order, idx) => (
                    <Card
                      key={idx}
                      title={`Order #${order._id?.slice(-6) || idx + 1}`}
                      metaLeft={<StatusBadge status={order.status} />}
                      metaRight={
                        <div className="flex items-center gap-2">
                          {order.status !== "delivered" && order.status !== "cancelled" && (
                            <button onClick={() => completeFood(order._id)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-green-200 text-green-700 hover:bg-green-50">
                              Mark completed
                            </button>
                          )}
                          {order.status !== "cancelled" && (
                            <button onClick={() => cancelFood(order._id)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-red-200 text-red-700 hover:bg-red-50">
                              Cancel
                            </button>
                          )}
                        </div>
                      }
                    >
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500 mb-2">Items</div>
                          <ul className="space-y-1 text-gray-700">
                            {(order.items || []).map((it, i) => (
                              <li key={i} className="flex items-center justify-between">
                                <span>
                                  {it.item} <span className="text-gray-400">({it.shop})</span>
                                </span>
                                <span className="font-semibold">₹{it.price}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500 mb-2">Timeline</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Booked at</span>
                              <span className="font-medium text-gray-900">{formatDateTime(order.createdAt)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Delivered at</span>
                              <span className="font-medium text-gray-900">{formatDateTime(order.deliveredAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </section>
            )}

            {/* Barber Bookings */}
            {activeTab === "Barber" && (
              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900">Barber Bookings</h3>
                {barberBookings.length === 0 ? (
                  <div className="text-gray-600">No barber bookings found.</div>
                ) : (
                  barberBookings.map((b, idx) => (
                    <Card
                      key={idx}
                      title={`Barber Booking #${b._id?.slice(-6) || idx + 1}`}
                      metaLeft={<StatusBadge status={b.status} />}
                      metaRight={
                        <div className="flex items-center gap-2">
                          {b.status !== "completed" && b.status !== "cancelled" && (
                            <button onClick={() => completeBarber(b._id)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-green-200 text-green-700 hover:bg-green-50">
                              Mark completed
                            </button>
                          )}
                          <button onClick={() => editBarber(b)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                            Edit booking
                          </button>
                          {b.status !== "cancelled" && (
                            <button onClick={() => cancelBarber(b._id)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-red-200 text-red-700 hover:bg-red-50">
                              Cancel
                            </button>
                          )}
                        </div>
                      }
                    >
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500 mb-2">Details</div>
                          <div className="text-gray-700">Slot: <span className="font-medium">{b.slot}</span></div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500 mb-2">Timeline</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Booked at</span>
                              <span className="font-medium text-gray-900">{formatDateTime(b.createdAt)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Completed at</span>
                              <span className="font-medium text-gray-900">{formatDateTime(b.deliveredAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </section>
            )}

            {/* Laundry Bookings */}
            {activeTab === "Laundry" && (
              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900">Laundry Bookings</h3>
                {laundryBookings.length === 0 ? (
                  <div className="text-gray-600">No laundry bookings found.</div>
                ) : (
                  laundryBookings.map((l, idx) => {
                    const getServiceName = () => {
                      if (l.serviceType === "laundry") return "Laundry (Wash & Fold)";
                      if (l.serviceType === "dryclean") return "Dry Clean";
                      if (l.serviceType === "iron") return "Ironing";
                      return "Laundry Service";
                    };

                    const getItemLabels = () => {
                      if (l.serviceType === "laundry") {
                        return { tshirt: "T-shirt", pant: "Pant", shirt: "Shirt", jacket: "Jacket" };
                      }
                      if (l.serviceType === "dryclean") {
                        return { suit: "Suit", blazer: "Blazer", dress: "Dress", coat: "Coat" };
                      }
                      if (l.serviceType === "iron") {
                        return { shirt: "Shirt", pant: "Pant", kurta: "Kurta", saree: "Saree" };
                      }
                      return {};
                    };

                    const getItems = () => {
                      if (l.items?.washFold) return l.items.washFold;
                      if (l.items?.dryClean) return l.items.dryClean;
                      if (l.items?.ironing) return l.items.ironing;
                      return {};
                    };

                    const items = getItems();
                    const itemLabels = getItemLabels();
                    const hasItems = Object.values(items).some(qty => qty > 0);

                    return (
                      <Card
                        key={idx}
                        title={`${getServiceName()} #${l._id?.slice(-6) || idx + 1}`}
                        metaLeft={<StatusBadge status={l.status} />}
                        metaRight={
                          <div className="flex items-center gap-2">
                            {l.status !== "delivered" && l.status !== "cancelled" && (
                              <button onClick={() => completeLaundry(l._id)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-green-200 text-green-700 hover:bg-green-50">
                                Mark completed
                              </button>
                            )}
                            <button onClick={() => editLaundry(l)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-teal-200 text-teal-700 hover:bg-teal-50">
                              Edit booking
                            </button>
                            {l.status !== "cancelled" && (
                              <button onClick={() => cancelLaundry(l._id)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-red-200 text-red-700 hover:bg-red-50">
                                Cancel
                              </button>
                            )}
                          </div>
                        }
                      >
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-gray-500 mb-2">Items</div>
                            {hasItems ? (
                              <ul className="space-y-1 text-gray-700">
                                {Object.entries(items).map(([key, qty]) => {
                                  if (qty === 0) return null;
                                  return (
                                    <li key={key} className="flex items-center justify-between">
                                      <span>{itemLabels[key] || key}</span>
                                      <span className="font-semibold">x{qty}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <div className="text-gray-600">Slot: <span className="font-medium">{l.slot}</span></div>
                            )}
                            {l.totalAmount > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Total Amount</span>
                                  <span className="font-bold text-purple-600">₹{l.totalAmount}</span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm text-gray-500 mb-2">Timeline</div>
                            <div className="space-y-2">
                              {l.pickupDate && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Pickup</span>
                                  <span className="font-medium text-gray-900">{l.pickupDate} {l.pickupTime || ""}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Booked at</span>
                                <span className="font-medium text-gray-900">{formatDateTime(l.createdAt)}</span>
                              </div>
                              {l.deliveryOption && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Delivery</span>
                                  <span className="font-medium text-gray-900">
                                    {l.deliveryOption === "express" ? "Tomorrow" : "2-3 Work days"}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Delivered at</span>
                                <span className="font-medium text-gray-900">{formatDateTime(l.deliveredAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
