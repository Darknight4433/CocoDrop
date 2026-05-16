import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Replace these with your actual Firebase project config
// Get it from: Firebase Console → Project Settings → General → Your apps → Web app
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// VAPID key — get from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = "YOUR_VAPID_KEY";

/**
 * Request notification permission and get FCM token.
 * Returns the token string, or null if permission denied.
 */
export async function requestFCMToken() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch (err) {
    console.warn("FCM token error:", err);
    return null;
  }
}

/**
 * Listen for foreground messages (app is open).
 * onMessage callback receives { notification: { title, body }, data }
 */
export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}

export { messaging };
