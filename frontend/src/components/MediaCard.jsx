import {
  CirclePlay,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Music,
  Trash2,
  Video,
  Users,
} from "lucide-react";
import { fileSize, kind } from "../utils";
export default function MediaCard({
  item,
  onStream,
  onDelete,
  onVisibility,
  onRoom,
  showOwnerActions = true,
}) {
  const type = kind(item.contentType);
  const Icon = type === "image" ? ImageIcon : type === "audio" ? Music : Video;
  const isPublic = item.visibility === "PUBLIC";
  return (
    <article className="media-card">
      <div className={`preview ${type}`}>
        <Icon size={34} />
        <span className="type-label">
          <Icon size={13} />
          {type}
        </span>
      </div>
      <div className="card-body">
        <div className="file-title" title={item.filename}>
          {item.filename}
        </div>
        <div className="muted small">
          {fileSize(item.size)} · {isPublic ? "Public" : "Private"}
        </div>
        <div className="card-actions">
          <button
            className="icon-button stream-action"
            title="Stream file"
            onClick={onStream}
          >
            <CirclePlay size={18} />
          </button>
          {showOwnerActions && (
            <button
              className="icon-button"
              title={isPublic ? "Make private" : "Make public"}
              onClick={onVisibility}
            >
              {isPublic ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          {showOwnerActions && type === "video" && (
            <button
              className="icon-button"
              title="Start Watch Together room"
              onClick={onRoom}
            >
              <Users size={16} />
            </button>
          )}
          {showOwnerActions && (
            <button
              className="icon-button danger"
              title="Delete file"
              onClick={onDelete}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
