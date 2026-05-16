import { AvatarCircle } from "../utils/avatar";

const SERVER_URL = "http://localhost:4000";

export default function Message({ msg, isMe, serverUrl }) {
  const imageUrl = msg.type === "image" ? `${serverUrl || SERVER_URL}${msg.content}` : null;
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`msg-row ${isMe ? "msg-me" : "msg-them"}`}>
      {!isMe && <AvatarCircle username={msg.senderName} size="sm" />}
      <div className={`msg-bubble ${isMe ? "msg-bubble-me" : "msg-bubble-them"}`}>
        {!isMe && <p className="msg-sender">{msg.senderName}</p>}
        {msg.type === "image" ? (
          <img
            src={imageUrl}
            alt="sent"
            className="msg-img"
            onClick={() => window.open(imageUrl, "_blank")}
          />
        ) : (
          <p className="msg-text">{msg.content}</p>
        )}
        <p className="msg-time">{time}</p>
      </div>
      {isMe && <AvatarCircle username={msg.senderName} size="sm" />}
    </div>
  );
}
