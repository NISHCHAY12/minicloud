import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

await fs.mkdir(config.storagePath, { recursive: true });
const extension = (filename) => {
  const ext = path.extname(filename || "").toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : "";
};
export function storedName(filename) {
  return `${crypto.randomUUID()}${extension(filename)}`;
}
export function storagePath(name) {
  return path.join(config.storagePath, path.basename(name));
}
export async function removeStored(name) {
  await fs.rm(storagePath(name), { force: true });
}
export function readable(name, start, end) {
  return fsSync.createReadStream(storagePath(name), { start, end });
}
