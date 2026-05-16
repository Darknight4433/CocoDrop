const jwt = require("jsonwebtoken");
const { messages, dms } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "cocodrop_secret";
const onlineUsers = {}; // socketId → { userId, username }

function handleSocket(io) {
  // Authenticate every socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try { socket.user = jwt.verify(token, JWT_SECRET); next(); }
    catch { next(new Error("Invalid token")); }
  });

  io.on("connection", (socket) => {
    const { id: userId, username } = socket.user;
    onlineUsers[socket.id] = { userId, username };
    console.log(`🟢 ${username} connected`);
    io.emit("online_users", Object.values(onlineUsers));

    // Join a channel room (both group rooms and DMs use same mechanism)
    socket.on("join_channel", (channelId) => {
      socket.join(channelId);
    });

    socket.on("leave_channel", (channelId) => {
      socket.leave(channelId);
    });

    // Send a text message to a channel
    socket.on("send_message", (data) => {
      // data: { channelId, content }
      const msg = {
        channelId: data.channelId,
        senderId: userId,
        senderName: username,
        type: "text",
        content: data.content,
        timestamp: new Date(),
      };
      messages.insert(msg, (err, saved) => {
        if (!err) {
          // Broadcast to everyone in that channel
          io.to(data.channelId).emit("receive_message", saved);
          // Update DM's updatedAt if it's a DM
          dms.update({ _id: data.channelId }, { $set: { updatedAt: new Date() } }, {});
        }
      });
    });

    // Broadcast an uploaded image (already saved via REST)
    socket.on("broadcast_image", (msg) => {
      io.to(msg.channelId).emit("receive_message", msg);
    });

    // Typing indicators (per channel)
    socket.on("typing", ({ channelId }) => {
      socket.to(channelId).emit("user_typing", { username, channelId });
    });

    socket.on("stop_typing", ({ channelId }) => {
      socket.to(channelId).emit("user_stop_typing", { username, channelId });
    });

    socket.on("disconnect", () => {
      console.log(`🔴 ${username} disconnected`);
      delete onlineUsers[socket.id];
      io.emit("online_users", Object.values(onlineUsers));
    });
  });
}

module.exports = { handleSocket };
