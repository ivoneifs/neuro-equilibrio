import db from "../db.js";
import { zScore, scaledScore, percentileFromZ, classify } from "./stats.js";

function findNormativeTable(subtestId, ageYears, { education, sex } = {}) {
  const rows = db
    .prepare(
      `SELECT * FROM normative_tables
       WHERE subtest_id = ? AND age_min_years <= ? AND age_max_years >= ?
       ORDER BY (education IS NOT NULL) + (sex IS NOT NULL) DESC`
    )
    .all(subtestId, ageYears, ageYears);

  const exact = rows.find(
    (r) => (!r.education || r.education === education) && (!r.sex || r.sex === sex)
  );
  return exact || null;
}

function findScoreBand(subtestId, rawScore, { education } = {}) {
  const rows = db
    .prepare(
      `SELECT * FROM score_bands
       WHERE subtest_id = ? AND min_raw <= ? AND max_raw >= ?
       ORDER BY (education IS NOT NULL) DESC`
    )
    .all(subtestId, rawScore, rawScore);

  return rows.find((r) => !r.education || r.education === education) || null;
}

// RF12/RF14: calcula uma sessão de aplicação de teste a partir de escores brutos manuais,
// resolvendo subtestes derivados, buscando a tabela normativa da faixa etária e convertendo
// para z-score, escore ponderado, percentil e classificação (Guilmette et al., 2020).
export function computeTestSession({ testId, patientId, applicationDate, ageYears, education, sex, rawInputs, appliedByUserId }) {
  const subtests = db
    .prepare("SELECT * FROM subtests WHERE test_id = ? ORDER BY display_order, id")
    .all(testId);

  const resolvedRaw = {};
  for (const st of subtests) {
    if (st.derived_from_a && st.derived_from_b) {
      const a = resolvedRaw[st.derived_from_a] ?? rawInputs[st.derived_from_a];
      const b = resolvedRaw[st.derived_from_b] ?? rawInputs[st.derived_from_b];
      if (a != null && b != null) resolvedRaw[st.code] = a - b;
    } else if (rawInputs[st.code] != null) {
      resolvedRaw[st.code] = rawInputs[st.code];
    }
  }

  const results = [];
  for (const st of subtests) {
    const raw = resolvedRaw[st.code];
    if (raw == null) continue;

    if (st.scoring_method === "cutoff") {
      const band = findScoreBand(st.id, raw, { education });
      results.push({
        subtestId: st.id,
        code: st.code,
        name: st.name,
        rawScore: raw,
        normativeTableId: null,
        z: null,
        scaledScore: null,
        percentile: null,
        classification: band?.label ?? null,
        missingNorms: !band,
      });
      continue;
    }

    const norm = findNormativeTable(st.id, ageYears, { education, sex });
    let z = null, scaled = null, percentile = null, classification = null;
    if (norm) {
      z = zScore(raw, norm.mean, norm.sd, st.direction);
      if (z != null) {
        scaled = scaledScore(z, st.scale_mean, st.scale_sd);
        percentile = percentileFromZ(z);
        classification = classify(z);
      }
    }

    results.push({
      subtestId: st.id,
      code: st.code,
      name: st.name,
      rawScore: raw,
      normativeTableId: norm?.id ?? null,
      z,
      scaledScore: scaled,
      percentile,
      classification,
      missingNorms: !norm,
    });
  }

  const sessionResult = db
    .prepare(
      "INSERT INTO test_sessions (patient_id, test_id, application_date, applied_by_user_id) VALUES (?, ?, ?, ?)"
    )
    .run(patientId, testId, applicationDate, appliedByUserId ?? null);
  const sessionId = sessionResult.lastInsertRowid;

  const insertScore = db.prepare(
    "INSERT INTO test_raw_scores (session_id, subtest_id, raw_score, normative_table_id) VALUES (?, ?, ?, ?)"
  );
  for (const r of results) {
    insertScore.run(sessionId, r.subtestId, r.rawScore, r.normativeTableId);
  }

  const composites = computeComposites({ testId, sessionId, results });

  return { sessionId, results, composites };
}

// Índices compostos (ex.: WISC-IV QI Total): soma dos escores ponderados dos subtestes membros.
// Usa a tabela oficial de conversão quando disponível (busca exata pela soma); na ausência dela,
// cai para uma aproximação por distribuição normal, sinalizada como estimativa (não substitui a
// tabela do manual do teste — RF13).
function computeComposites({ testId, sessionId, results }) {
  const composites = db
    .prepare("SELECT * FROM composite_indices WHERE test_id = ? ORDER BY display_order, id")
    .all(testId);
  if (composites.length === 0) return [];

  const scaledByCode = Object.fromEntries(results.map((r) => [r.code, r.scaledScore]));

  const computed = [];
  for (const comp of composites) {
    const codes = comp.subtest_codes.split(",").map((c) => c.trim());
    const scaledValues = codes.map((c) => scaledByCode[c]).filter((v) => v != null);
    if (scaledValues.length !== codes.length) continue;

    const sum = scaledValues.reduce((acc, v) => acc + v, 0);
    const officialRow = db
      .prepare(
        "SELECT * FROM composite_conversion_tables WHERE composite_id = ? AND sum_scaled_score = ?"
      )
      .get(comp.id, Math.round(sum));

    let compositeScore, percentile, ciLower, ciUpper, isApproximate;
    if (officialRow) {
      compositeScore = officialRow.composite_score;
      percentile = officialRow.percentile;
      ciLower = officialRow.ci_lower_95;
      ciUpper = officialRow.ci_upper_95;
      isApproximate = false;
    } else {
      const n = codes.length;
      const subtestScaleMean = 10, subtestScaleSd = 3;
      const z = (sum - n * subtestScaleMean) / (Math.sqrt(n) * subtestScaleSd);
      compositeScore = scaledScore(z, comp.scale_mean, comp.scale_sd);
      percentile = percentileFromZ(z);
      ciLower = null;
      ciUpper = null;
      isApproximate = true;
    }

    db.prepare(
      `INSERT INTO test_composite_scores
        (session_id, composite_id, sum_scaled_score, composite_score, percentile, ci_lower_95, ci_upper_95, is_approximate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(sessionId, comp.id, sum, compositeScore, percentile, ciLower, ciUpper, isApproximate ? 1 : 0);

    computed.push({
      code: comp.code,
      name: comp.name,
      sumScaledScore: sum,
      compositeScore,
      percentile,
      ciLower95: ciLower,
      ciUpper95: ciUpper,
      isApproximate,
    });
  }
  return computed;
}
