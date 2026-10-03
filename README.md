# MiniCloud

MiniCloud is a small authenticated media platform built with React, Node.js,
Express, and PostgreSQL. Users can register, upload supported media, stream it
with HTTP range requests, publish files, and watch video together in a private
room.

The active backend is the JavaScript PERN service in `backend`. The original
Spring Boot implementation is no longer part of the active project.

## Features

- Registration and login with JWT authentication.
- HttpOnly authentication cookie for browser media requests.
- Upload of JPEG, PNG, GIF, MP3, MP4, and WebM files.
- PostgreSQL metadata with owner and visibility information.
- Original file bytes stored separately on local disk.
- HTTP `Range` support for video and audio seeking.
- Public feed for files marked `PUBLIC`.
- Owner-only visibility changes and deletion.
- Watch Together rooms with six-character join codes.
- WebSocket playback synchronization for play, pause, and seek.
- Stream-only Watch Together controls without a download button.

## Project Layout

```text
minicloud/
├── backend/
│   ├── src/
│   │   ├── auth.js       Authentication and JWT helpers
│   │   ├── config.js     Environment-backed configuration
│   │   ├── db.js         PostgreSQL connection and compatibility setup
│   │   ├── media.js      Upload, ownership, visibility, and streaming routes
│   │   ├── rooms.js      Watch Together REST routes
│   │   ├── server.js     Express and WebSocket application entry point
│   │   └── storage.js    Local file storage helpers
│   ├── storage/          Uploaded bytes; ignored by Git
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/          API and media URL helpers
│   │   ├── components/   Auth, library, feed, viewer, and room UI
│   │   └── main.jsx      Application shell
│   └── package.json
├── backend/schema.sql
├── .env files            Local configuration; ignored by Git
└── README.md
```

## Requirements

- Node.js 20 or newer
- PostgreSQL running locally or remotely
- A PostgreSQL database named `minicloud`

## Local Setup

### 1. Configure the backend

From `backend`, copy `.env.example` to `.env` and set the database URL and
a private JWT secret:

```powershell
cd D:\java\minicloud\backend
Copy-Item .env.example .env
npm install
npm run dev
```

The backend listens on `http://localhost:8080` by default. Configuration is
loaded from `backend/.env`, even when the server is started from the project
root.

Important environment variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend HTTP port; default `8080` |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign authentication tokens |
| `JWT_EXPIRATION_MS` | Token lifetime in milliseconds |
| `STORAGE_PATH` | Directory for uploaded bytes; default `./storage` |
| `FRONTEND_ORIGIN` | Allowed frontend origin; default `http://localhost:5173` |

Never commit `.env`. The root `.gitignore` excludes secrets, dependencies,
build output, logs, and uploaded files.

### 2. Start the frontend

In a second terminal:

```powershell
cd D:\java\minicloud\frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.
The Vite development proxy forwards `/api` and `/ws` to the backend on port
8080.

Only one backend should listen on port 8080 at a time. If the port is already
occupied, stop the existing process before starting MiniCloud.

## Storage Model

PostgreSQL stores metadata only:

- Original filename for display.
- Generated storage filename.
- MIME type and byte size.
- Upload timestamp.
- Owner ID and visibility.

The actual bytes are written to `backend/storage` by default. Each uploaded
file receives a UUID-based filename while retaining a validated extension.
Files are not converted or encrypted by the application: MP4 remains MP4, MP3
remains MP3, and images retain their original format.

The database filename is not the disk filename. The `stored_name` column is the
link between a metadata row and its disk object.

If a database row refers to a disk object that has been deleted or moved, the
API returns `Stored file is missing`. That metadata row must be re-uploaded or
removed separately.

## Authentication and Access Rules

Registration and login return a JWT and set an HttpOnly `MINICLOUD_TOKEN` cookie.
Normal API requests can also use a Bearer token. Native browser media elements
use the cookie or a stream-specific token because `<video>`, `<audio>`, and
`<img>` cannot attach a custom Authorization header themselves.

Access is checked on every media request:

- Private media is available to its owner.
- Public media is available to authenticated users.
- Room media is available to active room participants.
- Only the owner can delete media or change visibility.
- Room membership is checked before WebSocket connection upgrade.

## HTTP Range Streaming

`GET /api/media/{id}/stream` supports full responses and byte ranges. A browser
can request a range such as `bytes=0-1023`, and the backend responds with:

- `200 OK` for a complete response.
- `206 Partial Content` for a valid range.
- `Accept-Ranges: bytes`.
- `Content-Range` and `Content-Length` headers.
- `416 Range Not Satisfiable` for invalid ranges.

This allows MP4 and MP3 playback to seek without loading the entire file into
memory.

## Watch Together

The host creates a room for one of their video files. Other authenticated users
join with the six-character room code. The room stores its host, media ID,
status, and participant records in PostgreSQL.

The frontend connects to:

```text
/ws/watch/{roomCode}
```

The WebSocket synchronizes `PLAY`, `PAUSE`, `SEEK`, and `SYNC_REQUEST` events.
The sender is excluded from its own broadcast to prevent play/pause feedback
loops. Room participants can stream the host's file, but the Watch Together
viewer does not expose a download control.

## API Summary

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Authenticate an account |
| `POST` | `/api/auth/logout` | Clear the auth cookie |
| `GET` | `/api/media` | List the current user's files |
| `POST` | `/api/media` | Upload a supported file |
| `PATCH` | `/api/media/{id}/visibility` | Change owner visibility |
| `GET` | `/api/media/{id}/stream` | Stream accessible media |
| `DELETE` | `/api/media/{id}` | Delete owned metadata and bytes |
| `GET` | `/api/feed?page=0&size=20` | List public media |
| `POST` | `/api/rooms` | Create a Watch Together room |
| `POST` | `/api/rooms/{code}/join` | Join a room |
| `POST` | `/api/rooms/{code}/leave` | Leave a room |
| `DELETE` | `/api/rooms/{code}` | Close a room as host |
| `GET` | `/api/health` | Check backend availability |

## Code Quality Commands

Run these before committing changes:

```powershell
cd D:\java\minicloud\backend
npm run format:check
npm test

cd D:\java\minicloud\frontend
npm run format:check
npm run build
```

The current backend test command is wired to Node's test runner, but the
project still needs automated endpoint and authorization tests. Manual testing
should cover registration, upload, range seeking, public/private access,
User A/User B isolation, room joining, and room playback synchronization.

## Maintenance and Future Improvements

The application intentionally keeps deployment simple: one Node process,
PostgreSQL, local disk, and one React client. The internal modules keep the
storage, authentication, database, media, and room concerns separate so the
system can be extended without rewriting the API.

For production, add database migrations, stronger upload inspection and
quotas, HTTPS, refresh-token/session management, automated tests, and an object
storage provider such as S3 or MinIO. Large-scale deployments may later need
transcoding, HLS, replication, and a shared WebSocket state store.
