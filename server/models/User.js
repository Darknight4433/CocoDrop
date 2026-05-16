const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  avatar: { type: String, default: "" }, // URL or initials fallback
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
