import axios from "axios";

const SERVER_IP = window.location.hostname;
export const SERVER_URL = `http://${SERVER_IP}:4000`;

const API = axios.create({ baseURL: `${SERVER_URL}/api` });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("sc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
