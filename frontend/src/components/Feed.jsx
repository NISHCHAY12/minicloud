import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { request } from "../api/client";
import MediaCard from "./MediaCard";
import MediaViewer from "./MediaViewer";
export default function Feed({ session }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const page = await request("/feed?page=0&size=20", {}, session.token);
      setItems(page.content || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="content">
      <div className="heading-row">
        <div>
          <p className="eyebrow">Discover</p>
          <h1>Public media</h1>
          <p className="muted">Files shared by MiniCloud users.</p>
        </div>
        <button
          className="icon-button"
          title="Refresh public feed"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "spin" : ""} />
        </button>
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="media-grid">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            showOwnerActions={false}
            onStream={() => setSelected(item)}
          />
        ))}
      </div>
      {!loading && !items.length && (
        <div className="empty">
          <h2>No public files yet</h2>
          <p className="muted">
            Make a file public from your library to see it here.
          </p>
        </div>
      )}
      {selected && (
        <MediaViewer
          item={selected}
          token={session.token}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
