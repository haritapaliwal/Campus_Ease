import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { token, role } = useContext(AuthContext);
  const effectiveRole = role || localStorage.getItem("role") || "customer";

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If allowedRoles is provided, check if the user's role is in the array
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(effectiveRole)) {
    // If student tries to visit owner page, redirect to home, else login
    return <Navigate to="/" replace />;
  }

  return (
    <div className="py-6">
      {children}
    </div>
  );
}
