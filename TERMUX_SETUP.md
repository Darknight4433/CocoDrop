# 🥥 CocoDrop — Termux Setup Guide

Everything runs from ONE port (4000). No Vite dev server needed on Termux.

---

## 📋 Architecture on Termux

```
Phone (Termux)
  └── node server/index.js         ← serves API + built React frontend
        port: 4000
        accessible at: http://YOUR_PHONE_IP:4000
        (optionally via Cloudflare Tunnel for public access)
```

---

## 1️⃣ First: Build the frontend (do this on your PC once)

```bash
# In the project root (coconut/)
npm run build
```

This creates a `dist/` folder. The Express server will serve it automatically.

Then copy the **entire project** to your phone (USB / Google Drive / git clone).

---

## 2️⃣ Install Termux packages

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs git nano -y
pkg install wget curl -y   # optional but useful

node -v   # should be v18+
npm -v
```

---

## 3️⃣ Go to server folder

```bash
# If copied via USB to shared storage:
cd storage/shared/CocoDrop/server

# Or if cloned from git:
cd CocoDrop/server
```

---

## 4️⃣ Install server dependencies

```bash
npm install
```

> No MongoDB needed — CocoDrop uses NeDB (file-based, zero setup).

---

## 5️⃣ Create .env

```bash
cp .env.example .env
nano .env
```

Edit to set:
```
PORT=4000
JWT_SECRET=pick_any_long_secret_string_here
```

Save: `CTRL+X` → `Y` → `ENTER`

---

## 6️⃣ Start the server

```bash
node index.js
```

You should see:
```
🥥 CocoDrop server → http://localhost:4000
📱 From phone/Termux → http://YOUR_IP:4000
```

---

## 7️⃣ Access from same WiFi

Find your phone's IP:
```bash
ifconfig | grep inet
# Look for something like: inet 192.168.1.5
```

Then everyone on the same WiFi can open:
```
http://192.168.1.5:4000
```

---

## 8️⃣ Make it public with Cloudflare Tunnel 🌐

```bash
pkg install cloudflared
cloudflared tunnel --url http://localhost:4000
```

You'll get a free public URL like:
```
https://random-name.trycloudflare.com
```

Share that link with your friend — works from anywhere! No port forwarding needed.

---

## 9️⃣ Keep it alive with PM2

```bash
npm install -g pm2

# Start
pm2 start index.js --name cocodrop

# Check status
pm2 list

# Save so it restarts on crash
pm2 save

# View logs
pm2 logs cocodrop
```

---

## ⚠️ CRITICAL: Disable Battery Optimization

Android will kill Termux in the background otherwise!

```
Settings → Apps → Termux → Battery → Unrestricted
```

Also: keep Termux's wake lock on (the notification with 🔒).

---

## 🔄 Updating the app

On your PC:
```bash
# Make code changes...
npm run build       # rebuild frontend
# Copy dist/ to phone (or git push/pull)
```

On Termux:
```bash
pm2 restart cocodrop
```

---

## 💡 Quick commands cheat sheet

| Task | Command |
|---|---|
| Start server | `node index.js` |
| Start with PM2 | `pm2 start index.js --name cocodrop` |
| Stop PM2 | `pm2 stop cocodrop` |
| View logs | `pm2 logs cocodrop` |
| Public tunnel | `cloudflared tunnel --url http://localhost:4000` |
| Find your IP | `ifconfig \| grep inet` |

---

## 🧠 Final Architecture

```
Your friends
    ↓
Cloudflare Tunnel (free, no port forwarding)
    ↓
Termux Node.js server (port 4000)
    ├── /api/*         → Express API
    ├── /socket.io     → Real-time messaging
    └── /*             → Built React frontend (from dist/)
         ↓
NeDB (file-based, stored in server/data/)
```

No MongoDB Atlas needed. Everything lives on the phone. 🥥
