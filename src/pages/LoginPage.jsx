import { useState } from "react";
import API from "../api";

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />

            <label className="field-label" htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                id="password"
                className="login-input"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  /* eye-off */
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* eye */
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {error && <p className="login-error">{error}</p>}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Enter CocoDrop" : "Create account"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
