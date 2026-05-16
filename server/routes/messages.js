const express = require("express");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const { messages } = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "cocodrop_secret";

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Upload image to a channel
router.post("/upload/:channelId", auth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const msg = {
    channelId: req.params.channelId,
    senderId: req.user.id,
    senderName: req.user.username,
    type: "image",
    content: `/uploads/${req.file.filename}`,
    timestamp: new Date(),
  };
  messages.insert(msg, (err, saved) => {
    if (err) return res.status(500).json({ error: "Upload failed" });
    res.json(saved);
  });
});

module.exports = router;
