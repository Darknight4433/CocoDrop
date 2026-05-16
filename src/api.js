import axios from "axios";

// Auto-detects the server URL:
//   • Always uses VITE_SERVER_URL if set (set in .env.production to Render URL)
//   • In Vite dev mode: falls back to localhost:4000 (proxied by Vite)
//   • In Capacitor Android build: VITE_SERVER_URL must be set — no relative URLs work
const isDev = import.meta.env.DEV;
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || (isDev ? "http://localhost:4000" : "https://cocodrop.onrender.com");

const API = axios.create({ baseURL: `${SERVER_URL}/api` });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("sc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
