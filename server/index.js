require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const authRoutes    = require("./routes/auth");
const channelRoutes = require("./routes/channels");
const messageRoutes = require("./routes/messages");
const { handleSocket } = require("./socket");

const app    = express();
const server = http.createServer(app);

// Ensure storage dirs exist (important for Termux first run)
["uploads", "data"].forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// ── Socket.io ────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── API Routes ───────────────────────────────────────────────
app.get("/ping", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth",     authRoutes);
app.use("/api",          channelRoutes);
app.use("/api/messages", messageRoutes);

// ── Serve built frontend (production / Termux) ───────────────
// The React build is placed one level up in /dist after running `npm run build`
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // For React Router — any unknown route serves index.html (Express 5 syntax)
  app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  // Dev mode fallback (Vite dev server handles the frontend)
  app.get("/", (req, res) =>
    res.json({ status: "🥥 CocoDrop API running", mode: "development" })
  );
}

handleSocket(io);

// ── Keep-alive ping (prevents Render free tier spin-down) ────
// Pings itself every 14 minutes so the server never goes idle
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`;

function keepAlivePing() {
  try {
    // Use https for Render (https URL), http for local
    const isHttps = SELF_URL.startsWith("https");
    const transport = isHttps ? require("https") : http;
    const req = transport.get(`${SELF_URL}/ping`, (res) => {
      console.log(`🏓 keep-alive ping → ${res.statusCode}`);
    });
    req.on("error", (err) => console.warn("keep-alive ping failed:", err.message));
    req.setTimeout(10000, () => { req.destroy(); });
  } catch (err) {
    console.warn("keep-alive error:", err.message);
  }
}

// Start pinging after 1 min (give server time to fully start), then every 14 min
setTimeout(() => {
  keepAlivePing();
  setInterval(keepAlivePing, 14 * 60 * 1000);
}, 60 * 1000);

// ── Global error handlers (prevent crashes from unhandled errors) ────
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  // 0.0.0.0 = accessible from other devices on same WiFi (important for Termux)
  console.log(`\n🥥 CocoDrop server → http://localhost:${PORT}`);
  console.log(`📱 From phone/Termux → http://YOUR_IP:${PORT}`);
  console.log(`📁 Data saved to: ${path.join(__dirname, "data")}\n`);
});
