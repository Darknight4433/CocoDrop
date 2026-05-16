import { useState } from "react";
import API from "../api";

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await API.post(`/auth/${mode}`, { username, password });
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-grid" aria-hidden="true" />
      <div className="login-shell">
        <section className="login-panel brand-panel">
          <div className="product-mark">CD</div>
          <p className="eyebrow">Realtime rooms and DMs</p>
          <h1 className="login-title">CocoDrop</h1>
          <p className="login-sub">
            A clean chat workspace for public rooms, invite-only rooms, and personal direct messages.
          </p>
          <div className="feature-strip">
            <span>Public rooms</span>
            <span>Private invites</span>
            <span>Fast DMs</span>
          </div>
        </section>

        <section className="login-panel auth-panel">
          <div className="auth-header">
            <p className="auth-kicker">Welcome</p>
            <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
          </div>

          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Login
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => { setMode("register"); setError(""); }}
            >
              Register
            </button>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="username">Username</label>
            <input
              id="username"
              className="login-input"
              type="text"
              placeholder="deva"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />

            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="login-input"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {error && <p className="login-error">{error}</p>}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? "Please wait" : mode === "login" ? "Enter CocoDrop" : "Create account"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
