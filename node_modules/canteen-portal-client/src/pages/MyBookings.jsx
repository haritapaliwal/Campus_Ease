import { useEffect, useMemo, useState } from "react";
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

  // Actions: cancel
  const cancelFood = async (id) => {
    try {
      await api.delete(`/food/orders/${id}`);
      toast.success("Order cancelled");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel order");
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

  const cancelLaundry = async (id) => {
    try {
      await api.delete(`/laundry/${id}`);
      toast.success("Laundry booking cancelled");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel booking");
    }
  };

  const formatDateTime = (date) =>
    date ? new Date(date).toLocaleString() : "—";

  const getCardTone = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "accepted") return "bg-green-50 border-green-200";
    if (normalized === "rejected") return "bg-red-50 border-red-200";
    if (normalized === "completed" || normalized === "delivered") return "bg-blue-50 border-blue-200";
    return "bg-white border-gray-100";
  };

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

  const Card = ({ title, metaLeft, metaRight, children, status }) => (
    <div className={`border-2 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow ${getCardTone(status)}`}>
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-transparent">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <div className="flex items-center gap-3">{metaLeft}{metaRight}</div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );

  const foodSegments = useMemo(() => {
    return foodOrders.flatMap((order) => {
      const grouped = (order.items || []).reduce((acc, item) => {
        const shopName = item.shop || "Unknown Shop";
        acc[shopName] = acc[shopName] || [];
        acc[shopName].push(item);
        return acc;
      }, {});
      return Object.entries(grouped).map(([shopName, items]) => ({
        orderId: order._id,
        shopName,
        items,
        status: order.status,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        key: `${order._id}-${shopName}`,
      }));
    });
  }, [foodOrders]);

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
                {foodSegments.length === 0 ? (
                  <div className="text-gray-600">No food orders found.</div>
                ) : (
                  foodSegments.map((segment, idx) => (
                    <Card
                      key={segment.key || idx}
                      title={`${segment.shopName} Order #${segment.orderId?.slice(-6) || idx + 1}`}
                      metaLeft={<StatusBadge status={segment.status} />}
                      metaRight={
                        segment.status !== "cancelled" && (
                          <button onClick={() => cancelFood(segment.orderId)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-red-200 text-red-700 hover:bg-red-50">
                            Cancel
                          </button>
                        )
                      }
                      status={segment.status}
                    >
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500 mb-2">Items</div>
                          <ul className="space-y-1 text-gray-700">
                            {segment.items.map((it, i) => (
                              <li key={i} className="flex items-center justify-between">
                                <span>{it.item}</span>
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
                              <span className="font-medium text-gray-900">{formatDateTime(segment.createdAt)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Delivered at</span>
                              <span className="font-medium text-gray-900">{formatDateTime(segment.deliveredAt)}</span>
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
                        b.status !== "cancelled" && (
                          <button onClick={() => cancelBarber(b._id)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-red-200 text-red-700 hover:bg-red-50">
                            Cancel
                          </button>
                        )
                      }
                      status={b.status}
                    >
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500 mb-2">Details</div>
                          <div className="text-gray-700">Slot: <span className="font-medium">{b.slot}</span></div>
                          {b.bookingDate && (
                            <div className="text-gray-700 mt-1">
                              Date:{" "}
                              <span className="font-medium">
                                {new Date(b.bookingDate).toLocaleDateString('en-US', { 
                                  weekday: 'short', 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          )}
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
                    const serviceName =
                      l.serviceType === "dryclean"
                        ? "Dry Clean"
                        : l.serviceType === "iron"
                        ? "Ironing"
                        : "Laundry (Wash & Fold)";
                    const hasItems = Array.isArray(l.items) && l.items.length > 0;

                    return (
                      <Card
                        key={idx}
                        title={`${serviceName} #${l._id?.slice(-6) || idx + 1}`}
                        metaLeft={<StatusBadge status={l.status} />}
                        metaRight={
                          l.status !== "cancelled" && (
                            <button onClick={() => cancelLaundry(l._id)} className="px-3 py-1 rounded-md text-sm font-medium bg-white border-2 border-red-200 text-red-700 hover:bg-red-50">
                              Cancel
                            </button>
                          )
                        }
                        status={l.status}
                      >
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-gray-500 mb-2">Items</div>
                            {hasItems ? (
                              <ul className="space-y-1 text-gray-700">
                                {l.items.map((item) => (
                                  <li key={item._id || `${item.itemId}-${item.name}`} className="flex items-center justify-between text-sm">
                                    <span>
                                      {item.name}
                                      <span className="text-gray-400 text-xs capitalize ml-1">({item.category})</span>
                                    </span>
                                    <span className="font-semibold">x{item.quantity}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-gray-600">No items recorded.</div>
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
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Delivery option</span>
                                <span className="font-medium text-gray-900">
                                  {l.deliveryOption === "express" ? "Express" : "Standard"}
                                </span>
                              </div>
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
