import db from "./db.js";

// RF18: cadastro do teste como "plugin" — dados de referência, sem tabelas normativas
// (essas devem ser inseridas pelo profissional a partir do manual oficial licenciado, RF13).
function seedTest(code, name, description, subtestDefs) {
  const existing = db.prepare("SELECT id FROM tests WHERE code = ?").get(code);
  const testId = existing
    ? existing.id
    : db.prepare("INSERT INTO tests (code, name, description) VALUES (?, ?, ?)").run(code, name, description)
        .lastInsertRowid;

  subtestDefs.forEach((st, index) => {
    const already = db
      .prepare("SELECT id FROM subtests WHERE test_id = ? AND code = ?")
      .get(testId, st.code);
    if (already) return;
    db.prepare(
      `INSERT INTO subtests
        (test_id, code, name, unit, direction, scale_mean, scale_sd, derived_from_a, derived_from_b, display_order)
       VALUES (@test_id, @code, @name, @unit, @direction, @scale_mean, @scale_sd, @derived_from_a, @derived_from_b, @display_order)`
    ).run({
      test_id: testId,
      code: st.code,
      name: st.name,
      unit: st.unit,
      direction: st.direction,
      scale_mean: st.scale_mean ?? 10,
      scale_sd: st.scale_sd ?? 3,
      derived_from_a: st.derivedFromA ?? null,
      derived_from_b: st.derivedFromB ?? null,
      display_order: index,
    });
  });
}

function seedComposites(testCode, compositeDefs) {
  const test = db.prepare("SELECT id FROM tests WHERE code = ?").get(testCode);
  if (!test) return;

  compositeDefs.forEach((c, index) => {
    const already = db
      .prepare("SELECT id FROM composite_indices WHERE test_id = ? AND code = ?")
      .get(test.id, c.code);
    if (already) return;
    db.prepare(
      `INSERT INTO composite_indices (test_id, code, name, subtest_codes, scale_mean, scale_sd, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(test.id, c.code, c.name, c.subtestCodes.join(","), c.scaleMean ?? 100, c.scaleSd ?? 15, index);
  });
}

seedTest(
  "FDT",
  "Teste dos Cinco Dígitos (FDT)",
  "Avalia velocidade de processamento, funções executivas e funcionamento atencional (Sedó, Paula e Malloy-Diniz, 2015).",
  [
    { code: "tempo_leitura", name: "Tempo — Leitura", unit: "segundos", direction: "lower_better" },
    { code: "tempo_contagem", name: "Tempo — Contagem", unit: "segundos", direction: "lower_better" },
    { code: "tempo_escolha", name: "Tempo — Escolha", unit: "segundos", direction: "lower_better" },
    { code: "tempo_alternancia", name: "Tempo — Alternância", unit: "segundos", direction: "lower_better" },
    {
      code: "tempo_inibicao",
      name: "Tempo — Inibição",
      unit: "segundos",
      direction: "lower_better",
      derivedFromA: "tempo_escolha",
      derivedFromB: "tempo_leitura",
    },
    {
      code: "tempo_flexibilidade",
      name: "Tempo — Flexibilidade",
      unit: "segundos",
      direction: "lower_better",
      derivedFromA: "tempo_alternancia",
      derivedFromB: "tempo_leitura",
    },
    { code: "erros_leitura", name: "Erros — Leitura", unit: "erros", direction: "lower_better" },
    { code: "erros_contagem", name: "Erros — Contagem", unit: "erros", direction: "lower_better" },
    { code: "erros_escolha", name: "Erros — Escolha", unit: "erros", direction: "lower_better" },
    { code: "erros_alternancia", name: "Erros — Alternância", unit: "erros", direction: "lower_better" },
  ]
);

seedTest(
  "WISC-IV",
  "Escala Wechsler de Inteligência para Crianças — 4ª Edição (WISC-IV)",
  "Avalia a capacidade cognitiva global de crianças e adolescentes (Wechsler, 2013). Requer kit e normas licenciadas da editora (Pearson).",
  [
    { code: "semelhancas", name: "Semelhanças (SM)", unit: "pontos", direction: "higher_better" },
    { code: "vocabulario", name: "Vocabulário (VC)", unit: "pontos", direction: "higher_better" },
    { code: "compreensao", name: "Compreensão (CO)", unit: "pontos", direction: "higher_better" },
    { code: "cubos", name: "Cubos (CB)", unit: "pontos", direction: "higher_better" },
    { code: "conceitos_figurativos", name: "Conceitos Figurativos (CN)", unit: "pontos", direction: "higher_better" },
    { code: "raciocinio_matricial", name: "Raciocínio Matricial (RM)", unit: "pontos", direction: "higher_better" },
    { code: "digitos", name: "Dígitos (DG)", unit: "pontos", direction: "higher_better" },
    { code: "codigo", name: "Código (CD)", unit: "pontos", direction: "higher_better" },
    { code: "seq_numeros_letras", name: "Sequência de Números e Letras (SNL)", unit: "pontos", direction: "higher_better" },
    { code: "procurar_simbolos", name: "Procurar Símbolos (PS)", unit: "pontos", direction: "higher_better" },
  ]
);

// Índices compostos: soma dos escores ponderados (mean 10/sd 3) dos subtestes membros,
// convertida por tabela oficial do manual (mean 100/sd 15). Ver RF12/RF13.
seedComposites("WISC-IV", [
  { code: "icv", name: "Compreensão Verbal (ICV)", subtestCodes: ["semelhancas", "vocabulario", "compreensao"] },
  { code: "iop", name: "Organização Perceptual (IOP)", subtestCodes: ["cubos", "conceitos_figurativos", "raciocinio_matricial"] },
  { code: "imo", name: "Memória Operacional (IMO)", subtestCodes: ["digitos", "seq_numeros_letras"] },
  { code: "ivp", name: "Velocidade de Processamento (IVP)", subtestCodes: ["codigo", "procurar_simbolos"] },
  {
    code: "qi_total",
    name: "Q.I. Total",
    subtestCodes: [
      "semelhancas", "vocabulario", "compreensao", "cubos", "conceitos_figurativos",
      "raciocinio_matricial", "digitos", "seq_numeros_letras", "codigo", "procurar_simbolos",
    ],
  },
]);
