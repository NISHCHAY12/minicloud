import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
dotenv.config({ path: path.join(backendRoot, ".env") });

const required = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const config = {
  port: Number(process.env.PORT || 8080),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpirationMs: Number(process.env.JWT_EXPIRATION_MS || 86400000),
  storagePath: path.resolve(backendRoot, process.env.STORAGE_PATH || "storage"),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
};

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  throw new Error("PORT must be a valid TCP port");
}

if (
  !Number.isFinite(config.jwtExpirationMs) ||
  config.jwtExpirationMs < 60000
) {
  throw new Error("JWT_EXPIRATION_MS must be at least 60000 milliseconds");
}
