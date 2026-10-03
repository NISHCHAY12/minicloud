import http from "node:http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { WebSocket, WebSocketServer } from "ws";
import { config } from "./config.js";
import { pool, query, ensureCompatibility } from "./db.js";
import {
  authenticate,
  createToken,
  readToken,
  setAuthCookie,
  hashPassword,
  verifyPassword,
  tokenFromRequest,
} from "./auth.js";
import media from "./media.js";
import rooms, { roomMedia, roomParticipant } from "./rooms.js";

const app = express();
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.get("/api/health", (_req, res) => res.send("MiniCloud backend is running"));
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    if (!email || password.length < 8)
      return res
        .status(400)
        .json({ message: "Email and an 8-character password are required" });
    if (
      (await query("SELECT 1 FROM app_users WHERE email = $1", [email]))
        .rowCount
    )
      return res.status(409).json({ message: "Email is already registered" });
    const result = await query(
      "INSERT INTO app_users(email, password_hash) VALUES($1,$2) RETURNING id,email",
      [email, await hashPassword(password)],
    );
    const token = createToken(result.rows[0]);
    setAuthCookie(res, token);
    res.status(201).json({ token, email });
  } catch (e) {
    next(e);
  }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const user = (
      await query("SELECT * FROM app_users WHERE email = $1", [email])
    ).rows[0];
    if (
      !user ||
      !(await verifyPassword(
        String(req.body.password || ""),
        user.password_hash,
      ))
    )
      return res.status(401).json({ message: "Invalid credentials" });
    const token = createToken(user);
    setAuthCookie(res, token);
    res.json({ token, email: user.email });
  } catch (e) {
    next(e);
  }
});
app.post("/api/auth/session-cookie", authenticate, (req, res) => {
  setAuthCookie(res, tokenFromRequest(req));
  res.status(204).end();
});
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("MINICLOUD_TOKEN", { path: "/" });
  res.status(204).end();
});
app.get("/api/feed", authenticate, async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 0), 0);
    const size = Math.min(Math.max(Number(req.query.size || 20), 1), 50);
    const result = await query(
      "SELECT id, filename, content_type, size, uploaded_at, visibility FROM media WHERE visibility = 'PUBLIC' ORDER BY uploaded_at DESC LIMIT $1 OFFSET $2",
      [size, page * size],
    );
    const count = await query(
      "SELECT count(*)::int AS count FROM media WHERE visibility = 'PUBLIC'",
    );
    res.json({
      content: result.rows.map((row) => ({
        id: row.id,
        filename: row.filename,
        contentType: row.content_type,
        size: Number(row.size),
        uploadedAt: row.uploaded_at,
        visibility: row.visibility,
      })),
      number: page,
      size,
      totalElements: count.rows[0].count,
      totalPages: Math.ceil(count.rows[0].count / size),
    });
  } catch (e) {
    next(e);
  }
});
app.use("/api/media", media);
app.use("/api/rooms", rooms);
app.use((err, _req, res, _next) => {
  console.error(err);
  if (!res.headersSent)
    res
      .status(err.status || 500)
      .json({ message: err.message || "Internal server error" });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const sockets = new Map();
const states = new Map();
function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}
function broadcast(code, payload, excluded) {
  for (const socket of sockets.get(code) || [])
    if (socket !== excluded) send(socket, payload);
}
wss.on("connection", (socket, { roomCode, userId }) => {
  if (!sockets.has(roomCode)) sockets.set(roomCode, new Set());
  sockets.get(roomCode).add(socket);
  if (!states.has(roomCode))
    states.set(roomCode, { playing: false, positionSeconds: 0 });
  socket.on("message", (raw) => {
    try {
      const event = JSON.parse(raw);
      if (!["PLAY", "PAUSE", "SEEK", "SYNC_REQUEST"].includes(event.type))
        return;
      const state = states.get(roomCode);
      if (event.type === "SYNC_REQUEST")
        return send(socket, { type: "PLAYBACK_STATE", ...state });
      if (event.type === "PLAY") state.playing = true;
      if (event.type === "PAUSE") state.playing = false;
      if (
        ["PLAY", "PAUSE", "SEEK"].includes(event.type) &&
        Number.isFinite(Number(event.positionSeconds))
      )
        state.positionSeconds = Number(event.positionSeconds);
      broadcast(
        roomCode,
        { type: "PLAYBACK_STATE", ...state, changedBy: userId },
        socket,
      );
    } catch {}
  });
  socket.on("close", () => sockets.get(roomCode)?.delete(socket));
});
server.on("upgrade", async (req, socket, head) => {
  if (!req.url?.startsWith("/ws/watch/")) return socket.destroy();
  try {
    const roomCode = decodeURIComponent(
      req.url.split("/").pop().split("?")[0],
    ).toUpperCase();
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("MINICLOUD_TOKEN="))
      ?.split("=")
      .slice(1)
      .join("=");
    const user = readToken(token);
    if (!(await roomParticipant(roomCode, user.userId)))
      throw new Error("Forbidden");
    if (!(await roomMedia(roomCode))) throw new Error("Room not found");
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, { roomCode, userId: user.userId }),
    );
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

await ensureCompatibility();
server.listen(config.port, () =>
  console.log(
    `MiniCloud PERN backend listening on http://localhost:${config.port}`,
  ),
);
process.on("SIGTERM", () => {
  server.close(() => pool.end());
});
