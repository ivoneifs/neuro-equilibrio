import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, 64);
  return candidate.length === hashBuffer.length && timingSafeEqual(candidate, hashBuffer);
}

export function generateToken() {
  return randomBytes(32).toString("hex");
}
