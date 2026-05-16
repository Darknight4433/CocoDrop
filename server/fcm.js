const https = require("https");

// FCM Server Key — set this in your Render environment variables as FCM_SERVER_KEY
// Get it from: Firebase Console → Project Settings → Cloud Messaging → Server key
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;

/**
 * Send a push notification to a single FCM token.
 * @param {string} token - The recipient's FCM device token
 * @param {string} title - Notification title
 * @param {string} body  - Notification body text
 */
function sendPush(token, title, body) {
  if (!FCM_SERVER_KEY || !token) return;

  const payload = JSON.stringify({
    to: token,
    notification: { title, body, sound: "default", badge: "1" },
    data: { click_action: "FLUTTER_NOTIFICATION_CLICK" },
    priority: "high",
  });

  const options = {
    hostname: "fcm.googleapis.com",
    path: "/fcm/send",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${FCM_SERVER_KEY}`,
    },
  };

  const req = https.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      const parsed = JSON.parse(data);
      if (parsed.failure) console.warn("FCM push failed:", data);
    });
  });

  req.on("error", (err) => console.warn("FCM request error:", err.message));
  req.write(payload);
  req.end();
}

module.exports = { sendPush };
