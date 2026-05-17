const Datastore = require("@seald-io/nedb");
const path = require("path");
const fs = require("fs");

// On Render, set DATA_DIR env var to a persistent disk mount path like /data
// On local/Termux, defaults to ./data next to this file
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const users    = new Datastore({ filename: path.join(dataDir, "users.db"),    autoload: true });
const messages = new Datastore({ filename: path.join(dataDir, "messages.db"), autoload: true });
const rooms    = new Datastore({ filename: path.join(dataDir, "rooms.db"),    autoload: true });
const dms      = new Datastore({ filename: path.join(dataDir, "dms.db"),      autoload: true });

// Index for fast lookups
messages.ensureIndex({ fieldName: "channelId" });
dms.ensureIndex({ fieldName: "participants" });

[users, messages, rooms, dms].forEach(db => db.setAutocompactionInterval(600000));

module.exports = { users, messages, rooms, dms };
