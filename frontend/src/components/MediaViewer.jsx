import { Download, X } from "lucide-react";
import { kind, fileSize } from "../utils";
import { streamUrl } from "../api/client";

export default function MediaViewer({ item, token, onClose }) {
  const type = kind(item.contentType);
  const url = streamUrl(item, token);
  return (
    <div
      className="viewer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="viewer"
        role="dialog"
        aria-modal="true"
        aria-label={`Streaming ${item.filename}`}
      >
        <header className="viewer-header">
          <div>
            <div className="file-title" title={item.filename}>
              {item.filename}
            </div>
            <div className="muted small">
              {type} · {fileSize(item.size)}
            </div>
          </div>
          <button
            className="icon-button"
            title="Close stream"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <div className={`viewer-content ${type}`}>
          {type === "image" && <img src={url} alt={item.filename} />}{" "}
          {type === "audio" && <audio controls autoPlay src={url} />}{" "}
          {type === "video" && (
            <video controls autoPlay preload="metadata" src={url} />
          )}
        </div>
        <footer className="viewer-footer">
          <a className="download-button" href={url} download={item.filename}>
            <Download size={16} /> Download
          </a>
        </footer>
      </section>
    </div>
  );
}
