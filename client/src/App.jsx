import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AuthContext } from "./context/AuthContext.jsx";

import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import FoodPage from "./pages/FoodPage.jsx";
import BarberPage from "./pages/BarberPage.jsx";
import LaundryPage from "./pages/LaundryPage.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import ShopOwnerDashboard from "./pages/shopOwner/ShopOwnerDashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Public Routes */}
          <Route path="/" element={<CustomerOnly><HomePage /></CustomerOnly>} />
          <Route path="/food" element={<CustomerOnly><FoodPage /></CustomerOnly>} />
          <Route path="/barber" element={<CustomerOnly><BarberPage /></CustomerOnly>} />
          <Route path="/laundry" element={<CustomerOnly><LaundryPage /></CustomerOnly>} />

          {/* Protected Routes */}
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shop-owner"
            element={
              <ProtectedRoute allowedRoles={["shop_owner"]}>
                <ShopOwnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}


function CustomerOnly({ children }) {
  const { role } = useContext(AuthContext);
  const effectiveRole = role || localStorage.getItem("role") || "customer";
  if (effectiveRole === "shop_owner") return <Navigate to="/shop-owner" replace />;
  if (effectiveRole === "admin") return <Navigate to="/admin" replace />;
  return children;
}
