require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth");
const channelRoutes = require("./routes/channels");
const messageRoutes = require("./routes/messages");
const { handleSocket } = require("./socket");

const app = express();
const server = http.createServer(app);

["uploads", "data"].forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api", channelRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => res.json({ status: "CocoDrop server running" }));

handleSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`CocoDrop server running at http://localhost:${PORT}`);
});
