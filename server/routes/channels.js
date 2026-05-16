const express = require("express");
const jwt = require("jsonwebtoken");
const { rooms, dms, users, messages } = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "cocodrop_secret";

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
};

// ─── ROOMS ───────────────────────────────────────────────────

// Get rooms: all public + private ones user is a member of
router.get("/rooms", auth, (req, res) => {
  rooms.find({}, (err, allRooms) => {
    if (err) return res.status(500).json({ error: "Server error" });
    const visible = allRooms.filter(r =>
      !r.isPrivate || (r.members && r.members.includes(req.user.username))
    );
    visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(visible);
  });
});

// Create a room
router.post("/rooms", auth, (req, res) => {
  const { name, isPrivate } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Room name required" });

  const room = {
    name: name.trim(),
    isPrivate: !!isPrivate,
    createdBy: req.user.username,
    members: [req.user.username], // creator is always first member
    createdAt: new Date(),
  };

  rooms.insert(room, (err, saved) => {
    if (err) return res.status(500).json({ error: "Failed to create room" });
    res.json(saved);
  });
});

// Join a public room
router.post("/rooms/:id/join", auth, (req, res) => {
  rooms.findOne({ _id: req.params.id }, (err, room) => {
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.isPrivate) return res.status(403).json({ error: "This room is invite-only" });

    const alreadyIn = room.members?.includes(req.user.username);
    if (alreadyIn) return res.json(room); // already a member, fine

    rooms.update(
      { _id: room._id },
      { $push: { members: req.user.username } },
      {},
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to join" });
        res.json({ ...room, members: [...(room.members || []), req.user.username] });
      }
    );
  });
});

// Invite a user to a private room (only creator can do this)
router.post("/rooms/:id/invite", auth, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });

  rooms.findOne({ _id: req.params.id }, (err, room) => {
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.createdBy !== req.user.username)
      return res.status(403).json({ error: "Only the room creator can invite members" });
    if (room.members?.includes(username))
      return res.status(409).json({ error: "User already in room" });

    // Check if target user exists
    users.findOne({ username }, (err, target) => {
      if (!target) return res.status(404).json({ error: "User not found" });

      rooms.update(
        { _id: room._id },
        { $push: { members: username } },
        {},
        (err) => {
          if (err) return res.status(500).json({ error: "Failed to invite" });
          res.json({ success: true, message: `${username} added to room` });
        }
      );
    });
  });
});

// Get room members
router.get("/rooms/:id/members", auth, (req, res) => {
  rooms.findOne({ _id: req.params.id }, (err, room) => {
    if (!room) return res.status(404).json({ error: "Room not found" });
    const isMember = room.members?.includes(req.user.username);
    if (room.isPrivate && !isMember)
      return res.status(403).json({ error: "Not a member" });
    res.json(room.members || []);
  });
});

// ─── DMs ─────────────────────────────────────────────────────

router.get("/dms", auth, (req, res) => {
  dms.find({ participants: req.user.username }).sort({ updatedAt: -1 }).exec((err, docs) => {
    if (err) return res.status(500).json({ error: "Server error" });
    res.json(docs);
  });
});

router.post("/dms", auth, (req, res) => {
  const { targetUsername } = req.body;
  if (!targetUsername) return res.status(400).json({ error: "Target username required" });
  if (targetUsername === req.user.username) return res.status(400).json({ error: "Can't DM yourself" });

  const participants = [req.user.username, targetUsername].sort();
  dms.findOne({ participants }, (err, existing) => {
    if (existing) return res.json(existing);
    dms.insert({ participants, createdAt: new Date(), updatedAt: new Date() }, (err, saved) => {
      if (err) return res.status(500).json({ error: "Failed to create DM" });
      res.json(saved);
    });
  });
});

// ─── MESSAGES ────────────────────────────────────────────────

router.get("/messages/:channelId", auth, (req, res) => {
  // For private rooms, verify membership
  rooms.findOne({ _id: req.params.channelId }, (err, room) => {
    if (room && room.isPrivate && !room.members?.includes(req.user.username)) {
      return res.status(403).json({ error: "Not a member of this room" });
    }
    messages
      .find({ channelId: req.params.channelId })
      .sort({ timestamp: 1 })
      .limit(100)
      .exec((err, docs) => {
        if (err) return res.status(500).json({ error: "Server error" });
        res.json(docs);
      });
  });
});

// ─── USERS ───────────────────────────────────────────────────

router.get("/users/search", auth, (req, res) => {
  const q = req.query.q || "";
  if (q.length < 1) return res.json([]);
  const regex = new RegExp(q, "i");
  users.find({ username: regex }, { username: 1, _id: 0 }, (err, docs) => {
    res.json(docs.filter(u => u.username !== req.user.username).slice(0, 10));
  });
});

module.exports = router;
