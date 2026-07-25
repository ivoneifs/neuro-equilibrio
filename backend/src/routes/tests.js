import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT id, code, name, description FROM tests ORDER BY name").all());
});

router.get("/:code", (req, res) => {
  const test = db.prepare("SELECT * FROM tests WHERE code = ?").get(req.params.code);
  if (!test) return res.status(404).json({ error: "Teste não encontrado" });

  const subtests = db
    .prepare("SELECT * FROM subtests WHERE test_id = ? ORDER BY display_order, id")
    .all(test.id);
  const composites = db
    .prepare("SELECT * FROM composite_indices WHERE test_id = ? ORDER BY display_order, id")
    .all(test.id);
  res.json({ ...test, subtests, composites });
});

router.get("/:code/normative-tables", (req, res) => {
  const test = db.prepare("SELECT * FROM tests WHERE code = ?").get(req.params.code);
  if (!test) return res.status(404).json({ error: "Teste não encontrado" });

  const rows = db
    .prepare(
      `SELECT nt.*, s.code as subtest_code, s.name as subtest_name
       FROM normative_tables nt
       JOIN subtests s ON s.id = nt.subtest_id
       WHERE s.test_id = ?
       ORDER BY s.display_order, nt.age_min_years`
    )
    .all(test.id);
  res.json(rows);
});

// RF13: cadastro/atualização de tabela normativa por subteste e faixa etária.
router.post("/:code/normative-tables", (req, res) => {
  const test = db.prepare("SELECT * FROM tests WHERE code = ?").get(req.params.code);
  if (!test) return res.status(404).json({ error: "Teste não encontrado" });

  const { subtest_code, age_min_years, age_max_years, education, sex, mean, sd, source_citation, version } = req.body;
  const subtest = db
    .prepare("SELECT * FROM subtests WHERE test_id = ? AND code = ?")
    .get(test.id, subtest_code);
  if (!subtest) return res.status(400).json({ error: "Subteste inválido" });

  if (age_min_years == null || age_max_years == null || mean == null || sd == null) {
    return res.status(400).json({ error: "age_min_years, age_max_years, mean e sd são obrigatórios" });
  }

  const result = db
    .prepare(
      `INSERT INTO normative_tables
        (subtest_id, age_min_years, age_max_years, education, sex, mean, sd, source_citation, version)
       VALUES (@subtest_id, @age_min_years, @age_max_years, @education, @sex, @mean, @sd, @source_citation, @version)`
    )
    .run({
      subtest_id: subtest.id,
      age_min_years,
      age_max_years,
      education: education ?? null,
      sex: sex ?? null,
      mean,
      sd,
      source_citation: source_citation ?? null,
      version: version ?? "1.0",
    });

  res.status(201).json({ id: result.lastInsertRowid });
});

router.delete("/normative-tables/:id", (req, res) => {
  const existing = db.prepare("SELECT id FROM normative_tables WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Tabela normativa não encontrada" });
  db.prepare("DELETE FROM normative_tables WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.get("/:code/composite-conversion-tables", (req, res) => {
  const test = db.prepare("SELECT * FROM tests WHERE code = ?").get(req.params.code);
  if (!test) return res.status(404).json({ error: "Teste não encontrado" });

  const rows = db
    .prepare(
      `SELECT cct.*, ci.code as composite_code, ci.name as composite_name
       FROM composite_conversion_tables cct
       JOIN composite_indices ci ON ci.id = cct.composite_id
       WHERE ci.test_id = ?
       ORDER BY ci.display_order, cct.sum_scaled_score`
    )
    .all(test.id);
  res.json(rows);
});

// Tabela oficial soma-de-ponderados -> composto (ex.: manual do WISC-IV, RF13).
router.post("/:code/composite-conversion-tables", (req, res) => {
  const test = db.prepare("SELECT * FROM tests WHERE code = ?").get(req.params.code);
  if (!test) return res.status(404).json({ error: "Teste não encontrado" });

  const { composite_code, sum_scaled_score, composite_score, percentile, ci_lower_95, ci_upper_95, version } = req.body;
  const composite = db
    .prepare("SELECT * FROM composite_indices WHERE test_id = ? AND code = ?")
    .get(test.id, composite_code);
  if (!composite) return res.status(400).json({ error: "Índice composto inválido" });

  if (sum_scaled_score == null || composite_score == null) {
    return res.status(400).json({ error: "sum_scaled_score e composite_score são obrigatórios" });
  }

  const result = db
    .prepare(
      `INSERT INTO composite_conversion_tables
        (composite_id, sum_scaled_score, composite_score, percentile, ci_lower_95, ci_upper_95, version)
       VALUES (@composite_id, @sum_scaled_score, @composite_score, @percentile, @ci_lower_95, @ci_upper_95, @version)`
    )
    .run({
      composite_id: composite.id,
      sum_scaled_score,
      composite_score,
      percentile: percentile ?? null,
      ci_lower_95: ci_lower_95 ?? null,
      ci_upper_95: ci_upper_95 ?? null,
      version: version ?? "1.0",
    });

  res.status(201).json({ id: result.lastInsertRowid });
});

router.delete("/composite-conversion-tables/:id", (req, res) => {
  const existing = db.prepare("SELECT id FROM composite_conversion_tables WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Registro não encontrado" });
  db.prepare("DELETE FROM composite_conversion_tables WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
