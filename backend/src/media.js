import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { authenticate } from "./auth.js";
import { pool, query } from "./db.js";
import { removeStored, readable, storagePath, storedName } from "./storage.js";
import { config } from "./config.js";

const router = Router();
export const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, config.storagePath),
    filename: (_req, file, cb) => cb(null, storedName(file.originalname)),
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});
const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "audio/mpeg",
  "audio/mp3",
  "video/mp4",
  "video/webm",
]);
const dto = (row) => ({
  id: row.id,
  filename: row.filename,
  contentType: row.content_type,
  size: Number(row.size),
  uploadedAt: row.uploaded_at,
  visibility: row.visibility,
});
const owned = async (id, userId) =>
  (
    await query("SELECT * FROM media WHERE id = $1 AND owner_id = $2", [
      id,
      userId,
    ])
  ).rows[0];
const accessible = async (id, userId, roomCode) => {
  const result = await query(
    `SELECT m.* FROM media m WHERE m.id = $1 AND (m.visibility = 'PUBLIC' OR m.owner_id = $2 OR EXISTS (SELECT 1 FROM watch_rooms r JOIN room_participants p ON p.room_id = r.id WHERE r.room_code = $3 AND r.status = 'ACTIVE' AND r.media_id = m.id AND p.user_id = $2))`,
    [id, userId, roomCode || null],
  );
  return result.rows[0];
};

router.get("/", authenticate, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT * FROM media WHERE owner_id = $1 ORDER BY uploaded_at DESC",
      [req.user.userId],
    );
    res.json(result.rows.map(dto));
  } catch (e) {
    next(e);
  }
});
router.get("/feed", authenticate, async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 0), 0);
    const size = Math.min(Math.max(Number(req.query.size || 20), 1), 50);
    const result = await query(
      "SELECT * FROM media WHERE visibility = 'PUBLIC' ORDER BY uploaded_at DESC LIMIT $1 OFFSET $2",
      [size, page * size],
    );
    const count = await query(
      "SELECT count(*)::int AS count FROM media WHERE visibility = 'PUBLIC'",
    );
    res.json({
      content: result.rows.map(dto),
      number: page,
      size,
      totalElements: count.rows[0].count,
      totalPages: Math.ceil(count.rows[0].count / size),
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  "/",
  authenticate,
  uploadMiddleware.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "File is required" });
      if (!allowed.has(req.file.mimetype)) {
        await removeStored(req.file.filename);
        return res.status(415).json({
          message: "Only images, MP3, MP4, and WebM files are supported",
        });
      }
      const result = await query(
        "INSERT INTO media(filename, stored_name, content_type, size, uploaded_at, visibility, owner_id) VALUES($1,$2,$3,$4,NOW(),'PRIVATE',$5) RETURNING *",
        [
          req.file.originalname,
          req.file.filename,
          req.file.mimetype,
          req.file.size,
          req.user.userId,
        ],
      );
      res.status(201).json(dto(result.rows[0]));
    } catch (e) {
      if (req.file) await removeStored(req.file.filename).catch(() => {});
      next(e);
    }
  },
);
router.patch("/:id/visibility", authenticate, async (req, res, next) => {
  try {
    const item = await owned(req.params.id, req.user.userId);
    if (!item) return res.status(404).json({ message: "Media not found" });
    if (!["PUBLIC", "PRIVATE"].includes(req.body.visibility))
      return res.status(400).json({ message: "Invalid visibility" });
    const result = await query(
      "UPDATE media SET visibility = $1 WHERE id = $2 RETURNING *",
      [req.body.visibility, req.params.id],
    );
    res.json(dto(result.rows[0]));
  } catch (e) {
    next(e);
  }
});
router.delete("/:id", authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const item = await owned(req.params.id, req.user.userId);
    if (!item) return res.status(404).json({ message: "Media not found" });
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM room_participants WHERE room_id IN (SELECT id FROM watch_rooms WHERE media_id = $1)",
      [req.params.id],
    );
    await client.query("DELETE FROM watch_rooms WHERE media_id = $1", [
      req.params.id,
    ]);
    await client.query("DELETE FROM media WHERE id = $1 AND owner_id = $2", [
      req.params.id,
      req.user.userId,
    ]);
    await client.query("COMMIT");
    await removeStored(item.stored_name);
    res.status(204).end();
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});
router.get("/:id/stream", authenticate, async (req, res, next) => {
  try {
    const item = await accessible(
      req.params.id,
      req.user.userId,
      req.query.room,
    );
    if (!item)
      return res
        .status(403)
        .json({ message: "You do not have access to this media" });
    const stat = await fs.stat(storagePath(item.stored_name)).catch(() => null);
    if (!stat)
      return res.status(404).json({ message: "Stored file is missing" });
    const range = req.get("range");
    res.set("Accept-Ranges", "bytes").type(item.content_type);
    if (!range?.startsWith("bytes="))
      return res
        .set("Content-Length", stat.size)
        .status(200)
        .sendFile(path.resolve(storagePath(item.stored_name)));
    const values = range.slice(6).split(",")[0].split("-");
    let start = values[0]
      ? Number(values[0])
      : Math.max(0, stat.size - Number(values[1]));
    let end = values[1] && values[0] ? Number(values[1]) : stat.size - 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      start >= stat.size ||
      end < start
    )
      return res.status(416).set("Content-Range", `bytes */${stat.size}`).end();
    end = Math.min(end, stat.size - 1);
    res.status(206).set({
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    });
    readable(item.stored_name, start, end).pipe(res);
  } catch (e) {
    next(e);
  }
});
export default router;
