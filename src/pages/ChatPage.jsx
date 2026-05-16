import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import API from "../api";
import Message from "../components/Message";
import { AvatarCircle } from "../utils/avatar";

import { SERVER_URL } from "../api";
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
const getSavedEmoji = () => {
  const saved = localStorage.getItem("cd_emoji");
  return EMOJI_CHOICES.includes(saved) ? saved : "🥥";
};
const getSavedLetter = (username) => {
  const saved = localStorage.getItem("cd_letter") || username[0] || "C";
  return saved.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2) || "C";
};

export default function ChatPage({ user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [dms, setDms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [uploading, setUploading] = useState(false);
  // isMember: null = loading, true = can access, false = no access
  const [isMember, setIsMember] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [channelError, setChannelError] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("cd_theme") || "aurora");
  const [fontStyle, setFontStyle] = useState(() => localStorage.getItem("cd_font") || "inter");
  const [favoriteLetter, setFavoriteLetter] = useState(() => getSavedLetter(user.username));
  const [favoriteEmoji, setFavoriteEmoji] = useState(getSavedEmoji);

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
  // DM Nicknames: { [dmId]: string } stored in localStorage
  const [dmNicknames, setDmNicknames] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cd_nicknames") || "{}"); } catch { return {}; }
  });
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState("");
  // Rename room
  const [showRename, setShowRename] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [editingMsg, setEditingMsg] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [viewingImage, setViewingImage] = useState(null);
  // Members panel
  const [showMembers, setShowMembers] = useState(false);
  const [roomMembers, setRoomMembers] = useState([]);
  // User search modal
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchQ, setUserSearchQ] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  // My status
  const [myStatus, setMyStatus] = useState(() => localStorage.getItem("cd_status") || "online");
  // Right-click context menu
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, room }
  // Custom confirm dialog (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState(null); // { title, body, onConfirm }
  // Muted rooms: set of room IDs stored in localStorage
  const [mutedRooms, setMutedRooms] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("cd_muted") || "[]")); } catch { return new Set(); }
  });

  const socketRef = useRef(null);
  const activeChannelRef = useRef(null);
  const prevChannelRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);

  // Helper: scroll the messages container to bottom without scrollIntoView
  const scrollToBottom = (instant = false) => {
    setTimeout(() => {
      if (messagesAreaRef.current) {
        messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight;
      }
    }, instant ? 0 : 60);
  };

  const onlineCount = onlineUsers.length;
  const activeRoom = rooms.find((r) => r._id === activeChannel?.id);
  const isCreator = activeChannel?.createdBy?.trim() === user.username?.trim();
  const getOnlineUser = (username) => onlineUsers.find((u) => u.username === username);
  const STATUS_OPTIONS = [
    { id: "online", label: "Online", color: "#22c55e" },
    { id: "busy",   label: "Busy",   color: "#f59e0b" },
    { id: "away",   label: "Away",   color: "#94a3b8" },
    { id: "dnd",    label: "Do Not Disturb", color: "#ef4444" },
  ];
  const currentTheme = useMemo(() => THEMES.find((t) => t.id === theme) || THEMES[0], [theme]);
  const currentFont = useMemo(() => FONT_STYLES.find((f) => f.id === fontStyle) || FONT_STYLES[0], [fontStyle]);

  // Derived DM state — computed from activeChannel only (no stale isMember dependency)
  const isPendingDM = activeChannel?.type === "dm" && activeChannel.status === "pending";
  const isPendingDMRequester = isPendingDM && activeChannel.requestedBy === user.username;
  // Can send: must be a member/participant AND (if DM) must be active
  const canSendInActiveChannel = isMember === true && !isPendingDM;

  useEffect(() => { document.body.dataset.theme = theme; localStorage.setItem("cd_theme", theme); }, [theme]);
  useEffect(() => { document.body.dataset.font = fontStyle; localStorage.setItem("cd_font", fontStyle); }, [fontStyle]);
  useEffect(() => { localStorage.setItem("cd_letter", favoriteLetter || "C"); }, [favoriteLetter]);
  useEffect(() => { localStorage.setItem("cd_emoji", favoriteEmoji); }, [favoriteEmoji]);
  useEffect(() => {
    localStorage.setItem("cd_status", myStatus);
    socketRef.current?.emit("set_status", myStatus);
  }, [myStatus]);

  useEffect(() => {
    const token = localStorage.getItem("sc_token");
    const socket = io(SERVER_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("online_users", setOnlineUsers);
    socket.on("receive_message", (msg) => {
      if (msg.channelId === activeChannelRef.current?.id) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      }
    });
    socket.on("user_typing", ({ username, channelId }) => {
      if (channelId === activeChannelRef.current?.id && username !== user.username) {
        setTypingUser(username);
      }
    });
    socket.on("user_stop_typing", () => setTypingUser(""));
    socket.on("channel_error", (message) => setChannelError(message || "You cannot send messages here."));
    socket.on("message_deleted", ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    });
    socket.on("message_edited", ({ message }) => {
      setMessages((prev) => prev.map((m) => m._id === message._id ? message : m));
    });

    return () => socket.disconnect();
  }, [user.username]);

  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);

  const refreshRooms = () => API.get("/rooms").then((res) => setRooms(res.data));
  const refreshDms = () => API.get("/dms").then((res) => setDms(res.data));

  useEffect(() => { refreshRooms(); refreshDms(); }, []);

  const openChannel = async (channel) => {
    if (prevChannelRef.current) {
      socketRef.current?.emit("leave_channel", prevChannelRef.current.id);
    }

    setActiveChannel(channel);
    activeChannelRef.current = channel;
    prevChannelRef.current = channel;
    setMessages([]);
    setTypingUser("");
    setChannelError("");
    setUploadError("");
    setIsMember(null); // reset — loading state

    socketRef.current?.emit("join_channel", channel.id);

    try {
      const res = await API.get(`/messages/${channel.id}`);
      // Server returns { pending: true, messages: [] } for pending DMs, or array for normal channels
      const data = res.data;
      const msgs = Array.isArray(data) ? data : (data.messages || []);
      setMessages(msgs);
      setIsMember(true);
      scrollToBottom();
    } catch (err) {
      if (err.response?.status === 403) {
        setIsMember(false);
      } else {
        setIsMember(true); // network error — don't lock the user out
      }
    }
  };

  // Join a public room (adds user to members), then open it
  const joinPublicRoom = async (room) => {
    try {
      await API.post(`/rooms/${room._id}/join`);
      await refreshRooms();
    } catch {
      // already a member or error — still open
    }
    openChannel({ id: room._id, name: room.name, type: "room", isPrivate: room.isPrivate, createdBy: room.createdBy });
  };

  const openRoom = (room) => {
    // Private rooms: open directly (server gates access by membership)
    // Public rooms: ensure they're joined so they can send messages
    if (room.isPrivate) {
      openChannel({ id: room._id, name: room.name, type: "room", isPrivate: true, createdBy: room.createdBy });
    } else {
      joinPublicRoom(room);
    }
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    if (!activeChannel || !canSendInActiveChannel) return;
    socketRef.current?.emit("typing", { channelId: activeChannel.id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit("stop_typing", { channelId: activeChannel.id });
    }, 1500);
  };

  const sendMessage = () => {
    if (!text.trim() || !activeChannel || !canSendInActiveChannel) return;
    setChannelError("");
    socketRef.current?.emit("send_message", { channelId: activeChannel.id, content: text.trim() });
    setText("");
    socketRef.current?.emit("stop_typing", { channelId: activeChannel.id });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChannel || !canSendInActiveChannel) return;
    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await API.post(`/messages/upload/${activeChannel.id}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      socketRef.current?.emit("broadcast_image", res.data);
    } catch {
      setUploadError("Image upload failed. Try a smaller file.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const startEdit = (msg) => {
    setEditingMsg(msg);
    setEditDraft(msg.content);
  };

  const saveEdit = async () => {
    if (!editDraft.trim() || !editingMsg) return;
    try {
      const res = await API.patch(`/messages/${editingMsg._id}`, { content: editDraft.trim() });
      socketRef.current?.emit("edit_message", { message: res.data, channelId: activeChannel.id });
      setEditingMsg(null);
      setEditDraft("");
    } catch {
      setChannelError("Failed to edit message");
    }
  };

  const deleteMessage = (msg) => {
    askConfirm(
      "Delete Message?",
      "This will permanently remove the message for everyone.",
      async () => {
        try {
          await API.delete(`/messages/${msg._id}`);
          socketRef.current?.emit("delete_message", { messageId: msg._id, channelId: activeChannel.id });
        } catch {
          setChannelError("Delete failed");
        }
      }
    );
  };

  const createRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const res = await API.post("/rooms", { name: newRoomName.trim(), isPrivate: isPrivateRoom });
    await refreshRooms();
    setNewRoomName(""); setIsPrivateRoom(false); setShowNewRoom(false);
    openChannel({ id: res.data._id, name: res.data.name, type: "room", isPrivate: res.data.isPrivate, createdBy: res.data.createdBy });
  };


  const saveNickname = () => {
    if (!activeChannel || activeChannel.type !== "dm") return;
    const updated = { ...dmNicknames, [activeChannel.id]: nickDraft.trim() || "" };
    setDmNicknames(updated);
    localStorage.setItem("cd_nicknames", JSON.stringify(updated));
    setEditingNick(false);
  };

  const getDmDisplayName = (dmId, fallback) => dmNicknames[dmId]?.trim() || fallback;

  // ── Custom confirm helper ──────────────────────────────────────
  const askConfirm = (title, body, onConfirm) => setConfirmModal({ title, body, onConfirm });

  // ── Delete room (host only) ────────────────────────────────────
  const deleteRoom = (room) => {
    const id   = room?._id   || activeChannel?.id;
    const name = room?.name  || activeChannel?.name;
    if (!id) return;
    askConfirm(
      `Delete "${name}"?`,
      "All messages will be permanently deleted. This cannot be undone.",
      async () => {
        try {
          await API.delete(`/rooms/${id}`);
          if (activeChannel?.id === id) {
            setActiveChannel(null);
            activeChannelRef.current = null;
          }
          await refreshRooms();
        } catch (err) {
          setChannelError(err.response?.data?.error || "Delete failed");
        }
      }
    );
  };

  // ── Leave room (non-host members) ─────────────────────────────
  const leaveRoom = (room) => {
    const id   = room?._id  || activeChannel?.id;
    const name = room?.name || activeChannel?.name;
    if (!id) return;
    askConfirm(
      `Leave "${name}"?`,
      "You will need an invite to rejoin if the room is private.",
      async () => {
        try {
          await API.post(`/rooms/${id}/leave`);
          if (activeChannel?.id === id) {
            setActiveChannel(null);
            activeChannelRef.current = null;
          }
          await refreshRooms();
        } catch (err) {
          setChannelError(err.response?.data?.error || "Leave failed");
        }
      }
    );
  };

  // ── Mute / unmute room (local, localStorage) ──────────────────
  const toggleMuteRoom = (roomId) => {
    setMutedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) { next.delete(roomId); } else { next.add(roomId); }
      localStorage.setItem("cd_muted", JSON.stringify([...next]));
      return next;
    });
  };

  // ── Right-click context menu ───────────────────────────────────
  const openCtxMenu = (e, room) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, room });
  };
  const closeCtxMenu = () => setCtxMenu(null);

  const renameRoom = async (e) => {
    e.preventDefault();
    if (!renameDraft.trim() || !activeChannel) return;
    try {
      const res = await API.patch(`/rooms/${activeChannel.id}`, { name: renameDraft.trim() });
      await refreshRooms();
      setActiveChannel((prev) => ({ ...prev, name: res.data.name }));
      setShowRename(false);
    } catch (err) {
      setChannelError(err.response?.data?.error || "Rename failed");
    }
  };

  const openMembers = async () => {
    if (!activeChannel || activeChannel.type !== "room") return;
    try {
      const res = await API.get(`/rooms/${activeChannel.id}/members`);
      setRoomMembers(res.data || []);
      setShowMembers(true);
    } catch { setRoomMembers([]); setShowMembers(true); }
  };

  const searchUsersGlobal = async (q) => {
    setUserSearchQ(q);
    if (!q.trim()) { setUserSearchResults([]); return; }
    const res = await API.get(`/users/search?q=${q}`);
    setUserSearchResults(res.data);
  };

  const changeMyStatus = (s) => setMyStatus(s);


  const searchInviteUsers = async (q) => {
    setInviteSearch(q);
    if (!q) { setInviteResults([]); return; }
    const res = await API.get(`/users/search?q=${q}`);
    setInviteResults(res.data);
  };

  const inviteUser = async (username) => {
    setInviteStatus("");
    try {
      await API.post(`/rooms/${activeChannel.id}/invite`, { username });
      setInviteStatus(`${username} invited ✓`);
      setInviteSearch(""); setInviteResults([]);
    } catch (err) {
      setInviteStatus(err.response?.data?.error || "Invite failed");
    }
  };

  const searchDMUsers = async (q) => {
    setDmSearch(q);
    if (!q) { setDmResults([]); return; }
    const res = await API.get(`/users/search?q=${q}`);
    setDmResults(res.data);
  };

  const startDM = async (targetUsername) => {
    const res = await API.post("/dms", { targetUsername });
    const dm = res.data;
    // Always ensure status is preserved exactly as server returns it
    setDms((prev) => prev.find((d) => d._id === dm._id) ? prev : [dm, ...prev]);
    const dmName = dm.participants.find((p) => p !== user.username);
    setShowNewDM(false); setDmSearch(""); setDmResults([]);
    openChannel({ id: dm._id, name: dmName, type: "dm", status: dm.status, requestedBy: dm.requestedBy });
  };

  const acceptDM = async () => {
    if (!activeChannel || activeChannel.type !== "dm") return;
    try {
      const res = await API.post(`/dms/${activeChannel.id}/accept`);
      await refreshDms();
      // Update the active channel status to active
      const updated = { ...activeChannel, status: res.data.status };
      openChannel(updated);
    } catch (err) {
      setChannelError(err.response?.data?.error || "Failed to accept DM");
    }
  };

  const isOnline = (username) => onlineUsers.some((u) => u.username === username);

  // What to show in the messages area
  const renderMessages = () => {
    if (isMember === null) return <div className="empty-chat"><p>Loading…</p></div>;
    if (isPendingDM) {
      return (
        <div className="locked-room">
          <p className="locked-kicker">DM request</p>
          <p className="locked-title">
            {isPendingDMRequester ? "Waiting for approval" : `${activeChannel.name} wants to chat`}
          </p>
          <p className="locked-sub">
            {isPendingDMRequester
              ? "Messages unlock after the other user accepts your request."
              : "Accept this request to unlock the private conversation."}
          </p>
          {!isPendingDMRequester && (
            <button className="welcome-pill" onClick={acceptDM}>Accept DM</button>
          )}
        </div>
      );
    }
    if (isMember === false) {
      return (
        <div className="locked-room">
          <p className="locked-kicker">Private room</p>
          <p className="locked-title">Invite required</p>
          <p className="locked-sub">Only invited members can read or send messages here.</p>
        </div>
      );
    }
    if (messages.length === 0) return <div className="empty-chat"><p>No messages yet. Start the conversation.</p></div>;
    return messages.map((m) => (
      <Message 
        key={m._id} 
        msg={m} 
        isMe={m.senderName === user.username} 
        serverUrl={SERVER_URL} 
        onImageClick={setViewingImage}
        onEdit={startEdit}
        onDelete={deleteMessage}
      />
    ));
  };

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
            <button className="search-users-btn" onClick={() => { setShowUserSearch(true); setUserSearchQ(""); setUserSearchResults([]); }} title="Search users">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </button>
          </div>
          <div className="me-pill">
            <div className="me-avatar-wrap">
              <AvatarCircle username={user.username} size="sm" label={favoriteLetter} />
              <span className="me-status-dot" style={{ background: STATUS_OPTIONS.find(s => s.id === myStatus)?.color || "#22c55e" }} />
            </div>
            <div className="me-copy">
              <span className="me-name">{favoriteEmoji} {user.username}</span>
              <div className="status-pills">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.id} className={`status-pill ${myStatus === s.id ? "active" : ""}`}
                    style={myStatus === s.id ? { borderColor: s.color, color: s.color } : {}}
                    onClick={() => changeMyStatus(s.id)}>{s.label}</button>
                ))}
              </div>
            </div>
            <button className="settings-btn" onClick={() => setShowSettings(true)}>Settings</button>
            <button className="logout-icon" onClick={onLogout}>Exit</button>
          </div>
        </div>

        <div className="sidebar-scroll">
          <div className="section-head">
            <span className="section-lbl">Rooms</span>
            <button className="add-btn" onClick={() => setShowNewRoom(true)}>+</button>
          </div>
          {rooms.length === 0 && <p className="sidebar-empty">Create a public or invite-only room.</p>}
          {rooms.map((room) => (
            <button
              key={room._id}
              className={`ch-item ${activeChannel?.id === room._id ? "ch-active" : ""} ${mutedRooms.has(room._id) ? "ch-muted" : ""}`}
              onClick={() => openRoom(room)}
              onContextMenu={(e) => openCtxMenu(e, room)}
            >
              <span className="ch-icon">
                {room.isPrivate ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                )}
              </span>
              <span className="ch-name">
                {room.name}
                {mutedRooms.has(room._id) && (
                  <span className="mute-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  </span>
                )}
              </span>
              <span className={`ch-badge ${room.isPrivate ? "private" : "public"}`}>
                {room.isPrivate ? "Invite" : (room.isMember ? "Joined" : "Open")}
              </span>
              {room.createdBy === user.username && <span className="ch-badge host-badge">Host</span>}
            </button>
          ))}

          {/* Discoverable public rooms not yet joined */}
          {rooms.filter(r => !r.isPrivate && !r.isMember).length > 0 && (
            <>
              <p className="discover-label">Discover rooms nearby</p>
              {rooms.filter(r => !r.isPrivate && !r.isMember).map(room => (
                <button key={`disc-${room._id}`} className="ch-item discover-item" onClick={() => openRoom(room)}>
                  <span className="ch-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                  </span>
                  <span className="ch-name">{room.name}</span>
                  <span className="ch-badge public">Join</span>
                </button>
              ))}
            </>
          )}

          <div className="section-head spaced">
            <span className="section-lbl">Direct Messages</span>
            <button className="add-btn" onClick={() => setShowNewDM(true)}>+</button>
          </div>
          {dms.length === 0 && <p className="sidebar-empty">Start a personal DM with any user.</p>}
          {dms.map((dm) => {
            const other = dm.participants.find((p) => p !== user.username);
            const displayName = getDmDisplayName(dm._id, other);
            return (
              <button
                key={dm._id}
                className={`ch-item ${activeChannel?.id === dm._id ? "ch-active" : ""}`}
                onClick={() => openChannel({ id: dm._id, name: other, type: "dm", status: dm.status, requestedBy: dm.requestedBy })}
              >
                <AvatarCircle username={other} size="sm" />
                <span className="ch-name">{displayName}</span>
                {dm.status === "pending" && (
                  <span className={`ch-badge ${dm.requestedBy === user.username ? "pending" : "private"}`}>
                    {dm.requestedBy === user.username ? "Sent" : "Request"}
                  </span>
                )}
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
              <h2>Pick a room or start a private DM.</h2>
              <p>Public rooms are open to everyone. Private rooms are invite-only.</p>
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
                  {activeChannel.type === "dm"
                    ? <AvatarCircle username={activeChannel.name} size="sm" />
                    : (activeChannel.isPrivate ? "LOCK" : "#")}
                </span>
                <div>
                  {activeChannel.type === "dm" && editingNick ? (
                    <div className="nick-edit-row">
                      <input
                        className="nick-input"
                        value={nickDraft}
                        onChange={(e) => setNickDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveNickname(); if (e.key === "Escape") setEditingNick(false); }}
                        placeholder={activeChannel.name}
                        autoFocus
                      />
                      <button className="nick-save-btn" onClick={saveNickname}>Save</button>
                      <button className="nick-cancel-btn" onClick={() => setEditingNick(false)}>✕</button>
                    </div>
                  ) : (
                    <p className="chat-header-name">
                      {activeChannel.type === "dm"
                        ? getDmDisplayName(activeChannel.id, activeChannel.name)
                        : `#${activeChannel.name}`}
                      {activeChannel.type === "dm" && (
                        <button
                          className="nick-edit-btn"
                          title="Set nickname"
                          onClick={() => { setNickDraft(dmNicknames[activeChannel.id] || ""); setEditingNick(true); }}
                        >✎</button>
                      )}
                    </p>
                  )}
                  <p className="chat-header-sub">
                    {activeChannel.type === "dm"
                      ? (isPendingDM
                        ? (isPendingDMRequester ? "DM request sent — waiting for acceptance" : "DM request — needs your approval")
                        : `@${activeChannel.name} · ${isOnline(activeChannel.name) ? "Online" : "Offline"}`)
                      : (activeChannel.isPrivate ? "Private invite-only room" : "Public room")}
                  </p>
                </div>
              </div>
              <div className="chat-header-actions">
                {activeChannel.type === "room" && (
                  <span className={`privacy-pill ${activeChannel.isPrivate ? "private" : "public"}`}>
                    {activeChannel.isPrivate ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Invite only
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                        Open room
                      </>
                    )}
                  </span>
                )}
                {isPendingDM && (
                  <span className="privacy-pill private">
                    {isPendingDMRequester ? "Awaiting approval" : "Pending request"}
                  </span>
                )}
                {isPendingDM && !isPendingDMRequester && (
                  <button className="header-action-btn" onClick={acceptDM}>Accept DM</button>
                )}
                {activeChannel.type === "room" && (
                  <button className="header-action-btn" onClick={openMembers}>Members</button>
                )}
                {activeChannel.type === "room" && isCreator && (
                  <button className="header-action-btn" onClick={() => { setRenameDraft(activeChannel.name); setShowRename(true); }}>
                    Rename
                  </button>
                )}
                {activeChannel.type === "room" && isCreator && activeChannel.isPrivate && (
                  <button className="header-action-btn" onClick={() => { setShowInvite(true); setInviteStatus(""); }}>
                    Invite
                  </button>
                )}
                {activeChannel.type === "room" && isCreator && (
                  <button className="header-action-btn danger-btn" onClick={() => deleteRoom()}>
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div className="messages-area" ref={messagesAreaRef}>
              {renderMessages()}
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

            <div className="input-bar">
              {editingMsg ? (
                <div className="edit-box">
                  <div className="edit-info">Editing Message</div>
                  <div className="edit-controls">
                    <input className="edit-input" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onKeyDown={(e) => { if(e.key==="Enter") saveEdit(); if(e.key==="Escape") setEditingMsg(null); }} autoFocus />
                    <button className="edit-btn save" onClick={saveEdit}>Save</button>
                    <button className="edit-btn cancel" onClick={() => setEditingMsg(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <label className="upload-btn">
                    <input type="file" onChange={handleImageUpload} accept="image/*" disabled={uploading || !canSendInActiveChannel} className="hidden-input" />
                    {uploading ? <span className="loader-small" /> : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="attach-icon"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    )}
                  </label>
                  <textarea
                    className="msg-input"
                    placeholder={canSendInActiveChannel ? "Type a message..." : (isPendingDM ? "Accept DM to start chatting" : "Join this room to chat")}
                    value={text}
                    onChange={handleTyping}
                    onKeyDown={handleKeyDown}
                    disabled={!canSendInActiveChannel}
                  />
                  <button className="send-btn" onClick={sendMessage} disabled={!text.trim() || !canSendInActiveChannel}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </>
              )}
              {channelError && <p className="composer-error">{channelError}</p>}
              {uploadError && <p className="composer-error">{uploadError}</p>}
            </div>
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
              <input className="modal-input" placeholder="Room name" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} autoFocus />
              <div className="room-type-toggle">
                <button type="button" className={`room-type-btn ${!isPrivateRoom ? "active" : ""}`} onClick={() => setIsPrivateRoom(false)}>
                  <span>Public Room</span><small>Anyone can join</small>
                </button>
                <button type="button" className={`room-type-btn ${isPrivateRoom ? "active" : ""}`} onClick={() => setIsPrivateRoom(true)}>
                  <span>Private Room</span><small>Invited people only</small>
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
              <div className="settings-section-head"><span>Theme</span><small>Choose your CocoDrop look</small></div>
              <div className="settings-grid theme-settings-grid">
                {THEMES.map((item) => (
                  <button key={item.id} type="button" className={`theme-choice ${theme === item.id ? "active" : ""}`} onClick={() => setTheme(item.id)}>
                    <span className={`theme-swatch theme-${item.id}`} />
                    <strong>{item.name}</strong>
                  </button>
                ))}
              </div>
            </section>
            <section className="settings-section">
              <div className="settings-section-head"><span>Font Style</span><small>Pick your reading feel</small></div>
              <div className="segmented-row">
                {FONT_STYLES.map((item) => (
                  <button key={item.id} type="button" className={`segment-btn font-${item.id} ${fontStyle === item.id ? "active" : ""}`} onClick={() => setFontStyle(item.id)}>
                    {item.name}
                  </button>
                ))}
              </div>
            </section>
            <section className="settings-section">
              <div className="settings-section-head"><span>Favorite Letter</span><small>Shown in your avatar on this device</small></div>
              <input className="modal-input" value={favoriteLetter} maxLength={2} onChange={(e) => setFavoriteLetter(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="C" />
            </section>
            <section className="settings-section">
              <div className="settings-section-head"><span>Favorite Emoji</span><small>Your tiny signature</small></div>
              <div className="emoji-grid">
                {EMOJI_CHOICES.map((emoji) => (
                  <button key={emoji} type="button" className={`emoji-choice ${favoriteEmoji === emoji ? "active" : ""}`} onClick={() => setFavoriteEmoji(emoji)}>
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
            <input className="modal-input" placeholder="Search username" value={inviteSearch} onChange={(e) => searchInviteUsers(e.target.value)} autoFocus />
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
            <input className="modal-input" placeholder="Search username" value={dmSearch} onChange={(e) => searchDMUsers(e.target.value)} autoFocus />
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

      {/* ── Rename Room Modal ── */}
      {showRename && (
        <div className="modal-overlay" onClick={() => setShowRename(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Rename Room</span>
              <button className="modal-close" onClick={() => setShowRename(false)}>Close</button>
            </div>
            <form onSubmit={renameRoom}>
              <input
                className="modal-input"
                placeholder="New room name"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                autoFocus
              />
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowRename(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!renameDraft.trim()}>Save Name</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Custom Confirm Modal ── */}
      {confirmModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setConfirmModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{confirmModal.title}</span>
            </div>
            <p style={{ color: "var(--muted)", margin: "8px 0 20px", fontSize: "0.9rem" }}>{confirmModal.body}</p>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={async () => {
                const action = confirmModal.onConfirm;
                setConfirmModal(null);
                await action();
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Right-Click Context Menu ── */}
      {ctxMenu && (
        <>
          <div className="ctx-overlay" onClick={closeCtxMenu} onContextMenu={(e) => { e.preventDefault(); closeCtxMenu(); }} />
          <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
            <div className="ctx-header">{ctxMenu.room.name}</div>
            {ctxMenu.room.createdBy === user.username ? (
              <>
                <button className="ctx-item" onClick={() => { closeCtxMenu(); setRenameDraft(ctxMenu.room.name); setShowRename(true); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  Rename Room
                </button>
                <button className="ctx-item danger" onClick={() => { closeCtxMenu(); deleteRoom(ctxMenu.room); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  Delete Room
                </button>
              </>
            ) : (
              <>
                <button className="ctx-item" onClick={() => { closeCtxMenu(); leaveRoom(ctxMenu.room); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Leave Room
                </button>
              </>
            )}
            <button className="ctx-item" onClick={() => { closeCtxMenu(); toggleMuteRoom(ctxMenu.room._id); }}>
              {mutedRooms.has(ctxMenu.room._id) ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  Unmute Room
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  Mute Room
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* ── Members Panel ── */}
      {showMembers && (
        <div className="modal-overlay" onClick={() => setShowMembers(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Members · #{activeChannel?.name}</span>
              <button className="modal-close" onClick={() => setShowMembers(false)}>Close</button>
            </div>
            <div className="search-list">
              {roomMembers.length === 0 && <p className="sidebar-empty">No members found.</p>}
              {roomMembers.map((member) => {
                const ou = getOnlineUser(member);
                const isHost = activeRoom?.createdBy === member;
                const statusColor = ou
                  ? STATUS_OPTIONS.find(s => s.id === (ou.status || "online"))?.color || "#22c55e"
                  : "#94a3b8";
                return (
                  <div key={member} className="search-list-item member-row">
                    <div style={{ position: "relative" }}>
                      <AvatarCircle username={member} size="sm" />
                      <span className="me-status-dot" style={{ background: statusColor }} />
                    </div>
                    <span className="member-name">{member}</span>
                    {isHost && <span className="ch-badge host-badge">Host</span>}
                    <span className="member-status-label" style={{ color: statusColor }}>
                      {ou ? (ou.status || "online") : "offline"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── User Search Modal ── */}
      {showUserSearch && (
        <div className="modal-overlay" onClick={() => setShowUserSearch(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Search Users</span>
              <button className="modal-close" onClick={() => setShowUserSearch(false)}>Close</button>
            </div>
            <input
              className="modal-input"
              placeholder="Type a username…"
              value={userSearchQ}
              onChange={(e) => searchUsersGlobal(e.target.value)}
              autoFocus
            />
            <div className="search-list">
              {userSearchResults.map((item) => {
                const ou = getOnlineUser(item.username);
                const statusColor = ou
                  ? STATUS_OPTIONS.find(s => s.id === (ou.status || "online"))?.color || "#22c55e"
                  : "#94a3b8";
                return (
                  <div key={item.username} className="search-list-item member-row">
                    <div style={{ position: "relative" }}>
                      <AvatarCircle username={item.username} size="sm" />
                      <span className="me-status-dot" style={{ background: statusColor }} />
                    </div>
                    <span className="member-name">{item.username}</span>
                    <span className="member-status-label" style={{ color: statusColor }}>
                      {ou ? (ou.status || "online") : "offline"}
                    </span>
                    <button className="invite-add-btn" onClick={() => { startDM(item.username); setShowUserSearch(false); }}>DM</button>
                  </div>
                );
              })}
              {userSearchResults.length === 0 && userSearchQ && (
                <p className="sidebar-empty">No users found for "{userSearchQ}"</p>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingImage && (
        <div className="lightbox-overlay" onClick={() => setViewingImage(null)}>
          <button className="lightbox-close" onClick={() => setViewingImage(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img src={viewingImage} className="lightbox-content" onClick={(e) => e.stopPropagation()} alt="View" />
        </div>
      )}

    </div>
  );
}
