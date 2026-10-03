import crypto from "node:crypto";
import { Router } from "express";
import { authenticate } from "./auth.js";
import { query } from "./db.js";

const router = Router();
const code = () =>
  crypto.randomBytes(4).toString("base64url").slice(0, 6).toUpperCase();
const response = (row) => ({
  roomCode: row.room_code,
  mediaId: row.media_id,
  media: {
    id: row.media_id,
    filename: row.filename,
    contentType: row.content_type,
    size: Number(row.media_size),
    visibility: row.media_visibility,
  },
  hostId: row.host_id,
  createdAt: row.created_at,
  status: row.status,
  participantIds: row.participant_ids || [],
});
async function room(codeValue) {
  return (
    await query(
      `SELECT r.*, m.filename, m.content_type, m.size AS media_size, m.visibility AS media_visibility, COALESCE(array_agg(p.user_id) FILTER (WHERE p.user_id IS NOT NULL), '{}') AS participant_ids FROM watch_rooms r JOIN media m ON m.id = r.media_id LEFT JOIN room_participants p ON p.room_id = r.id WHERE r.room_code = $1 GROUP BY r.id, m.id`,
      [codeValue],
    )
  ).rows[0];
}
router.post("/", authenticate, async (req, res, next) => {
  try {
    const media = (
      await query("SELECT id FROM media WHERE id = $1 AND owner_id = $2", [
        req.body.mediaId,
        req.user.userId,
      ])
    ).rows[0];
    if (!media) return res.status(404).json({ message: "Media not found" });
    let value;
    do {
      value = code();
    } while (
      (await query("SELECT 1 FROM watch_rooms WHERE room_code = $1", [value]))
        .rowCount
    );
    const created = (
      await query(
        "INSERT INTO watch_rooms(room_code, media_id, host_id, created_at, status) VALUES($1,$2,$3,NOW(),'ACTIVE') RETURNING *",
        [value, media.id, req.user.userId],
      )
    ).rows[0];
    await query(
      "INSERT INTO room_participants(room_id, user_id, joined_at) VALUES($1,$2,NOW())",
      [created.id, req.user.userId],
    );
    res.status(201).json(response(await room(value)));
  } catch (e) {
    next(e);
  }
});
router.get("/:code", authenticate, async (req, res, next) => {
  try {
    const value = await room(req.params.code.toUpperCase());
    if (!value) return res.status(404).json({ message: "Room not found" });
    if (!value.participant_ids.map(Number).includes(Number(req.user.userId)))
      return res.status(403).json({ message: "Join the room first" });
    res.json(response(value));
  } catch (e) {
    next(e);
  }
});
router.post("/:code/join", authenticate, async (req, res, next) => {
  try {
    const value = await room(req.params.code.toUpperCase());
    if (!value || value.status !== "ACTIVE")
      return res.status(404).json({ message: "Active room not found" });
    await query(
      "INSERT INTO room_participants(room_id, user_id, joined_at) VALUES($1,$2,NOW()) ON CONFLICT DO NOTHING",
      [value.id, req.user.userId],
    );
    res.json(response(await room(req.params.code.toUpperCase())));
  } catch (e) {
    next(e);
  }
});
router.post("/:code/leave", authenticate, async (req, res, next) => {
  try {
    const value = await room(req.params.code.toUpperCase());
    if (!value) return res.status(404).json({ message: "Room not found" });
    await query(
      "DELETE FROM room_participants WHERE room_id = $1 AND user_id = $2",
      [value.id, req.user.userId],
    );
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
router.delete("/:code", authenticate, async (req, res, next) => {
  try {
    const value = await room(req.params.code.toUpperCase());
    if (!value) return res.status(404).json({ message: "Room not found" });
    if (Number(value.host_id) !== Number(req.user.userId))
      return res
        .status(403)
        .json({ message: "Only the host can close this room" });
    await query("UPDATE watch_rooms SET status = 'CLOSED' WHERE id = $1", [
      value.id,
    ]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
export async function roomParticipant(roomCode, userId) {
  const value = await room(roomCode);
  return Boolean(
    value &&
    value.status === "ACTIVE" &&
    value.participant_ids.map(Number).includes(Number(userId)),
  );
}
export async function roomMedia(roomCode) {
  const value = await room(roomCode);
  return value?.media_id;
}
export default router;
