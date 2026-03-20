import axios from "axios";

// Normalize VITE_API_URL so it always ends with /api (and support localhost fallback)
const rawApiUrl = import.meta.env.VITE_API_URL;
let baseURL;
if (rawApiUrl) {
  const trimmed = String(rawApiUrl).replace(/\/+$/, ""); // remove trailing slashes
  baseURL = trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
} else {
  // Fallback to local server for testing purposes if VITE_API_URL is missing
  baseURL = "http://localhost:5000/api";
  // To test production, use: baseURL = "https://campus-ease-backend-5bmb.onrender.com/api";
}

const api = axios.create({
  baseURL,
  withCredentials: true, // Required for sending/receiving cookies in cross-origin requests
});

api.interceptors.request.use((config) => {
  // We no longer need to manually set the Authorization header
  // the browser will automatically include the HttpOnly cookie
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor to handle token errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session expired or invalid
      localStorage.removeItem("role");
      localStorage.removeItem("shopId");
      // Don't redirect automatically, let the component handle it
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export default api;
