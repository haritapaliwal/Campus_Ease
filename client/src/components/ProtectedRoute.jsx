import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children, requireOwner = false }) {
  const { token, role } = useContext(AuthContext);
  const effectiveRole = role || localStorage.getItem("role") || "student";

  if (!token) {
    return <Navigate to="/login" />;
  }

  if (requireOwner && effectiveRole !== "owner") {
    return <Navigate to="/" />;
  }

  return (
    <div className="py-6">
      {children}
    </div>
  );
}
