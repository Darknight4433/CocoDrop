const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { users } = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "cocodrop_secret";

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Register
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const trimmedUsername = username?.trim();
    if (!trimmedUsername || !password)
      return res.status(400).json({ error: "Username and password required" });

    users.find({}, async (err, docs) => {
      if (err) return res.status(500).json({ error: "Server error" });
      const existing = docs.find((user) => user.username?.trim() === trimmedUsername);
      if (existing) return res.status(409).json({ error: "Username already taken" });

      const hashed = await bcrypt.hash(password, 10);
      users.insert({ username: trimmedUsername, password: hashed, createdAt: new Date() }, (err, user) => {
        if (err) return res.status(500).json({ error: "Server error" });
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ token, user: { id: user._id, username: user.username } });
      });
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Login
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const trimmedUsername = username?.trim();
  if (!trimmedUsername || !password)
    return res.status(400).json({ error: "Username and password required" });

  users.find({}, async (err, docs) => {
    if (err) return res.status(500).json({ error: "Server error" });
    const user = docs.find((item) => item.username?.trim() === trimmedUsername);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    if (user.username !== trimmedUsername) {
      users.update({ _id: user._id }, { $set: { username: trimmedUsername } }, {}, () => {});
    }

    const token = jwt.sign({ id: user._id, username: trimmedUsername }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, username: trimmedUsername } });
  });
});

// Save FCM push token for this user (called on app load)
router.post("/fcm-token", authMiddleware, (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) return res.status(400).json({ error: "fcmToken required" });
  users.update(
    { _id: req.user.id },
    { $set: { fcmToken } },
    {},
    (err) => {
      if (err) return res.status(500).json({ error: "Server error" });
      res.json({ ok: true });
    }
  );
});

module.exports = router;
