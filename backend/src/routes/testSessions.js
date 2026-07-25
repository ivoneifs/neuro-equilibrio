import { Router } from "express";
import db from "../db.js";
import { calculateAge } from "../age.js";
import { computeTestSession } from "../correction/engine.js";
import { formatAgeMonths } from "../correction/stats.js";

const router = Router({ mergeParams: true });

// RF03: idade recalculada na data da aplicação do teste, não a idade atual.
router.post("/", (req, res) => {
  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.patientId);
  if (!patient) return res.status(404).json({ error: "Paciente não encontrado" });

  const { test_code, application_date, raw_scores } = req.body;
  const test = db.prepare("SELECT * FROM tests WHERE code = ?").get(test_code);
  if (!test) return res.status(400).json({ error: "Teste inválido" });
  if (!application_date) return res.status(400).json({ error: "application_date é obrigatório" });
  if (!raw_scores || typeof raw_scores !== "object") {
    return res.status(400).json({ error: "raw_scores é obrigatório" });
  }

  const age = calculateAge(patient.birth_date, application_date);
  const ageYears = age.years + age.months / 12;

  const { sessionId, results, composites } = computeTestSession({
    testId: test.id,
    patientId: patient.id,
    applicationDate: application_date,
    ageYears,
    education: patient.education,
    sex: patient.sex,
    rawInputs: raw_scores,
    appliedByUserId: req.user.id,
  });

  const formattedResults = results.map((r) => ({
    ...r,
    ageEquivalent: formatAgeMonths(r.ageEquivalentMonths, r.ageEquivalentIsFloor),
  }));
  const formattedComposites = composites.map((c) => ({
    ...c,
    ageEquivalent: formatAgeMonths(c.ageEquivalentMonths, c.ageEquivalentIsFloor),
  }));

  res.status(201).json({ sessionId, ageAtApplication: age, results: formattedResults, composites: formattedComposites });
});

router.get("/", (req, res) => {
  const sessions = db
    .prepare(
      `SELECT ts.*, t.code as test_code, t.name as test_name
       FROM test_sessions ts JOIN tests t ON t.id = ts.test_id
       WHERE ts.patient_id = ? ORDER BY ts.application_date DESC`
    )
    .all(req.params.patientId);
  res.json(sessions);
});

export default router;
