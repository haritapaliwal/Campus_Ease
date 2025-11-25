import { useState, useContext, useEffect } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import AuthPrompt from "../components/AuthPrompt";

export default function FoodPage() {
  const { token } = useContext(AuthContext);
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState("daytime");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [activeShop, setActiveShop] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [showOrderConfirm, setShowOrderConfirm] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);

  const [shops, setShops] = useState([]);
  const [recentItems, setRecentItems] = useState([]);

  // Load shops and menus from backend so owner-added items appear here
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/food/shops");
        const addMeta = (s) => ({ ...s, image: s.name?.toLowerCase().includes("ccd") ? "☕" : s.name?.toLowerCase().includes("amul") ? "🥛" : "🍛" });
        setShops((res.data || []).map(addMeta));
      } catch (e) {
        // ignore
      }
    };
    load();
  }, []);

  // Load recently ordered items for quick re-order (uses last 24h "my orders" endpoint)
  useEffect(() => {
    const loadRecent = async () => {
      if (!token) {
        setRecentItems([]);
        return;
      }
      try {
        const res = await api.get("/food/my-orders");
        const orders = res.data || [];
        const seenKey = new Set();
        const items = [];
        // walk newest first
        [...orders]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .forEach((order) => {
            (order.items || []).forEach((it) => {
              const key = `${it.shop}::${it.item}::${it.price}`;
              if (seenKey.has(key)) return;
              seenKey.add(key);
              items.push({
                shop: it.shop,
                item: it.item,
                price: it.price,
              });
            });
          });
        setRecentItems(items.slice(0, 6)); // cap to a few suggestions
      } catch (e) {
        // silent fail; recent section just won't show
      }
    };
    loadRecent();
  }, [token]);

  const shopNames = ["All", "CCD", "Amul", "Vinayak"];

  const addToCart = (shopName, item) => {
    if (!token) {
      setShowAuthPrompt(true);
      return;
    }

    setCart((prevCart) => {
      // Identify items by shop + name + price (since prices may vary per shop)
      const existingIndex = prevCart.findIndex(
        (cartItem) =>
          cartItem.shop === shopName &&
          cartItem.item === item.item &&
          cartItem.price === item.price
      );

      if (existingIndex !== -1) {
        // Increment quantity for existing entry
        return prevCart.map((cartItem, idx) =>
          idx === existingIndex
            ? {
                ...cartItem,
                quantity: (cartItem.quantity || 1) + 1,
              }
            : cartItem
        );
      }

      // Add new entry with default quantity = 1
      return [
        ...prevCart,
        {
          ...item,
          shop: shopName,
          id: Date.now() + Math.random(),
          quantity: 1,
        },
      ];
    });
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const updateQuantity = (id, change) => {
    setCart(cart.map(item => 
      item.id === id 
        ? { ...item, quantity: Math.max(1, (item.quantity || 1) + change) }
        : item
    ));
  };

  const handleOrder = async () => {
    if (!token) {
      setShowAuthPrompt(true);
      return;
    }
    if (cart.length === 0) return alert("Cart is empty!");
    setShowOrderConfirm(true);
  };

  const confirmOrder = async () => {
    try {
      await api.post("/food/order", {
        items: cart,
        orderType,
      });
      setShowOrderConfirm(false);
      setShowOrderSuccess(true);
      setCart([]);
    } catch (err) {
      alert(err.response?.data?.message || "Order failed");
    }
  };

  const filteredShops = activeShop === "All" 
    ? shops 
    : shops.filter(shop => shop.name === activeShop);

  const filteredItems = filteredShops.flatMap(shop => 
    shop.menu.map(item => ({ ...item, shop: shop.name, shopId: shop.id }))
  ).filter(item => 
    item.item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const serviceCharge = orderType === "daytime" ? 0 : 20;
  const finalTotal = totalAmount + serviceCharge;

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthPrompt 
        isOpen={showAuthPrompt} 
        onClose={() => setShowAuthPrompt(false)}
        title="Sign in to Order Food"
      />

      {/* Order Confirmation Popup */}
      {showOrderConfirm && (
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
                <div className="space-y-3 text-sm">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-white rounded-lg p-3 shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center text-lg">
                          {item.image}
                        </div>
                        <div>
                          <span className="font-semibold text-gray-900">{item.item}</span>
                          <p className="text-xs text-gray-500">{item.shop}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-purple-600">₹{item.price * (item.quantity || 1)}</span>
                        <p className="text-xs text-gray-500">x{item.quantity || 1}</p>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    {serviceCharge > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Service Charge</span>
                        <span className="font-semibold">₹{serviceCharge}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg p-3">
                      <span className="font-bold text-lg">Total</span>
                      <span className="font-bold text-xl">₹{finalTotal}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowOrderConfirm(false)}
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

      {/* Order Success Popup */}
      {showOrderSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-300 scale-100">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Order Placed Successfully!</h2>
              <p className="text-gray-600 mb-8 text-lg">
                Your order has been confirmed and will be prepared shortly.
              </p>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 mb-8 border border-green-100">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-green-700">Estimated Time: 20-30 minutes</span>
                </div>
                <p className="text-sm text-gray-600">
                  You will receive updates about your order status.
                </p>
              </div>
              
              <button
                onClick={() => setShowOrderSuccess(false)}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 px-6 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transform transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white py-8">
        <div className="container-padded">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">🍔 Campus Food Hub</h1>
            <p className="text-purple-100">Delicious meals delivered to your campus</p>
          </div>
          
          {/* Search Bar */}
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="What do you want to eat today..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/70 focus:outline-none focus:border-white/40 focus:bg-white/20 transition-all duration-300"
            />
            <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="container-padded py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Shops */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Shops</h2>
              <div className="flex flex-wrap gap-3">
                {shopNames.map((shop) => (
                  <button
                    key={shop}
                    onClick={() => setActiveShop(shop)}
                    className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                      activeShop === shop
                        ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg"
                        : "bg-white text-gray-600 border-2 border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    {shop}
                  </button>
                ))}
              </div>
            </div>

            {/* Recently ordered */}
            {token && recentItems.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Order again</h2>
                  <span className="text-sm text-gray-500">
                    Based on your recent orders
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recentItems.map((item, index) => (
                    <button
                      key={`${item.shop}-${item.item}-${index}`}
                      onClick={() =>
                        addToCart(item.shop, {
                          ...item,
                          image:
                            item.shop?.toLowerCase().includes("ccd")
                              ? "☕"
                              : item.shop?.toLowerCase().includes("amul")
                              ? "🥛"
                              : "🍛",
                        })
                      }
                      className="text-left bg-white rounded-2xl overflow-hidden shadow hover:shadow-lg transform transition-all duration-200 hover:scale-105"
                    >
                      <div className="h-32 bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-5xl">
                        {item.shop?.toLowerCase().includes("ccd")
                          ? "☕"
                          : item.shop?.toLowerCase().includes("amul")
                          ? "🥛"
                          : "🍛"}
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-gray-500 mb-1">{item.shop}</p>
                        <p className="font-semibold text-gray-900 truncate">
                          {item.item}
                        </p>
                        <p className="mt-1 text-lg font-bold text-purple-600">
                          ₹{item.price}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Tap to add again
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Dishes */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Popular Dishes</h2>
                <button className="text-purple-600 font-semibold hover:text-purple-700">
                  View all →
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item, index) => (
                  <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transform transition-all duration-300 hover:scale-105">
                    <div className="h-48 bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-6xl">
                      {item.image}
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-end mb-2">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm text-gray-600 ml-1">{item.rating}</span>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{item.item}</h3>
                      <p className="text-sm text-gray-600 mb-3">{item.shop}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-purple-600">₹{item.price}</span>
                        <button 
                          onClick={() => addToCart(item.shop, item)}
                          className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full flex items-center justify-center hover:from-purple-600 hover:to-blue-600 transform transition-all duration-300 hover:scale-110 shadow-lg"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="lg:w-96">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Order Menu</h3>
              
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🛒</div>
                  <p className="text-gray-500">Your cart is empty</p>
                  <p className="text-sm text-gray-400">Add some delicious items to get started!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center text-2xl">
                          {item.image}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{item.item}</h4>
                          <p className="text-sm text-gray-600">{item.shop}</p>
                          <p className="text-lg font-bold text-purple-600">₹{item.price}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="w-8 text-center font-semibold">{item.quantity || 1}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Order Type Selection */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Delivery Option</h4>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="daytime"
                          checked={orderType === "daytime"}
                          onChange={(e) => setOrderType(e.target.value)}
                          className="mr-3 text-purple-600"
                        />
                        <span className="text-gray-700">Daytime Pickup</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="night"
                          checked={orderType === "night"}
                          onChange={(e) => setOrderType(e.target.value)}
                          className="mr-3 text-purple-600"
                        />
                        <span className="text-gray-700">Night Delivery</span>
                      </label>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="border-t pt-4 mb-6">
                    {serviceCharge > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Service Charge</span>
                        <span className="text-gray-600">₹{serviceCharge}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-gray-900">Total</span>
                      <span className="text-2xl font-bold text-purple-600">₹{finalTotal}</span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button 
                    onClick={handleOrder}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-600 hover:to-blue-600 transform transition-all duration-300 hover:scale-105 shadow-lg"
                  >
                    Checkout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
