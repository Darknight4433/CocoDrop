const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { users } = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "cocodrop_secret";

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

module.exports = router;
