import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LogOut, Cloud } from "lucide-react";
import { request } from "./api/client";
import Auth from "./components/Auth";
import Library from "./components/Library";
import Feed from "./components/Feed";
import "./styles.css";

function readSession() {
  try {
    const value = localStorage.getItem("minicloud-session");
    return value ? JSON.parse(value) : null;
  } catch {
    try {
      localStorage.removeItem("minicloud-session");
    } catch {}
    return null;
  }
}

function App() {
  const [session, setSession] = useState(readSession);
  const [view, setView] = useState("library");
  useEffect(() => {
    if (session?.token)
      request("/auth/session-cookie", { method: "POST" }, session.token).catch(
        () => {},
      );
  }, [session?.token]);
  if (!session)
    return (
      <Auth
        onLogin={(data) => {
          localStorage.setItem("minicloud-session", JSON.stringify(data));
          setSession(data);
        }}
      />
    );
  const logout = async () => {
    try {
      await request("/auth/logout", { method: "POST" }, session.token);
    } finally {
      localStorage.removeItem("minicloud-session");
      setSession(null);
    }
  };
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Cloud size={20} /> MiniCloud
        </div>
        <nav className="nav-tabs">
          <button
            className={view === "library" ? "active" : ""}
            onClick={() => setView("library")}
          >
            My library
          </button>
          <button
            className={view === "feed" ? "active" : ""}
            onClick={() => setView("feed")}
          >
            Public feed
          </button>
        </nav>
        <div className="account">
          <span>{session.email}</span>
          <button className="icon-button" title="Sign out" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </header>
      {view === "library" ? (
        <Library session={session} />
      ) : (
        <Feed session={session} />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
