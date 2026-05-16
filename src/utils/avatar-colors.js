const AVATAR_COLORS = [
  ["#7c6af7", "#a78bfa"],
  ["#ec4899", "#f472b6"],
  ["#3b82f6", "#60a5fa"],
  ["#10b981", "#34d399"],
  ["#f59e0b", "#fbbf24"],
  ["#ef4444", "#f87171"],
  ["#8b5cf6", "#c084fc"],
  ["#06b6d4", "#22d3ee"],
];

export function avatarColors(username = "") {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
