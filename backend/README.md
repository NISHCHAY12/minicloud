# MiniCloud PERN Backend

This is the JavaScript replacement for the former Spring Boot backend.

## Stack

- Node.js and Express
- PostgreSQL through `pg`
- JWT authentication with an HttpOnly cookie
- `multer` for local media uploads
- `ws` for Watch Together playback state

The service intentionally preserves the existing API routes and PostgreSQL tables, so the React frontend does not need a rewrite.

## Run

```powershell
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `DATABASE_URL` and a private `JWT_SECRET`. The default port is `8080`, and new files are stored in `backend/storage`. Keep `.env` and the storage directory out of version control.

Use `npm run format` before committing changes and `npm run format:check` in CI.

Only one backend should listen on port `8080` at a time.
