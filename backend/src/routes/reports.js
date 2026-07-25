import { Router } from "express";
import db from "../db.js";
import { calculateAge } from "../age.js";
import { formatAgeMonths } from "../correction/stats.js";
import { buildReportPdf } from "../reports/pdf.js";
import { buildDraftInterpretiveText } from "../reports/draftText.js";

const router = Router({ mergeParams: true });

// Lê os resultados já calculados e persistidos em test_raw_scores no momento da aplicação do
// teste (RF19) — evita duplicar aqui a lógica de correção (z_score vs cutoff) do motor.
function loadSessionData(sessionId) {
  const session = db
    .prepare(
      `SELECT ts.*, t.code as test_code, t.name as test_name
       FROM test_sessions ts JOIN tests t ON t.id = ts.test_id
       WHERE ts.id = ?`
    )
    .get(sessionId);
  if (!session) return null;

  const scores = db
    .prepare(
      `SELECT trs.raw_score, trs.z, trs.percentile, trs.classification, trs.normative_table_id,
              trs.age_equivalent_months, trs.age_equivalent_is_floor, s.name
       FROM test_raw_scores trs
       JOIN subtests s ON s.id = trs.subtest_id
       WHERE trs.session_id = ?
       ORDER BY s.display_order`
    )
    .all(sessionId)
    .map((row) => ({
      name: row.name,
      raw_score: row.raw_score,
      z: row.z,
      percentile: row.percentile,
      classification: row.classification,
      missing_norms: row.classification == null,
      age_equivalent: formatAgeMonths(row.age_equivalent_months, !!row.age_equivalent_is_floor),
    }));

  const composites = db
    .prepare(
      `SELECT tcs.*, ci.name
       FROM test_composite_scores tcs
       JOIN composite_indices ci ON ci.id = tcs.composite_id
       WHERE tcs.session_id = ?
       ORDER BY ci.display_order`
    )
    .all(sessionId)
    .map((row) => ({
      ...row,
      age_equivalent: formatAgeMonths(row.age_equivalent_months, !!row.age_equivalent_is_floor),
    }));

  return { ...session, scores, composites };
}

router.get("/draft", (req, res) => {
  const sessionIds = String(req.query.session_ids || "").split(",").filter(Boolean);
  if (sessionIds.length === 0) return res.status(400).json({ error: "session_ids é obrigatório" });

  const sessions = sessionIds.map(loadSessionData).filter(Boolean);
  res.json({ interpretiveText: buildDraftInterpretiveText(sessions) });
});

router.get("/", (req, res) => {
  const reports = db
    .prepare("SELECT id, title, created_at FROM reports WHERE patient_id = ? ORDER BY created_at DESC")
    .all(req.params.patientId);
  res.json(reports);
});

router.post("/", (req, res) => {
  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.patientId);
  if (!patient) return res.status(404).json({ error: "Paciente não encontrado" });

  const { title, demand_description, interpretive_text, conclusion, referral_suggestions, test_session_ids } = req.body;
  if (!title) return res.status(400).json({ error: "title é obrigatório" });
  if (!Array.isArray(test_session_ids) || test_session_ids.length === 0) {
    return res.status(400).json({ error: "test_session_ids deve ser uma lista não vazia" });
  }

  const result = db
    .prepare(
      `INSERT INTO reports
        (patient_id, created_by_user_id, title, demand_description, interpretive_text, conclusion, referral_suggestions, test_session_ids)
       VALUES (@patient_id, @created_by_user_id, @title, @demand_description, @interpretive_text, @conclusion, @referral_suggestions, @test_session_ids)`
    )
    .run({
      patient_id: patient.id,
      created_by_user_id: req.user.id,
      title,
      demand_description: demand_description ?? null,
      interpretive_text: interpretive_text ?? null,
      conclusion: conclusion ?? null,
      referral_suggestions: referral_suggestions ?? null,
      test_session_ids: test_session_ids.join(","),
    });

  res.status(201).json({ id: result.lastInsertRowid });
});

router.get("/:reportId/pdf", async (req, res) => {
  const report = db
    .prepare("SELECT * FROM reports WHERE id = ? AND patient_id = ?")
    .get(req.params.reportId, req.params.patientId);
  if (!report) return res.status(404).json({ error: "Laudo não encontrado" });

  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(report.patient_id);
  const professional = db
    .prepare("SELECT name, crp, clinic_name FROM users WHERE id = ?")
    .get(report.created_by_user_id) ?? { name: req.user.name, crp: req.user.crp, clinic_name: req.user.clinic_name };

  const sessionIds = report.test_session_ids.split(",");
  const sessions = sessionIds.map(loadSessionData).filter(Boolean);
  const lastApplicationDate = sessions.reduce(
    (max, s) => (s.application_date > max ? s.application_date : max),
    sessions[0]?.application_date ?? report.created_at.slice(0, 10)
  );
  const ageAtReport = calculateAge(patient.birth_date, lastApplicationDate);

  const pdfBuffer = await buildReportPdf({ report, patient, ageAtReport, professional, sessions });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="laudo-${patient.id}-${report.id}.pdf"`);
  res.send(pdfBuffer);
});

export default router;
