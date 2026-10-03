import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;
export const pool = new Pool({ connectionString: config.databaseUrl });
export const query = (text, params) => pool.query(text, params);

export async function ensureCompatibility() {
  await query(
    `CREATE TABLE IF NOT EXISTS app_users (id BIGSERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL)`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS media (id BIGSERIAL PRIMARY KEY, filename VARCHAR(255) NOT NULL, stored_name VARCHAR(255) NOT NULL, content_type VARCHAR(255) NOT NULL, size BIGINT NOT NULL, uploaded_at TIMESTAMPTZ NOT NULL, visibility VARCHAR(20), owner_id BIGINT NOT NULL REFERENCES app_users(id))`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS watch_rooms (id BIGSERIAL PRIMARY KEY, room_code VARCHAR(20) NOT NULL UNIQUE, media_id BIGINT NOT NULL REFERENCES media(id), host_id BIGINT NOT NULL REFERENCES app_users(id), created_at TIMESTAMPTZ NOT NULL, status VARCHAR(20) NOT NULL)`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS room_participants (id BIGSERIAL PRIMARY KEY, room_id BIGINT NOT NULL REFERENCES watch_rooms(id), user_id BIGINT NOT NULL REFERENCES app_users(id), joined_at TIMESTAMPTZ NOT NULL, UNIQUE(room_id, user_id))`,
  );
  await query(
    "ALTER TABLE media ADD COLUMN IF NOT EXISTS visibility varchar(20)",
  );
  await query(
    "UPDATE media SET visibility = 'PRIVATE' WHERE visibility IS NULL",
  );
}
