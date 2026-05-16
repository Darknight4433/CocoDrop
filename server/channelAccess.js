const { rooms, dms } = require("./db");

// Viewing: public rooms open to all, private rooms to members, DMs to any participant (any status — so accept screen shows)
function canViewChannel(channelId, username, cb) {
  rooms.findOne({ _id: channelId }, (roomErr, room) => {
    if (roomErr) return cb(roomErr);
    if (room) {
      const isMember = room.members?.includes(username);
      return cb(null, !room.isPrivate || isMember, room);
    }
    dms.findOne({ _id: channelId }, (dmErr, dm) => {
      if (dmErr) return cb(dmErr);
      if (!dm) return cb(null, false, null);
      return cb(null, dm.participants?.includes(username), dm);
    });
  });
}

// Sending: public rooms open to all, private rooms to members only, DMs only when status=active
function canSendToChannel(channelId, username, cb) {
  rooms.findOne({ _id: channelId }, (roomErr, room) => {
    if (roomErr) return cb(roomErr);
    if (room) {
      const isMember = room.members?.includes(username);
      return cb(null, !room.isPrivate || isMember, room);
    }
    dms.findOne({ _id: channelId }, (dmErr, dm) => {
      if (dmErr) return cb(dmErr);
      if (!dm) return cb(null, false, null);
      const isParticipant = dm.participants?.includes(username);
      const isActive = (dm.status || "pending") === "active";
      cb(null, isParticipant && isActive, dm);
    });
  });
}

module.exports = { canViewChannel, canSendToChannel };
