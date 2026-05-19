# <img src="public/favicon.png" width="36" valign="middle"> CocoDrop

CocoDrop is a modern, real-time messaging and chat platform designed for both web and mobile devices. It offers instant messaging, private direct messages (DMs), group channels, real-time presence indicators, and push notifications.

---

## 📱 Download the Android App (APK)

You can download the latest version of the CocoDrop Android app directly from our GitHub Releases page:

👉 **[Download CocoDrop APK](https://github.com/Darknight4433/CocoDrop/releases)** 👈

### How to Install on Android:
1. Tap the link above, navigate to the latest release, and download the `.apk` file (e.g., `CocoDrop.ver.1.0.9.apk`).
2. Open the downloaded file on your Android device.
3. If prompted, enable **"Install from Unknown Sources"** in your browser or file manager settings.
4. Follow the on-screen instructions to complete the installation and launch CocoDrop!

---

## ✨ Features

- **Real-Time Chat:** Powered by Socket.io for instant message delivery.
- **Channels & Direct Messages:** Create group channels or chat privately with other users.
- **Online Presence:** See who is online and active in real-time.
- **Push Notifications:** Integrated with Firebase Cloud Messaging (FCM) to keep you updated.
- **Responsive Design:** Mobile-first layout optimized for a seamless experience on both phones and desktops.

---

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Capacitor (for Android mobile app wrapper)
- **Backend:** Node.js, Express, Socket.io, Firebase Admin SDK
- **Database:** Local JSON-based persistent storage (lightweight & self-hosted)

---

## 🚀 Running the Project Locally

### 1. Run the Backend Server
```bash
cd server
npm install
npm run dev
```

### 2. Run the Frontend App
```bash
# In the root directory
npm install
npm run dev
```

---

## 🏗️ Building for Mobile (Capacitor)

To compile and update the Android project:
```bash
# 1. Build frontend assets
npm run build

# 2. Sync with Android project
npx cap sync

# 3. Open in Android Studio
npx cap open android
```
