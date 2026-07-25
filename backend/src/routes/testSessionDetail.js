import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/:id", (req, res) => {
  const session = db
    .prepare(
      `SELECT ts.*, t.code as test_code, t.name as test_name
       FROM test_sessions ts JOIN tests t ON t.id = ts.test_id
       WHERE ts.id = ?`
    )
    .get(req.params.id);
  if (!session) return res.status(404).json({ error: "Sessão não encontrada" });

  const scores = db
    .prepare(
      `SELECT trs.raw_score, s.code, s.name, s.unit, nt.mean, nt.sd, nt.source_citation
       FROM test_raw_scores trs
       JOIN subtests s ON s.id = trs.subtest_id
       LEFT JOIN normative_tables nt ON nt.id = trs.normative_table_id
       WHERE trs.session_id = ?
       ORDER BY s.display_order`
    )
    .all(req.params.id);

  const composites = db
    .prepare(
      `SELECT tcs.*, ci.code, ci.name
       FROM test_composite_scores tcs
       JOIN composite_indices ci ON ci.id = tcs.composite_id
       WHERE tcs.session_id = ?
       ORDER BY ci.display_order`
    )
    .all(req.params.id);

  res.json({ ...session, scores, composites });
});

export default router;
