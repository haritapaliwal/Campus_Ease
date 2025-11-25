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
import OwnerDashboard from "./pages/admin/OwnerDashboard.jsx";

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
          <Route path="/" element={<StudentOnly><HomePage /></StudentOnly>} />
          <Route path="/food" element={<StudentOnly><FoodPage /></StudentOnly>} />
          <Route path="/barber" element={<StudentOnly><BarberPage /></StudentOnly>} />
          <Route path="/laundry" element={<StudentOnly><LaundryPage /></StudentOnly>} />

          {/* Protected Routes */}
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner"
            element={
              <ProtectedRoute requireOwner>
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}


function StudentOnly({ children }) {
  const { role } = useContext(AuthContext);
  const effectiveRole = role || localStorage.getItem("role") || "student";
  if (effectiveRole === "owner") return <Navigate to="/owner" />;
  return children;
}
