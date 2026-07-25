import { Router } from "express";
import db from "../db.js";
import { hashPassword } from "../crypto.js";
import { ALLOWED_ROLES } from "./auth.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/", (req, res) => {
  const users = db
    .prepare("SELECT id, name, email, role, crp, clinic_name, created_at FROM users ORDER BY name")
    .all();
  res.json(users);
});

router.get("/:id", (req, res) => {
  const user = db
    .prepare("SELECT id, name, email, role, crp, clinic_name, created_at FROM users WHERE id = ?")
    .get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  res.json(user);
});

router.post("/", (req, res) => {
  const { name, email, password, role, crp, clinic_name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido" });
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres" });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `Perfil inválido. Use: ${ALLOWED_ROLES.join(", ")}` });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "E-mail já cadastrado" });

  const password_hash = hashPassword(password);
  const result = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, crp, clinic_name) VALUES (@name, @email, @password_hash, @role, @crp, @clinic_name)"
    )
    .run({ name, email, password_hash, role, crp: crp || null, clinic_name: clinic_name || null });

  const user = db
    .prepare("SELECT id, name, email, role, crp, clinic_name, created_at FROM users WHERE id = ?")
    .get(result.lastInsertRowid);
  res.status(201).json(user);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado" });

  const name = req.body.name ?? existing.name;
  const email = req.body.email ?? existing.email;
  const role = req.body.role ?? existing.role;
  const crp = req.body.crp ?? existing.crp;
  const clinic_name = req.body.clinic_name ?? existing.clinic_name;

  if (!name.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido" });
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `Perfil inválido. Use: ${ALLOWED_ROLES.join(", ")}` });
  }
  if (role !== "administrador" && existing.role === "administrador") {
    const { count } = db
      .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'administrador'")
      .get();
    if (count <= 1) {
      return res.status(400).json({ error: "Não é possível remover o último administrador do sistema" });
    }
  }

  const emailOwner = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, req.params.id);
  if (emailOwner) return res.status(409).json({ error: "E-mail já cadastrado para outro usuário" });

  const password_hash = req.body.password && req.body.password.length >= 8
    ? hashPassword(req.body.password)
    : existing.password_hash;

  db.prepare(
    `UPDATE users SET name = @name, email = @email, role = @role, password_hash = @password_hash,
     crp = @crp, clinic_name = @clinic_name WHERE id = @id`
  ).run({ name, email, role, password_hash, crp: crp || null, clinic_name: clinic_name || null, id: req.params.id });

  const user = db
    .prepare("SELECT id, name, email, role, crp, clinic_name, created_at FROM users WHERE id = ?")
    .get(req.params.id);
  res.json(user);
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado" });

  if (existing.role === "administrador") {
    const { count } = db
      .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'administrador'")
      .get();
    if (count <= 1) {
      return res.status(400).json({ error: "Não é possível excluir o último administrador do sistema" });
    }
  }

  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: "Você não pode excluir a própria conta" });
  }

  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.params.id);
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
