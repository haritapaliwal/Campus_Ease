import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [role, setRole] = useState(localStorage.getItem("role") || "student");
  const [shopId, setShopId] = useState(localStorage.getItem("shopId") || null);

  // Sync with localStorage changes (e.g., from other tabs or after token removal)
  useEffect(() => {
    const handleStorageChange = () => {
      const storedToken = localStorage.getItem("token");
      const storedRole = localStorage.getItem("role") || "student";
      const storedShopId = localStorage.getItem("shopId");
      
      if (storedToken !== token) {
        setToken(storedToken);
      }
      if (storedRole !== role) {
        setRole(storedRole);
      }
      if (storedShopId !== shopId) {
        setShopId(storedShopId);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [token, role, shopId]);

  const login = (jwt, userRole = "student", userShopId = null) => {
    setToken(jwt);
    setRole(userRole);
    setShopId(userShopId);
    localStorage.setItem("token", jwt);
    localStorage.setItem("role", userRole);
    if (userShopId) localStorage.setItem("shopId", userShopId);
    else localStorage.removeItem("shopId");
  };

  const logout = () => {
    setToken(null);
    setRole("student");
    setShopId(null);
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("shopId");
  };

  // Method to refresh token from localStorage (useful when token is cleared externally)
  const refreshToken = () => {
    const storedToken = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role") || "student";
    const storedShopId = localStorage.getItem("shopId");
    
    setToken(storedToken);
    setRole(storedRole);
    setShopId(storedShopId);
  };

  return (
    <AuthContext.Provider value={{ token, role, shopId, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};
