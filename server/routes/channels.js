const express = require("express");
const jwt = require("jsonwebtoken");
const { rooms, dms, users, messages } = require("../db");
const { canViewChannel } = require("../channelAccess");

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

router.get("/rooms", auth, (req, res) => {
  rooms.find({}, (err, allRooms) => {
    if (err) return res.status(500).json({ error: "Server error" });
    // Public rooms visible to all; private rooms only visible to members
    const visible = allRooms.filter((room) => !room.isPrivate || room.members?.includes(req.user.username));
    visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // Annotate membership for the client
    const withMembership = visible.map((room) => ({
      ...room,
      isMember: room.members?.includes(req.user.username) || false,
    }));
    res.json(withMembership);
  });
});

router.post("/rooms", auth, (req, res) => {
  const { name, isPrivate } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Room name required" });

  const room = {
    name: name.trim(),
    isPrivate: !!isPrivate,
    createdBy: req.user.username,
    members: [req.user.username],
    createdAt: new Date(),
  };

  rooms.insert(room, (err, saved) => {
    if (err) return res.status(500).json({ error: "Failed to create room" });
    res.json(saved);
  });
});

router.post("/rooms/:id/join", auth, (req, res) => {
  rooms.findOne({ _id: req.params.id }, (err, room) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.isPrivate) return res.status(403).json({ error: "This room is invite-only" });

    const members = room.members || [];
    if (members.includes(req.user.username)) return res.json(room);

    rooms.update(
      { _id: room._id },
      { $push: { members: req.user.username } },
      {},
      (updateErr) => {
        if (updateErr) return res.status(500).json({ error: "Failed to join" });
        res.json({ ...room, members: [...members, req.user.username] });
      }
    );
  });
});

// Leave room — any member except the creator
router.post("/rooms/:id/leave", auth, (req, res) => {
  rooms.findOne({ _id: req.params.id }, (err, room) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.createdBy === req.user.username)
      return res.status(403).json({ error: "You created this room — delete it instead of leaving." });
    const members = (room.members || []).filter((m) => m !== req.user.username);
    rooms.update({ _id: room._id }, { $set: { members } }, {}, (updateErr) => {
      if (updateErr) return res.status(500).json({ error: "Failed to leave" });
      res.json({ success: true });
    });
  });
});


router.post("/rooms/:id/invite", auth, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });

  rooms.findOne({ _id: req.params.id }, (err, room) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.createdBy?.trim() !== req.user.username?.trim()) {
      return res.status(403).json({ error: "Only the room creator can invite members" });
    }
    if (room.members?.includes(username)) return res.status(409).json({ error: "User already in room" });

    users.findOne({ username }, (userErr, target) => {
      if (userErr) return res.status(500).json({ error: "Server error" });
      if (!target) return res.status(404).json({ error: "User not found" });

      rooms.update({ _id: room._id }, { $push: { members: username } }, {}, (updateErr) => {
        if (updateErr) return res.status(500).json({ error: "Failed to invite" });
        res.json({ success: true, message: `${username} added to room` });
      });
    });
  });
});

router.get("/rooms/:id/members", auth, (req, res) => {
  rooms.findOne({ _id: req.params.id }, (err, room) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!room) return res.status(404).json({ error: "Room not found" });
    const isMember = room.members?.includes(req.user.username);
    if (room.isPrivate && !isMember) return res.status(403).json({ error: "Not a member" });
    res.json(room.members || []);
  });
});

// Delete room — host only
router.delete("/rooms/:id", auth, (req, res) => {
  rooms.findOne({ _id: req.params.id }, (err, room) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.createdBy?.trim() !== req.user.username?.trim())
      return res.status(403).json({ error: "Only the room creator can delete this room" });

    rooms.remove({ _id: room._id }, {}, (removeErr) => {
      if (removeErr) return res.status(500).json({ error: "Failed to delete room" });
      messages.remove({ channelId: room._id }, { multi: true }, () => {});
      res.json({ success: true });
    });
  });
});

// Rename room — host only
router.patch("/rooms/:id", auth, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Room name required" });
  rooms.findOne({ _id: req.params.id }, (err, room) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.createdBy?.trim() !== req.user.username?.trim())
      return res.status(403).json({ error: "Only the room creator can rename this room" });
    rooms.update({ _id: room._id }, { $set: { name: name.trim() } }, {}, (updateErr) => {
      if (updateErr) return res.status(500).json({ error: "Failed to rename room" });
      res.json({ ...room, name: name.trim() });
    });
  });
});

// Set user status (busy / online / away / dnd)
router.patch("/users/status", auth, (req, res) => {
  const { status } = req.body;
  const allowed = ["online", "busy", "away", "dnd"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });
  users.update({ _id: req.user.id }, { $set: { status } }, {}, (err) => {
    if (err) return res.status(500).json({ error: "Server error" });
    res.json({ status });
  });
});



router.get("/dms", auth, (req, res) => {
  dms.find({ participants: req.user.username }).sort({ updatedAt: -1 }).exec((err, docs) => {
    if (err) return res.status(500).json({ error: "Server error" });
    // Always return explicit status — never default to "active" here, keep "pending" as-is
    res.json(docs.map((dm) => ({ ...dm, status: dm.status || "pending" })));
  });
});

router.post("/dms", auth, (req, res) => {
  const { targetUsername } = req.body;
  if (!targetUsername) return res.status(400).json({ error: "Target username required" });
  if (targetUsername === req.user.username) return res.status(400).json({ error: "Can't DM yourself" });

  users.findOne({ username: targetUsername }, (userErr, target) => {
    if (userErr) return res.status(500).json({ error: "Server error" });
    if (!target) return res.status(404).json({ error: "User not found" });

    const participants = [req.user.username, targetUsername].sort();
    dms.findOne({ participants }, (err, existing) => {
      if (err) return res.status(500).json({ error: "Failed to create DM" });
      if (existing) return res.json({ ...existing, status: existing.status || "active" });

      const dm = {
        participants,
        requestedBy: req.user.username,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dms.insert(dm, (insertErr, saved) => {
        if (insertErr) return res.status(500).json({ error: "Failed to create DM" });
        res.json(saved);
      });
    });
  });
});

router.post("/dms/:id/accept", auth, (req, res) => {
  dms.findOne({ _id: req.params.id }, (err, dm) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!dm) return res.status(404).json({ error: "DM not found" });
    if (!dm.participants?.includes(req.user.username)) return res.status(403).json({ error: "Not part of this DM" });
    if (dm.requestedBy === req.user.username) {
      return res.status(403).json({ error: "Only the other user can accept this DM" });
    }

    dms.update({ _id: dm._id }, { $set: { status: "active", updatedAt: new Date() } }, {}, (updateErr) => {
      if (updateErr) return res.status(500).json({ error: "Failed to accept DM" });
      res.json({ ...dm, status: "active", updatedAt: new Date() });
    });
  });
});

router.get("/messages/:channelId", auth, (req, res) => {
  canViewChannel(req.params.channelId, req.user.username, (accessErr, allowed, channel) => {
    if (accessErr) return res.status(500).json({ error: "Server error" });
    if (!allowed) return res.status(403).json({ error: "Not allowed in this channel" });

    // Block messages for pending DMs — both requester AND receiver see empty until accepted
    const isDM = channel && Array.isArray(channel.participants);
    const isPendingDM = isDM && (channel.status || "pending") === "pending";
    if (isPendingDM) return res.json({ pending: true, messages: [] });

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

router.get("/users/search", auth, (req, res) => {
  const q = req.query.q || "";
  if (q.length < 1) return res.json([]);
  const regex = new RegExp(q, "i");
  users.find({ username: regex }, { username: 1, _id: 0 }, (err, docs) => {
    if (err) return res.status(500).json({ error: "Server error" });
    res.json(docs.filter((foundUser) => foundUser.username !== req.user.username).slice(0, 10));
  });
});

module.exports = router;
