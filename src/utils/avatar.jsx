import { avatarColors } from "./avatar-colors";

export function AvatarCircle({ username, size = "md", label }) {
  const [from, to] = avatarColors(username);
  const sizes = { sm: 28, md: 34, lg: 44 };
  const fonts = { sm: 11, md: 13, lg: 17 };
  const px = sizes[size];
  const fs = fonts[size];

  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        flexShrink: 0,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fs,
        fontWeight: 700,
        color: "#fff",
        letterSpacing: 0,
      }}
    >
      {(label || username[0])?.toUpperCase()}
    </div>
  );
}
