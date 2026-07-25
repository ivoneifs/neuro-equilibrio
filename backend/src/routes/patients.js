import { Router } from "express";
import db from "../db.js";
import { calculateAge } from "../age.js";
import { validatePatientInput } from "../validation.js";

const router = Router();

const FIELDS = [
  "full_name", "cpf", "birth_date", "sex", "education",
  "father_name", "mother_name", "address", "phone", "email", "legal_guardian",
];

function withAge(patient) {
  return { ...patient, age: calculateAge(patient.birth_date) };
}

// RF01/RF06: lista pacientes ativos por padrão; ?archived=1 lista arquivados.
router.get("/", (req, res) => {
  const archived = req.query.archived === "1" ? 1 : 0;
  const patients = db
    .prepare("SELECT * FROM patients WHERE archived = ? ORDER BY full_name")
    .all(archived);
  res.json(patients.map(withAge));
});

router.get("/:id", (req, res) => {
  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id);
  if (!patient) return res.status(404).json({ error: "Paciente não encontrado" });
  res.json(withAge(patient));
});

router.post("/", (req, res) => {
  const errors = validatePatientInput(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const values = Object.fromEntries(FIELDS.map((f) => [f, req.body[f] ?? null]));
  const columns = FIELDS.join(", ");
  const placeholders = FIELDS.map((f) => `@${f}`).join(", ");

  const result = db
    .prepare(`INSERT INTO patients (${columns}) VALUES (${placeholders})`)
    .run(values);

  db.prepare(
    "INSERT INTO patient_audit_log (patient_id, action, details) VALUES (?, 'created', ?)"
  ).run(result.lastInsertRowid, JSON.stringify(values));

  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(withAge(patient));
});

// RF06: editar cadastro.
router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Paciente não encontrado" });

  const merged = { ...existing, ...req.body };
  const errors = validatePatientInput(merged);
  if (errors.length) return res.status(400).json({ errors });

  const values = Object.fromEntries(FIELDS.map((f) => [f, merged[f] ?? null]));
  const setClause = FIELDS.map((f) => `${f} = @${f}`).join(", ");

  db.prepare(
    `UPDATE patients SET ${setClause}, updated_at = datetime('now') WHERE id = @id`
  ).run({ ...values, id: req.params.id });

  db.prepare(
    "INSERT INTO patient_audit_log (patient_id, action, details) VALUES (?, 'updated', ?)"
  ).run(req.params.id, JSON.stringify(values));

  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id);
  res.json(withAge(patient));
});

// RF06: arquivar (nunca excluir definitivamente), mantendo trilha de auditoria.
router.post("/:id/archive", (req, res) => {
  const existing = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Paciente não encontrado" });

  db.prepare(
    "UPDATE patients SET archived = 1, updated_at = datetime('now') WHERE id = ?"
  ).run(req.params.id);

  db.prepare(
    "INSERT INTO patient_audit_log (patient_id, action, details) VALUES (?, 'archived', NULL)"
  ).run(req.params.id);

  res.json({ ok: true });
});

router.post("/:id/unarchive", (req, res) => {
  const existing = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Paciente não encontrado" });

  db.prepare(
    "UPDATE patients SET archived = 0, updated_at = datetime('now') WHERE id = ?"
  ).run(req.params.id);

  db.prepare(
    "INSERT INTO patient_audit_log (patient_id, action, details) VALUES (?, 'unarchived', NULL)"
  ).run(req.params.id);

  res.json({ ok: true });
});

export default router;
