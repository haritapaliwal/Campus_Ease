import { useState, useContext, useEffect } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import AuthPrompt from "../components/AuthPrompt";

const normalizeLaundryCatalog = (record = {}) => ({
  laundry: record?.laundry || [],
  dryclean: record?.dryclean || [],
  iron: record?.iron || [],
});
const CAMPUS_LAUNDRY_NAME = "Campus Laundry";

export default function LaundryPage() {
  const { token, refreshToken } = useContext(AuthContext);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [currentView, setCurrentView] = useState("home"); // "home" or "checkout"
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Service selection state
  const [selectedService, setSelectedService] = useState(null);
  const [laundryShops, setLaundryShops] = useState([]);
  const [activeShopId, setActiveShopId] = useState(null);
  const [catalog, setCatalog] = useState({ laundry: [], dryclean: [], iron: [] });
  const [quantities, setQuantities] = useState({});
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const activeShop = laundryShops.find((shop) => shop._id === activeShopId) || null;

  // Pickup and delivery state
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("08:00-9:00am");
  const [deliveryOption, setDeliveryOption] = useState("standard"); // "standard" or "express"

  useEffect(() => {
    // Set default pickup date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setPickupDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    const loadShops = async () => {
      setIsLoadingCatalog(true);
      try {
        const res = await api.get("/laundry/shops");
        const shops = res.data || [];
        const campusShop =
          shops.find((shop) => (shop.name || "").toLowerCase() === CAMPUS_LAUNDRY_NAME.toLowerCase()) ||
          shops[0];
        if (campusShop) {
          setLaundryShops([campusShop]);
          setActiveShopId(campusShop._id);
          setCatalog(normalizeLaundryCatalog(campusShop.laundryCatalog));
        } else {
          setLaundryShops([]);
          setActiveShopId(null);
          setCatalog(normalizeLaundryCatalog());
        }
      } catch (err) {
        console.error("Failed to load laundry shops", err);
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    loadShops();
  }, []);

  useEffect(() => {
    if (!activeShopId) return;
    const shop = laundryShops.find((s) => s._id === activeShopId);
    setCatalog(normalizeLaundryCatalog(shop?.laundryCatalog));
    setQuantities({});
  }, [activeShopId, laundryShops]);

  const handleServiceSelect = (service) => {
    if (!token) {
      setShowAuthPrompt(true);
      return;
    }
    if (!activeShopId) {
      alert("Laundry service is currently unavailable.");
      return;
    }
    setSelectedService(service);
    setCurrentView("checkout");
    setQuantities({});
  };

  const updateQuantity = (itemId, change) => {
    if (!token) {
      setShowAuthPrompt(true);
      return;
    }
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      const nextValue = Math.max(0, current + change);
      if (nextValue === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: nextValue };
    });
  };

  const categoryKey = selectedService === "dryclean" ? "dryclean" : selectedService === "iron" ? "iron" : "laundry";
  const currentCatalog = catalog[categoryKey] || [];
  const selectedOrderItems = currentCatalog
    .map((item) => ({ ...item, quantity: quantities[item._id] || 0 }))
    .filter((item) => item.quantity > 0);
  const hasSelectedItems = selectedOrderItems.length > 0;
  const getTotalItems = () => selectedOrderItems.reduce((sum, item) => sum + item.quantity, 0);
  const getTotalPrice = () => {
    const baseTotal = selectedOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return baseTotal + (deliveryOption === "express" ? 25 : 0);
  };
  const serviceCards = [
    {
      key: "dryclean",
      title: "Dry Clean",
      description: "Professional dry cleaning service",
      iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
      key: "laundry",
      title: "Laundry",
      description: "Wash & fold service",
      iconPath: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    },
    {
      key: "iron",
      title: "Iron",
      description: "Professional ironing service",
      iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
  ];

  const handlePlaceOrder = () => {
    if (!hasSelectedItems) {
      alert("Please add at least one item to your order");
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmOrder = async () => {
    try {
      // Verify token is still valid
      if (!token) {
        setShowConfirmDialog(false);
        setShowAuthPrompt(true);
        return;
      }

      if (!activeShopId) {
        alert("Laundry service is currently unavailable.");
        setShowConfirmDialog(false);
        return;
      }

      const orderLines = selectedOrderItems.map((item) => ({
        itemId: item._id,
        quantity: item.quantity,
      }));

      const orderData = {
        shopId: activeShopId,
        items: orderLines,
        pickupDate,
        pickupTime,
        deliveryOption,
        serviceType: selectedService || "laundry",
      };

      const response = await api.post("/laundry/book", orderData);
      
      if (response.data) {
        setShowConfirmDialog(false);
        
        // Show success message
        alert("Order placed successfully!");
        
        // Reset state
        setQuantities({});
        setCurrentView("home");
        setSelectedService(null);
      }
    } catch (err) {
      setShowConfirmDialog(false);
      const errorMessage = err.response?.data?.message || err.message || "Order failed";
      
      if (errorMessage.includes("Invalid Token") || errorMessage.includes("Unauthorized") || err.response?.status === 401) {
        // Token is invalid, clear it and show auth prompt
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("shopId");
        if (refreshToken) refreshToken(); // Refresh AuthContext state
        setShowAuthPrompt(true);
        alert("Your session has expired. Please login again.");
      } else {
        alert(errorMessage);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const months = ["January", "February", "March", "April", "May", "June", 
                   "July", "August", "September", "October", "November", "December"];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const getServiceName = () => {
    if (selectedService === "laundry") return "Laundry (Wash & Fold)";
    if (selectedService === "dryclean") return "Dry Clean";
    if (selectedService === "iron") return "Ironing";
    return "Service";
  };

  // Home/Dashboard View
  if (currentView === "home") {
    return (
      <div className="min-h-screen bg-gray-50">
        <AuthPrompt 
          isOpen={showAuthPrompt} 
          onClose={() => setShowAuthPrompt(false)}
          title="Sign in to Book Laundry Service"
        />

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white py-6">
          <div className="container-padded">
            <div className="flex items-center justify-between mb-4">
              <button className="w-10 h-10 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-1">Welcome customer</h1>
            <p className="text-purple-100">Choose the laundry Service, which you are interested in today</p>
          </div>
        </div>

        <div className="container-padded py-8 space-y-6">
          {isLoadingCatalog ? (
            <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-600">
              Loading laundry partners...
            </div>
          ) : laundryShops.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-600">
              Laundry services are not available right now. Please check back later.
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-sm text-gray-500">Laundry partner</p>
              <h3 className="text-2xl font-bold text-gray-900">
                {activeShop?.name || CAMPUS_LAUNDRY_NAME}
              </h3>
              <p className="text-xs uppercase tracking-widest text-gray-400 mt-1">
                {activeShop?.type || "laundry"}
              </p>
            </div>
          )}

          {/* Service Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {serviceCards.map((card) => {
              const serviceCatalog = catalog[card.key] || [];
              const disabled = !activeShopId || serviceCatalog.length === 0;
              return (
                <button
                  key={card.key}
                  onClick={() => handleServiceSelect(card.key)}
                  disabled={disabled}
                  className={`bg-white rounded-2xl p-6 shadow-lg text-center transition-all duration-300 ${
                    disabled ? "opacity-60 cursor-not-allowed" : "hover:shadow-2xl hover:scale-105"
                  }`}
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.iconPath} />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{card.title}</h3>
                  <p className="text-gray-600 text-sm">{card.description}</p>
                  {disabled && (
                    <p className="text-xs text-red-500 mt-3">Not available right now</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Checkout/Order Summary View

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AuthPrompt 
        isOpen={showAuthPrompt} 
        onClose={() => setShowAuthPrompt(false)}
        title="Sign in to Place Order"
      />

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl transform transition-all duration-300 scale-100">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Confirm Your Order</h2>
              <p className="text-gray-600 mb-8 text-lg">
                Please review your order details before confirming
              </p>
              
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 mb-8 border border-purple-100">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">Order Summary</h3>
                <div className="space-y-3 text-sm mb-4">
                  <div className="font-semibold text-gray-700 mb-2">{getServiceName()}</div>
                  {selectedOrderItems.map((item) => (
                    <div key={item._id} className="flex justify-between items-center bg-white rounded-lg p-3 shadow-sm">
                      <div>
                        <span className="font-semibold text-gray-900">{item.name}</span>
                        <span className="text-gray-500 ml-2">x{item.quantity}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-purple-600">₹{item.price * item.quantity}</span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    {deliveryOption === "express" && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Express Delivery</span>
                        <span className="font-semibold">₹25</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg p-3">
                      <span className="font-bold text-lg">Total</span>
                      <span className="font-bold text-xl">₹{getTotalPrice()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-left text-sm text-gray-600 mt-4">
                  <p><strong>Pickup:</strong> {formatDate(pickupDate)} at {pickupTime}</p>
                  <p><strong>Delivery:</strong> {deliveryOption === "express" ? "Tomorrow" : "2-3 Work days"}</p>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transform transition-all duration-300 hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmOrder}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 transform transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  Confirm Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="container-padded">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setCurrentView("home");
                setSelectedService(null);
              }}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-bold text-gray-900">{getServiceName()}</h2>
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="container-padded py-6">
        {/* Service Items Section */}
        <div className="bg-white rounded-2xl shadow-lg mb-4 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">{getServiceName()}</h3>
          </div>
          
          <div className="px-6 pb-4 pt-4 space-y-4">
            {currentCatalog.length === 0 ? (
              <div className="py-6 text-center text-gray-500">
                This service is not configured yet. Please go back and choose another service.
              </div>
            ) : (
              currentCatalog.map((item) => (
                <div key={item._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <span className="text-gray-700 font-medium">{item.name}</span>
                    <span className="text-purple-600 font-semibold ml-3">₹{item.price}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => updateQuantity(item._id, -1)}
                      className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="w-8 text-center font-semibold">{quantities[item._id] || 0}</span>
                    <button
                      onClick={() => updateQuantity(item._id, 1)}
                      className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full flex items-center justify-center hover:from-purple-600 hover:to-blue-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pickup Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Pickup</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              {pickupDate && (
                <div className="mb-2 text-gray-900 font-medium">{formatDate(pickupDate)}</div>
              )}
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
              <select
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="08:00-9:00am">08:00-9:00am</option>
                <option value="09:00-10:00am">09:00-10:00am</option>
                <option value="10:00-11:00am">10:00-11:00am</option>
                <option value="11:00-12:00pm">11:00-12:00pm</option>
                <option value="12:00-1:00pm">12:00-1:00pm</option>
                <option value="1:00-2:00pm">1:00-2:00pm</option>
              </select>
            </div>
          </div>
        </div>

        {/* Delivered by Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Delivered by</h3>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-purple-300 transition-colors">
              <input
                type="radio"
                name="delivery"
                value="standard"
                checked={deliveryOption === "standard"}
                onChange={(e) => setDeliveryOption(e.target.value)}
                className="w-5 h-5 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1">
                <span className="font-semibold text-gray-900">2-3 Work days</span>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 ${deliveryOption === "standard" ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                {deliveryOption === "standard" && (
                  <div className="w-full h-full rounded-full bg-purple-600"></div>
                )}
              </div>
            </label>
            <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-purple-300 transition-colors">
              <input
                type="radio"
                name="delivery"
                value="express"
                checked={deliveryOption === "express"}
                onChange={(e) => setDeliveryOption(e.target.value)}
                className="w-5 h-5 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1">
                <span className="font-semibold text-gray-900">Tomorrow</span>
                <span className="text-purple-600 ml-2">(₹25)</span>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 ${deliveryOption === "express" ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                {deliveryOption === "express" && (
                  <div className="w-full h-full rounded-full bg-purple-600"></div>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Total and Place Order Button */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-gray-900">Total Items</span>
            <span className="text-lg font-bold text-purple-600">{getTotalItems()}</span>
          </div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-xl font-bold text-gray-900">Total Amount</span>
            <span className="text-2xl font-bold text-purple-600">₹{getTotalPrice()}</span>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={!hasSelectedItems}
            className={`w-full py-4 rounded-xl font-bold text-lg transform transition-all duration-300 shadow-lg ${
              hasSelectedItems
                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 hover:scale-105"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Place Order
          </button>
        </div>
      </div>
    </div>
  );
}
