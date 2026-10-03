import { useEffect, useRef, useState } from "react";
import { Copy, X } from "lucide-react";
import { API, roomStreamUrl } from "../api/client";
import { fileSize } from "../utils";
export default function WatchRoom({ room, token, onClose }) {
  const video = useRef(null);
  const socket = useRef(null);
  const applyingRemote = useRef(false);
  const [status, setStatus] = useState("Connecting...");
  useEffect(() => {
    const wsUrl =
      API.replace(/^http/, "ws").replace(/\/api$/, "") +
      `/ws/watch/${room.roomCode}`;
    const ws = new WebSocket(wsUrl);
    socket.current = ws;
    ws.onopen = () => {
      setStatus("Connected");
      ws.send(JSON.stringify({ type: "SYNC_REQUEST" }));
    };
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type !== "PLAYBACK_STATE" || !video.current) return;
      applyingRemote.current = true;
      video.current.currentTime = data.positionSeconds || 0;
      if (data.playing) await video.current.play().catch(() => {});
      else video.current.pause();
      window.setTimeout(() => {
        applyingRemote.current = false;
      }, 150);
    };
    ws.onclose = () => setStatus("Disconnected");
    return () => ws.close();
  }, [room.roomCode]);
  const send = (payload) => {
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify(payload));
  };
  const onPlay = () =>
    !applyingRemote.current &&
    send({ type: "PLAY", positionSeconds: video.current.currentTime });
  const onPause = () =>
    !applyingRemote.current &&
    send({ type: "PAUSE", positionSeconds: video.current.currentTime });
  const onSeek = () =>
    !applyingRemote.current &&
    send({ type: "SEEK", positionSeconds: video.current.currentTime });
  return (
    <div className="viewer-backdrop">
      <section className="viewer room-viewer" role="dialog" aria-modal="true">
        <header className="viewer-header">
          <div>
            <div className="file-title">Watch Together</div>
            <div className="muted small">
              {room.item.filename} · {fileSize(room.item.size)}
            </div>
          </div>
          <button className="icon-button" title="Close room" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="room-bar">
          <span>
            Room code <strong>{room.roomCode}</strong>
          </span>
          <button
            className="icon-button"
            title="Copy room code"
            onClick={() => navigator.clipboard?.writeText(room.roomCode)}
          >
            <Copy size={16} />
          </button>
          <span className="muted small">
            {status} · {room.participantIds?.length || 1} participant(s)
          </span>
        </div>
        <div className="viewer-content video">
          <video
            ref={video}
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            autoPlay
            preload="metadata"
            src={roomStreamUrl(room.item, room.roomCode, token)}
            onPlay={onPlay}
            onPause={onPause}
            onSeeked={onSeek}
          />
        </div>
      </section>
    </div>
  );
}
