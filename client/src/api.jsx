import axios from "axios";

const api = axios.create({
  baseURL: "https://campus-ease-yg63.onrender.com", // change to deployed URL later
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
