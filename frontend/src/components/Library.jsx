import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Upload, Cloud } from "lucide-react";
import { request } from "../api/client";
import { fileSize } from "../utils";
import MediaCard from "./MediaCard";
import MediaViewer from "./MediaViewer";
import WatchRoom from "./WatchRoom";
import "./room.css";

export default function Library({ session }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [room, setRoom] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const load = async () => {
    setRefreshing(true);
    try {
      setItems(await request("/media", {}, session.token));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const stats = useMemo(
    () => ({
      count: items.length,
      size: items.reduce((sum, item) => sum + item.size, 0),
    }),
    [items],
  );
  async function upload(event) {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const item = await request(
        "/media",
        { method: "POST", body: form },
        session.token,
      );
      setItems((current) => [item, ...current]);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }
  async function remove(id) {
    if (!window.confirm("Delete this file?")) return;
    try {
      await request(`/media/${id}`, { method: "DELETE" }, session.token);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }
  async function toggleVisibility(item) {
    const visibility = item.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    try {
      const updated = await request(
        `/media/${item.id}/visibility`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility }),
        },
        session.token,
      );
      setItems((current) =>
        current.map((value) => (value.id === item.id ? updated : value)),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  async function createRoom(item) {
    try {
      const data = await request(
        "/rooms",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId: item.id }),
        },
        session.token,
      );
      setRoom({ ...data, item });
    } catch (e) {
      setError(e.message);
    }
  }
  async function joinRoom(event) {
    event.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code) return;
    try {
      const data = await request(
        `/rooms/${encodeURIComponent(code)}/join`,
        { method: "POST" },
        session.token,
      );
      const item =
        data.media || items.find((value) => value.id === data.mediaId);
      if (!item) throw new Error("The room media details could not be loaded.");
      setRoom({ ...data, item });
      setRoomCode("");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="content">
      <div className="heading-row">
        <div>
          <p className="eyebrow">Media library</p>
          <h1>Your files</h1>
          <p className="muted">
            {stats.count} files · {fileSize(stats.size || 0)} stored
          </p>
        </div>
        <label className="upload-button">
          <Upload size={17} />
          {uploading ? "Uploading..." : "Upload file"}
          <input
            type="file"
            accept="image/*,audio/mpeg,video/mp4,video/webm"
            onChange={upload}
            disabled={uploading}
          />
        </label>
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="room-join-panel">
        <div className="room-join-copy">
          <div className="room-join-title">Join a Watch Together room</div>
          <div className="muted small">
            Enter the six-character code shared by the host.
          </div>
        </div>
        <form className="join-form" onSubmit={joinRoom}>
          <input
            aria-label="Watch Together room code"
            placeholder="ABC123"
            value={roomCode}
            onChange={(event) =>
              setRoomCode(
                event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
              )
            }
            maxLength="6"
          />
          <button
            className="join-button"
            type="submit"
            disabled={roomCode.length !== 6}
          >
            Join room
          </button>
        </form>
      </div>
      <div className="toolbar">
        <span className="muted">Images, MP3, MP4, and WebM</span>
        <button
          className="icon-button"
          title="Refresh library"
          onClick={load}
          disabled={refreshing}
        >
          <RefreshCw size={17} className={refreshing ? "spin" : ""} />
        </button>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <Cloud size={28} />
          <h2>Your library is empty</h2>
          <p className="muted">Upload a file to start using MiniCloud.</p>
        </div>
      ) : (
        <div className="media-grid">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onStream={() => setSelected(item)}
              onDelete={() => remove(item.id)}
              onVisibility={() => toggleVisibility(item)}
              onRoom={() => createRoom(item)}
            />
          ))}
        </div>
      )}
      {selected && (
        <MediaViewer
          item={selected}
          token={session.token}
          onClose={() => setSelected(null)}
        />
      )}
      {room && (
        <WatchRoom
          room={room}
          token={session.token}
          onClose={() => setRoom(null)}
        />
      )}
    </section>
  );
}
