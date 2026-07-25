import { Router } from "express";
import db from "../db.js";
import { hashPassword, verifyPassword, generateToken } from "../crypto.js";

const router = Router();
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ALLOWED_ROLES = ["administrador", "psicologo", "secretaria"];

router.post("/register", (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido" });
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "E-mail já cadastrado" });

  const { count } = db.prepare("SELECT COUNT(*) as count FROM users").get();
  // Primeiro usuário do sistema vira administrador automaticamente (bootstrap do painel admin).
  const finalRole = count === 0 ? "administrador" : ALLOWED_ROLES.includes(role) ? role : "psicologo";

  const password_hash = hashPassword(password);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (@name, @email, @password_hash, @role)")
    .run({ name, email, password_hash, role: finalRole });

  const user = { id: result.lastInsertRowid, name, email, role: finalRole };
  const token = createSession(user.id);
  res.status(201).json({ user, token });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "E-mail ou senha inválidos" });
  }

  const token = createSession(user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
});

router.post("/logout", (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });
  res.json({ user });
});

function createSession(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    expiresAt
  );
  return token;
}

export function getUserFromRequest(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const session = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!session || new Date(session.expires_at) < new Date()) return null;

  const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(session.user_id);
  return user || null;
}

export default router;
