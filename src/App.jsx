import { useState } from "react";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import "./index.css";

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("sc_token");
    const storedUser = localStorage.getItem("sc_user");
    if (token && storedUser) {
      return JSON.parse(storedUser);
    }
    return null;
  });

  const handleLogin = (userData, token) => {
    localStorage.setItem("sc_token", token);
    localStorage.setItem("sc_user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("sc_token");
    localStorage.removeItem("sc_user");
    setUser(null);
  };

  return user ? (
    <ChatPage user={user} onLogout={handleLogout} />
  ) : (
    <LoginPage onLogin={handleLogin} />
  );
}

export default App;
