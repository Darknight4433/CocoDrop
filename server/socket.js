const jwt = require("jsonwebtoken");
const { messages, dms, users } = require("./db");
const { canViewChannel, canSendToChannel } = require("./channelAccess");

const JWT_SECRET = process.env.JWT_SECRET || "cocodrop_secret";
const onlineUsers = {};

function handleSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { id: userId, username } = socket.user;
    onlineUsers[socket.id] = { userId, username, status: "online" };
    console.log(`${username} connected`);
    io.emit("online_users", Object.values(onlineUsers));

    socket.on("set_status", (status) => {
      const allowed = ["online", "busy", "away", "dnd"];
      if (allowed.includes(status) && onlineUsers[socket.id]) {
        onlineUsers[socket.id].status = status;
        io.emit("online_users", Object.values(onlineUsers));
      }
    });

    socket.on("join_channel", (channelId) => {
      canViewChannel(channelId, username, (err, allowed) => {
        if (!err && allowed) socket.join(channelId);
      });
    });

    socket.on("leave_channel", (channelId) => {
      socket.leave(channelId);
    });

    socket.on("send_message", (data) => {
      canSendToChannel(data.channelId, username, (accessErr, allowed) => {
        if (accessErr || !allowed) {
          socket.emit("channel_error", "Not allowed in this channel");
          return;
        }

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
            io.to(data.channelId).emit("receive_message", saved);
            dms.update({ _id: data.channelId }, { $set: { updatedAt: new Date() } }, {});
          }
        });
      });
    });

    socket.on("broadcast_image", (msg) => {
      canSendToChannel(msg.channelId, username, (err, allowed) => {
        if (!err && allowed) io.to(msg.channelId).emit("receive_message", msg);
      });
    });

    socket.on("typing", ({ channelId }) => {
      canSendToChannel(channelId, username, (err, allowed) => {
        if (!err && allowed) socket.to(channelId).emit("user_typing", { username, channelId });
      });
    });

    socket.on("stop_typing", ({ channelId }) => {
      canSendToChannel(channelId, username, (err, allowed) => {
        if (!err && allowed) socket.to(channelId).emit("user_stop_typing", { username, channelId });
      });
    });

    socket.on("delete_message", ({ messageId, channelId }) => {
      canSendToChannel(channelId, username, (err, allowed) => {
        if (!err && allowed) io.to(channelId).emit("message_deleted", { messageId, channelId });
      });
    });
 
    socket.on("edit_message", ({ message, channelId }) => {
      canSendToChannel(channelId, username, (err, allowed) => {
        if (!err && allowed) io.to(channelId).emit("message_edited", { message, channelId });
      });
    });
 
    socket.on("disconnect", () => {
      console.log(`${username} disconnected`);
      delete onlineUsers[socket.id];
      io.emit("online_users", Object.values(onlineUsers));
    });
  });
}

module.exports = { handleSocket };
