import axios from "axios";

// Normalize VITE_API_URL so it always ends with /api (and support localhost fallback)
const rawApiUrl = import.meta.env.VITE_API_URL;
let baseURL;
if (rawApiUrl) {
  const trimmed = String(rawApiUrl).replace(/\/+$/, ""); // remove trailing slashes
  baseURL = trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
} else {
  // Fallback to your deployed backend to keep the frontend functional even if VITE_API_URL is not set
  baseURL = "https://campus-ease-backend-5bmb.onrender.com/api";
}

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor to handle token errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid or expired
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("shopId");
      // Don't redirect automatically, let the component handle it
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export default api;
