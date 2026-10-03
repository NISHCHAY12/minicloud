import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export function createToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: Math.floor(config.jwtExpirationMs / 1000),
  });
}

export function readToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function tokenFromRequest(req) {
  const header = req.get("authorization");

  if (header?.startsWith("Bearer ")) return header.slice(7);

  if (req.path.endsWith("/stream")) {
    return req.cookies?.MINICLOUD_TOKEN || req.query?.token;
  }

  return req.cookies?.MINICLOUD_TOKEN;
}

export function authenticate(req, res, next) {
  try {
    const token = tokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    req.user = readToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function setAuthCookie(res, token) {
  res.cookie("MINICLOUD_TOKEN", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: config.jwtExpirationMs,
    path: "/",
  });
}

export const hashPassword = (password) => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) =>
  bcrypt.compare(password, hash);
