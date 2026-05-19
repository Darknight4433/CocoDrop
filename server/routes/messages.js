const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { messages } = require("../db");
const { canSendToChannel } = require("../channelAccess");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "cocodrop_secret";

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Use memory storage — convert to base64 so images survive Render redeploys
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
});

router.post("/upload/:channelId", auth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  canSendToChannel(req.params.channelId, req.user.username, (accessErr, allowed) => {
    if (accessErr) return res.status(500).json({ error: "Upload failed" });
    if (!allowed) return res.status(403).json({ error: "Not allowed in this channel" });

    // Store as base64 data URL — survives server restarts and redeploys
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const msg = {
      channelId: req.params.channelId,
      senderId: req.user.id,
      senderName: req.user.username,
      type: "image",
      content: base64,
      timestamp: new Date(),
    };

    messages.insert(msg, (err, saved) => {
      if (err) return res.status(500).json({ error: "Upload failed" });
      res.json(saved);
    });
  });
});

// Edit message — sender only
router.patch("/:id", auth, (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Content required" });

  messages.findOne({ _id: req.params.id }, (err, msg) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.senderName !== req.user.username)
      return res.status(403).json({ error: "You can only edit your own messages" });

    messages.update(
      { _id: msg._id },
      { $set: { content: content.trim(), isEdited: true, updatedAt: new Date() } },
      { returnUpdatedDocs: true },
      (updateErr, num, updated) => {
        if (updateErr) return res.status(500).json({ error: "Failed to edit" });
        res.json(updated);
      }
    );
  });
});

// Delete message — sender only
router.delete("/:id", auth, (req, res) => {
  messages.findOne({ _id: req.params.id }, (err, msg) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.senderName !== req.user.username)
      return res.status(403).json({ error: "You can only delete your own messages" });

    messages.remove({ _id: msg._id }, {}, (removeErr) => {
      if (removeErr) return res.status(500).json({ error: "Failed to delete" });
      res.json({ success: true, id: req.params.id, channelId: msg.channelId });
    });
  });
});

module.exports = router;
