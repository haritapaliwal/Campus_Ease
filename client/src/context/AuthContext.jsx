import { createContext, useState, useEffect } from "react";
import api from "../api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [role, setRole] = useState(localStorage.getItem("role") || "customer");
  const [shopId, setShopId] = useState(localStorage.getItem("shopId") || null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("role"));
  const [cookiesBlocked, setCookiesBlocked] = useState(
    localStorage.getItem("cookies_blocked") === "true"
  );

  // Sync with localStorage changes (e.g., from other tabs or after token removal)
  // Sync with localStorage changes (for role/shopId persistence)
  useEffect(() => {
    const handleStorageChange = () => {
      const storedRole = localStorage.getItem("role") || "customer";
      const storedShopId = localStorage.getItem("shopId");
      
      if (storedRole !== role) setRole(storedRole);
      if (storedShopId !== shopId) setShopId(storedShopId);
      setIsLoggedIn(!!localStorage.getItem("role"));
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [role, shopId]);

  // Check if third-party cookies are blocked by browser settings
  useEffect(() => {
    const checkCookies = async () => {
      try {
        // Step 1: Set test cookie
        await api.post("/auth/cookie-test-set");
        // Step 2: Verify test cookie
        const res = await api.post("/auth/cookie-test-verify");
        if (res.data && res.data.allowed === false) {
          setCookiesBlocked(true);
          localStorage.setItem("cookies_blocked", "true");
        } else {
          setCookiesBlocked(false);
          localStorage.removeItem("cookies_blocked");
          // Clean up fallback token if cookies are now allowed
          localStorage.removeItem("token");
        }
      } catch (err) {
        console.error("Third-party cookie check failed:", err);
        // On error, don't change states to maintain offline stability
      }
    };
    checkCookies();
  }, []);

  const login = (jwtToken, userRole = "customer", userShopId = null) => {
    setRole(userRole);
    setShopId(userShopId);
    setIsLoggedIn(true);
    localStorage.setItem("role", userRole);
    if (userShopId) localStorage.setItem("shopId", userShopId);
    else localStorage.removeItem("shopId");

    // If cookies are blocked (fallback active), save the token in localStorage
    if (cookiesBlocked && jwtToken) {
      localStorage.setItem("token", jwtToken);
    } else {
      localStorage.removeItem("token");
    }
  };

  const logout = async () => {
    try {
      // Call backend to clear the cookie
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      setRole("customer");
      setShopId(null);
      setIsLoggedIn(false);
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("shopId");
    }
  };

  // Method to refresh token from localStorage (useful when token is cleared externally)
  // Updated refreshToken to check role instead of token
  const refreshToken = () => {
    const storedRole = localStorage.getItem("role") || "customer";
    const storedShopId = localStorage.getItem("shopId");
    
    setRole(storedRole);
    setShopId(storedShopId);
    setIsLoggedIn(!!localStorage.getItem("role"));
  };

  return (
    <AuthContext.Provider value={{ token: isLoggedIn ? "present" : null, role, shopId, isLoggedIn, login, logout, refreshToken, cookiesBlocked }}>
      {children}
    </AuthContext.Provider>
  );
};
