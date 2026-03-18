import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import api from "../../api.jsx";

export default function AdminDashboard() {
  const { token, logout } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [newShop, setNewShop] = useState({ shopName: '', category: 'canteen', ownerEmail: '', ownerPassword: '' });
  const [createMsg, setCreateMsg] = useState("");

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleDeleteShop = async (shopId) => {
    if (!window.confirm("Are you sure you want to completely remove this shop and its owner?")) return;
    try {
      await api.delete(`/admin/shops/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDashboard();
    } catch (err) {
      alert("Error deleting shop: " + (err.response?.data?.message || err.message));
    }
  };

  const handleCreateShop = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/shops", newShop, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCreateMsg("Shop & Owner created successfully! ✅");
      setNewShop({ shopName: '', category: 'canteen', ownerEmail: '', ownerPassword: '' });
      fetchDashboard();
      setTimeout(() => { setShowCreateShop(false); setCreateMsg(""); }, 2000);
    } catch (err) {
      setCreateMsg("Error: " + (err.response?.data?.message || err.message));
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
      setError("");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center mt-10 text-gray-400">Loading Dashboard...</div>;
  if (error) return <div className="text-center mt-10 text-red-500 text-lg">{error}</div>;
  if (!stats) return null;

  return (
    <div className="min-h-screen bg-[#111] text-white p-6 md:p-12 font-sans selection:bg-rose-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-100 to-gray-500 bg-clip-text text-transparent">
              Super Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-2 text-sm tracking-wide">
              Global overview of platform revenue and activity.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateShop(!showCreateShop)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 transition-all font-medium text-white shadow-lg"
            >
              {showCreateShop ? "Cancel" : "+ Register New Shop"}
            </button>
            <button
              onClick={fetchDashboard}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-medium flex items-center gap-2"
            >
              Refresh Data
            </button>
          </div>
        </div>

        {/* Create Shop Form */}
        {showCreateShop && (
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-xl backdrop-blur-sm relative overflow-hidden">
            <h2 className="text-xl font-medium text-gray-100 mb-4">Register New Shop & Owner</h2>
            <form onSubmit={handleCreateShop} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" required placeholder="Shop Name" 
                value={newShop.shopName} onChange={e => setNewShop({...newShop, shopName: e.target.value})}
                className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-white outline-none focus:border-purple-500 transition-colors"
               />
               <select 
                value={newShop.category} onChange={e => setNewShop({...newShop, category: e.target.value})}
                className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-white outline-none focus:border-purple-500 transition-colors *:bg-black"
               >
                 <option value="canteen">Canteen / Food</option>
                 <option value="barber">Barber Salon</option>
                 <option value="laundry">Laundry Service</option>
               </select>
               <input 
                type="email" required placeholder="Owner Login Email" 
                value={newShop.ownerEmail} onChange={e => setNewShop({...newShop, ownerEmail: e.target.value})}
                className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-white outline-none focus:border-purple-500 transition-colors"
               />
               <input 
                type="password" required placeholder="Owner Secure Password" 
                value={newShop.ownerPassword} onChange={e => setNewShop({...newShop, ownerPassword: e.target.value})}
                className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-white outline-none focus:border-purple-500 transition-colors"
               />
               <div className="md:col-span-2 flex justify-end items-center gap-4">
                 {createMsg && <span className="text-sm text-purple-400">{createMsg}</span>}
                 <button type="submit" className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 transition-all font-medium text-white shadow-lg">
                   Register Shop ✅
                 </button>
               </div>
            </form>
          </div>
        )}

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col justify-center shadow-lg backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Total Active Users</p>
            <p className="text-4xl font-light text-white">{stats.totalUsers}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col justify-center shadow-lg backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Total Platform Revenue</p>
            <p className="text-4xl font-light text-white">₹{stats.totalRevenue.toFixed(2)}</p>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-medium text-gray-100">Revenue by Shop</h2>
            <p className="text-sm text-gray-400 mt-1">Detailed breakdown of transactions and revenue generated per shop.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/[0.02]">
                  <th className="p-4 font-medium">Shop Name</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Transactions</th>
                  <th className="p-4 font-medium text-right">Revenue</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                {stats.breakdown.map((shop) => (
                  <tr key={shop.shopId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-medium text-gray-200">{shop.name}</td>
                    <td className="p-4 capitalize">{shop.category}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        shop.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {shop.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">{shop.bookingsCount || "-"}</td>
                    <td className="p-4 text-right tabular-nums">₹{shop.revenue.toFixed(2)}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDeleteShop(shop.shopId)}
                        className="text-rose-500 hover:text-rose-400 font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {stats.breakdown.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">
                      No shop data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
