import { useState } from "react";
import { AvatarCircle } from "../utils/avatar";

const SERVER_URL = "http://localhost:4000";

export default function Message({ msg, isMe, serverUrl, onImageClick, onEdit, onDelete }) {
  const [showMobileActions, setShowMobileActions] = useState(false);
  const imageUrl = msg.type === "image" ? `${serverUrl || SERVER_URL}${msg.content}` : null;
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleContextMenu = (e) => {
    if (!isMe) return;
    e.preventDefault();
    setShowMobileActions(!showMobileActions);
  };

  return (
    <div className={`msg-row ${isMe ? "msg-me" : "msg-them"}`}>
      {!isMe && <AvatarCircle username={msg.senderName} size="sm" />}
      <div 
        className={`msg-bubble ${isMe ? "msg-bubble-me" : "msg-bubble-them"} ${showMobileActions ? "show-mobile-actions" : ""}`}
        onContextMenu={handleContextMenu}
      >
        {!isMe && <p className="msg-sender">{msg.senderName}</p>}
        
        {isMe && (
          <div className="msg-actions">
            <button className="msg-action-btn" title="Edit" onClick={() => { onEdit(msg); setShowMobileActions(false); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button className="msg-action-btn danger" title="Delete" onClick={() => { onDelete(msg); setShowMobileActions(false); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
            </button>
          </div>
        )}
//...

        {msg.type === "image" ? (
          <img
            src={imageUrl}
            alt="sent"
            className="msg-img"
            onClick={() => onImageClick(imageUrl)}
          />
        ) : (
          <p className="msg-text">{msg.content}</p>
        )}
        
        <div className="msg-meta">
          {msg.isEdited && <span className="msg-edited">(edited)</span>}
          <p className="msg-time">{time}</p>
        </div>
      </div>
      {isMe && <AvatarCircle username={msg.senderName} size="sm" />}
    </div>
  );
}
