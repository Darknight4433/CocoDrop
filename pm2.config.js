module.exports = {
  apps: [{
    name: "cocodrop",
    script: "index.js",
    cwd: "./server",
    watch: false,
    env: {
      NODE_ENV: "production",
      PORT: 4000,
    },
    // Auto-restart on crash
    restart_delay: 3000,
    max_restarts: 10,
  }],
};
