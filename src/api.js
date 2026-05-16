import axios from "axios";

// Auto-detects the server URL:
//   • In production (served by Express): same origin → relative URL ""
//   • In Vite dev mode: Vite proxies /api → Express on 4000
//   • Override with VITE_SERVER_URL in .env.local if needed
const isDev = import.meta.env.DEV;
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || (isDev ? "http://localhost:4000" : "");

const API = axios.create({ baseURL: `${SERVER_URL}/api` });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("sc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
