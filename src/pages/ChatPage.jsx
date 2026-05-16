import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import API from "../api";
import Message from "../components/Message";
import { AvatarCircle } from "../utils/avatar";

const SERVER_URL = "http://localhost:4000";
const THEMES = [
  { id: "aurora", name: "Aurora" },
  { id: "graphite", name: "Graphite" },
  { id: "daylight", name: "Daylight" },
  { id: "ember", name: "Ember" },
];
const FONT_STYLES = [
  { id: "inter", name: "Clean" },
  { id: "rounded", name: "Rounded" },
  { id: "mono", name: "Mono" },
];
const EMOJI_CHOICES = ["🥥", "⚡", "🌙", "✨", "🔥", "💎", "🛸", "🫧"];

export default function ChatPage({ user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [dms, setDms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isMember, setIsMember] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("cd_theme") || "aurora");
  const [fontStyle, setFontStyle] = useState(() => localStorage.getItem("cd_font") || "inter");
  const [favoriteLetter, setFavoriteLetter] = useState(() => localStorage.getItem("cd_letter") || user.username[0]?.toUpperCase() || "C");
  const [favoriteEmoji, setFavoriteEmoji] = useState(() => localStorage.getItem("cd_emoji") || "🥥");

  const [showNewRoom, setShowNewRoom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteStatus, setInviteStatus] = useState("");
  const [showNewDM, setShowNewDM] = useState(false);
  const [dmSearch, setDmSearch] = useState("");
  const [dmResults, setDmResults] = useState([]);

  const socketRef = useRef(null);
  const activeChannelRef = useRef(null);
  const prevChannelRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);

  const onlineCount = onlineUsers.length;
  const activeRoom = rooms.find((room) => room._id === activeChannel?.id);
  const isCreator = activeRoom?.createdBy === user.username;
  const currentTheme = useMemo(() => THEMES.find((item) => item.id === theme) || THEMES[0], [theme]);
  const currentFont = useMemo(() => FONT_STYLES.find((item) => item.id === fontStyle) || FONT_STYLES[0], [fontStyle]);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("cd_theme", theme);
  }, [theme]);

  useEffect(() => {
    document.body.dataset.font = fontStyle;
    localStorage.setItem("cd_font", fontStyle);
  }, [fontStyle]);

  useEffect(() => {
    localStorage.setItem("cd_letter", favoriteLetter || "C");
  }, [favoriteLetter]);

  useEffect(() => {
    localStorage.setItem("cd_emoji", favoriteEmoji);
  }, [favoriteEmoji]);

  useEffect(() => {
    const token = localStorage.getItem("sc_token");
    const socket = io(SERVER_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("online_users", setOnlineUsers);
    socket.on("receive_message", (msg) => {
      if (msg.channelId === activeChannelRef.current?.id) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    });
    socket.on("user_typing", ({ username, channelId }) => {
      if (channelId === activeChannelRef.current?.id && username !== user.username) {
        setTypingUser(username);
      }
    });
    socket.on("user_stop_typing", () => setTypingUser(""));

    return () => socket.disconnect();
  }, [user.username]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  const refreshRooms = () => API.get("/rooms").then((res) => setRooms(res.data));
  const refreshDms = () => API.get("/dms").then((res) => setDms(res.data));

  useEffect(() => {
    refreshRooms();
    refreshDms();
  }, []);

  const openChannel = async (channel) => {
    if (prevChannelRef.current) {
      socketRef.current?.emit("leave_channel", prevChannelRef.current.id);
    }

    setActiveChannel(channel);
    activeChannelRef.current = channel;
    prevChannelRef.current = channel;
    setMessages([]);
    setTypingUser("");

    socketRef.current?.emit("join_channel", channel.id);

    try {
      const res = await API.get(`/messages/${channel.id}`);
      setMessages(res.data);
      setIsMember(true);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      if (err.response?.status === 403) setIsMember(false);
    }
  };

  const joinRoom = async (room) => {
    await API.post(`/rooms/${room._id}/join`);
    await refreshRooms();
    openChannel({
      id: room._id,
      name: room.name,
      type: "room",
      isPrivate: room.isPrivate,
      createdBy: room.createdBy,
    });
  };

  const openRoom = (room) => {
    const channel = {
      id: room._id,
      name: room.name,
      type: "room",
      isPrivate: room.isPrivate,
      createdBy: room.createdBy,
    };
    return room.isPrivate ? openChannel(channel) : joinRoom(room);
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    if (!activeChannel) return;
    socketRef.current?.emit("typing", { channelId: activeChannel.id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit("stop_typing", { channelId: activeChannel.id });
    }, 1500);
  };

  const sendMessage = () => {
    if (!text.trim() || !activeChannel || !isMember) return;
    socketRef.current?.emit("send_message", { channelId: activeChannel.id, content: text.trim() });
    setText("");
    socketRef.current?.emit("stop_typing", { channelId: activeChannel.id });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChannel || !isMember) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await API.post(`/messages/upload/${activeChannel.id}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      socketRef.current?.emit("broadcast_image", res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const res = await API.post("/rooms", { name: newRoomName.trim(), isPrivate: isPrivateRoom });
    await refreshRooms();
    setNewRoomName("");
    setIsPrivateRoom(false);
    setShowNewRoom(false);
    openChannel({
      id: res.data._id,
      name: res.data.name,
      type: "room",
      isPrivate: res.data.isPrivate,
      createdBy: res.data.createdBy,
    });
  };

  const searchInviteUsers = async (q) => {
    setInviteSearch(q);
    if (!q) {
      setInviteResults([]);
      return;
    }
    const res = await API.get(`/users/search?q=${q}`);
    setInviteResults(res.data);
  };

  const inviteUser = async (username) => {
    setInviteStatus("");
    try {
      await API.post(`/rooms/${activeChannel.id}/invite`, { username });
      setInviteStatus(`${username} invited`);
      setInviteSearch("");
      setInviteResults([]);
    } catch (err) {
      setInviteStatus(err.response?.data?.error || "Invite failed");
    }
  };

  const searchDMUsers = async (q) => {
    setDmSearch(q);
    if (!q) {
      setDmResults([]);
      return;
    }
    const res = await API.get(`/users/search?q=${q}`);
    setDmResults(res.data);
  };

  const startDM = async (targetUsername) => {
    const res = await API.post("/dms", { targetUsername });
    const dm = res.data;
    if (!dms.find((item) => item._id === dm._id)) setDms((prev) => [dm, ...prev]);
    const dmName = dm.participants.find((participant) => participant !== user.username);
    setShowNewDM(false);
    setDmSearch("");
    setDmResults([]);
    openChannel({ id: dm._id, name: dmName, type: "dm" });
  };

  const isOnline = (username) => onlineUsers.some((item) => item.username === username);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">{favoriteEmoji}</div>
            <div>
              <span className="brand-name">CocoDrop</span>
              <span className="brand-caption">{onlineCount} online now</span>
            </div>
          </div>

          <div className="me-pill">
            <AvatarCircle username={user.username} size="sm" label={favoriteLetter} />
            <div className="me-copy">
              <span className="me-name">{favoriteEmoji} {user.username}</span>
              <span className="me-status">{currentTheme.name} theme · {currentFont.name} font</span>
            </div>
            <button className="settings-btn" onClick={() => setShowSettings(true)} title="Open settings">Settings</button>
            <button className="logout-icon" onClick={onLogout} title="Sign out">Exit</button>
          </div>
        </div>

        <div className="sidebar-scroll">
          <div className="section-head">
            <span className="section-lbl">Rooms</span>
            <button className="add-btn" onClick={() => setShowNewRoom(true)}>+</button>
          </div>

          {rooms.length === 0 && (
            <p className="sidebar-empty">Create a public room or an invite-only private room.</p>
          )}
          {rooms.map((room) => (
            <button
              key={room._id}
              className={`ch-item ${activeChannel?.id === room._id ? "ch-active" : ""}`}
              onClick={() => openRoom(room)}
            >
              <span className="ch-icon">{room.isPrivate ? "LOCK" : "#"}</span>
              <span className="ch-name">{room.name}</span>
              <span className={`ch-badge ${room.isPrivate ? "private" : "public"}`}>
                {room.isPrivate ? "Invite" : "Open"}
              </span>
            </button>
          ))}

          <div className="section-head spaced">
            <span className="section-lbl">Direct Messages</span>
            <button className="add-btn" onClick={() => setShowNewDM(true)}>+</button>
          </div>

          {dms.length === 0 && <p className="sidebar-empty">Start a personal DM with any user.</p>}
          {dms.map((dm) => {
            const other = dm.participants.find((participant) => participant !== user.username);
            return (
              <button
                key={dm._id}
                className={`ch-item ${activeChannel?.id === dm._id ? "ch-active" : ""}`}
                onClick={() => openChannel({ id: dm._id, name: other, type: "dm" })}
              >
                <AvatarCircle username={other} size="sm" />
                <span className="ch-name">{other}</span>
                {isOnline(other) && <span className="dm-online-dot" />}
              </button>
            );
          })}
        </div>
      </aside>

      <main className="chat-main">
        {!activeChannel ? (
          <div className="welcome-screen">
            <div className="welcome-card">
              <p className="eyebrow">CocoDrop command center</p>
              <h2>Pick a room, join a public space, or start a private DM.</h2>
              <p>
                Public rooms are open to everyone. Private rooms stay invite-only and can be managed by
                the room creator.
              </p>
              <div className="welcome-actions">
                <button className="welcome-pill" onClick={() => setShowNewRoom(true)}>Create Room</button>
                <button className="welcome-pill outline" onClick={() => setShowNewDM(true)}>Start DM</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="chat-header-left">
                <span className="chat-header-icon">
                  {activeChannel.type === "dm" ? (
                    <AvatarCircle username={activeChannel.name} size="sm" />
                  ) : (
                    activeChannel.isPrivate ? "LOCK" : "#"
                  )}
                </span>
                <div>
                  <p className="chat-header-name">
                    {activeChannel.type === "dm" ? activeChannel.name : `#${activeChannel.name}`}
                  </p>
                  <p className="chat-header-sub">
                    {activeChannel.type === "dm"
                      ? (isOnline(activeChannel.name) ? "Online direct message" : "Offline direct message")
                      : (activeChannel.isPrivate ? "Private invite-only room" : "Public room anyone can join")}
                  </p>
                </div>
              </div>
              <div className="chat-header-actions">
                {activeChannel.type === "room" && (
                  <span className={`privacy-pill ${activeChannel.isPrivate ? "private" : "public"}`}>
                    {activeChannel.isPrivate ? "Invite only" : "Open room"}
                  </span>
                )}
                {activeChannel.type === "room" && isCreator && activeChannel.isPrivate && (
                  <button className="header-action-btn" onClick={() => { setShowInvite(true); setInviteStatus(""); }}>
                    Invite people
                  </button>
                )}
              </div>
            </div>

            <div className="messages-area">
              {!isMember ? (
                <div className="locked-room">
                  <p className="locked-kicker">Private room</p>
                  <p className="locked-title">Invite required</p>
                  <p className="locked-sub">Only invited members can read or send messages here.</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="empty-chat">
                  <p>No messages yet. Start the conversation.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <Message key={msg._id} msg={msg} isMe={msg.senderName === user.username} serverUrl={SERVER_URL} />
                ))
              )}
              {typingUser && (
                <div className="typing-row">
                  <AvatarCircle username={typingUser} size="sm" />
                  <div className="typing-bubble">
                    <span className="typing-name">{typingUser} is typing</span>
                    <span className="typing-dots"><span /><span /><span /></span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {isMember ? (
              <div className="input-bar">
                <input type="file" accept="image/*" ref={fileInputRef} className="hidden-input" onChange={handleImageUpload} />
                <button className="attach-btn" onClick={() => fileInputRef.current.click()} disabled={uploading}>
                  {uploading ? "..." : "File"}
                </button>
                <textarea
                  className="msg-input"
                  placeholder={`Message ${activeChannel.type === "room" ? "#" + activeChannel.name : activeChannel.name}`}
                  value={text}
                  onChange={handleTyping}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button className="send-btn" onClick={sendMessage} disabled={!text.trim()}>
                  Send
                </button>
              </div>
            ) : (
              <div className="input-locked">You cannot send messages here until you are invited.</div>
            )}
          </>
        )}
      </main>

      {showNewRoom && (
        <div className="modal-overlay" onClick={() => setShowNewRoom(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Create a Room</span>
              <button className="modal-close" onClick={() => setShowNewRoom(false)}>Close</button>
            </div>
            <form onSubmit={createRoom}>
              <input
                className="modal-input"
                placeholder="Room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                autoFocus
              />
              <div className="room-type-toggle">
                <button
                  type="button"
                  className={`room-type-btn ${!isPrivateRoom ? "active" : ""}`}
                  onClick={() => setIsPrivateRoom(false)}
                >
                  <span>Public Room</span>
                  <small>Anyone can join</small>
                </button>
                <button
                  type="button"
                  className={`room-type-btn ${isPrivateRoom ? "active" : ""}`}
                  onClick={() => setIsPrivateRoom(true)}
                >
                  <span>Private Room</span>
                  <small>Invited people only</small>
                </button>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowNewRoom(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!newRoomName.trim()}>Create Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-box settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Your Settings</span>
              <button className="modal-close" onClick={() => setShowSettings(false)}>Close</button>
            </div>

            <div className="settings-preview">
              <AvatarCircle username={user.username} size="lg" label={favoriteLetter} />
              <div>
                <strong>{favoriteEmoji} {user.username}</strong>
                <span>{currentTheme.name} theme · {currentFont.name} font</span>
              </div>
            </div>

            <section className="settings-section">
              <div className="settings-section-head">
                <span>Theme</span>
                <small>Choose your CocoDrop look</small>
              </div>
              <div className="settings-grid theme-settings-grid">
                {THEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`theme-choice ${theme === item.id ? "active" : ""}`}
                    onClick={() => setTheme(item.id)}
                  >
                    <span className={`theme-swatch theme-${item.id}`} />
                    <strong>{item.name}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section-head">
                <span>Font Style</span>
                <small>Pick the reading feel you like</small>
              </div>
              <div className="segmented-row">
                {FONT_STYLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`segment-btn font-${item.id} ${fontStyle === item.id ? "active" : ""}`}
                    onClick={() => setFontStyle(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section-head">
                <span>Favorite Letter</span>
                <small>This appears in your personal avatar on this device</small>
              </div>
              <input
                className="modal-input"
                value={favoriteLetter}
                maxLength={2}
                onChange={(e) => setFavoriteLetter(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="C"
              />
            </section>

            <section className="settings-section">
              <div className="settings-section-head">
                <span>Favorite Emoji</span>
                <small>Your tiny personal signature</small>
              </div>
              <div className="emoji-grid">
                {EMOJI_CHOICES.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`emoji-choice ${favoriteEmoji === emoji ? "active" : ""}`}
                    onClick={() => setFavoriteEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Invite to #{activeChannel?.name}</span>
              <button className="modal-close" onClick={() => setShowInvite(false)}>Close</button>
            </div>
            <input
              className="modal-input"
              placeholder="Search username"
              value={inviteSearch}
              onChange={(e) => searchInviteUsers(e.target.value)}
              autoFocus
            />
            {inviteStatus && <p className="invite-status">{inviteStatus}</p>}
            <div className="search-list">
              {inviteResults.map((item) => (
                <button key={item.username} className="search-list-item" onClick={() => inviteUser(item.username)}>
                  <AvatarCircle username={item.username} size="sm" />
                  <span>{item.username}</span>
                  {isOnline(item.username) && <span className="dm-online-dot" />}
                  <span className="invite-add-btn">Invite</span>
                </button>
              ))}
              {inviteResults.length === 0 && inviteSearch && <p className="sidebar-empty">No users found.</p>}
            </div>
          </div>
        </div>
      )}

      {showNewDM && (
        <div className="modal-overlay" onClick={() => setShowNewDM(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Direct Message</span>
              <button className="modal-close" onClick={() => setShowNewDM(false)}>Close</button>
            </div>
            <input
              className="modal-input"
              placeholder="Search username"
              value={dmSearch}
              onChange={(e) => searchDMUsers(e.target.value)}
              autoFocus
            />
            <div className="search-list">
              {dmResults.map((item) => (
                <button key={item.username} className="search-list-item" onClick={() => startDM(item.username)}>
                  <AvatarCircle username={item.username} size="sm" />
                  <span>{item.username}</span>
                  {isOnline(item.username) && <span className="dm-online-dot" />}
                </button>
              ))}
              {dmResults.length === 0 && dmSearch && <p className="sidebar-empty">No users found.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
