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
        (test_id, code, name, unit, direction, scale_mean, scale_sd, derived_from_a, derived_from_b, scoring_method, display_order)
       VALUES (@test_id, @code, @name, @unit, @direction, @scale_mean, @scale_sd, @derived_from_a, @derived_from_b, @scoring_method, @display_order)`
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
      scoring_method: st.scoringMethod ?? "z_score",
      display_order: index,
    });
  });

  return testId;
}

function seedScoreBands(testCode, subtestCode, bands) {
  const test = db.prepare("SELECT id FROM tests WHERE code = ?").get(testCode);
  if (!test) return;
  const subtest = db.prepare("SELECT id FROM subtests WHERE test_id = ? AND code = ?").get(test.id, subtestCode);
  if (!subtest) return;

  const already = db.prepare("SELECT id FROM score_bands WHERE subtest_id = ? LIMIT 1").get(subtest.id);
  if (already) return;

  for (const b of bands) {
    db.prepare(
      `INSERT INTO score_bands (subtest_id, min_raw, max_raw, education, label, source_citation)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(subtest.id, b.minRaw, b.maxRaw, b.education ?? null, b.label, b.sourceCitation ?? null);
  }
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
    // Subtestes suplementares: não entram na soma dos índices/QI Total, apenas informativos.
    { code: "completar_figuras", name: "Completar Figuras (CF)", unit: "pontos", direction: "higher_better" },
    { code: "cancelamento", name: "Cancelamento (CA)", unit: "pontos", direction: "higher_better" },
    { code: "informacao", name: "Informação (IN)", unit: "pontos", direction: "higher_better" },
    { code: "aritmetica", name: "Aritmética (AR)", unit: "pontos", direction: "higher_better" },
    { code: "raciocinio_palavras", name: "Raciocínio com Palavras (RP)", unit: "pontos", direction: "higher_better" },
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

// Instrumentos de humor/rastreio com faixas de corte fixas (scoring_method 'cutoff'),
// em vez de conversão estatística por média/DP. Faixas abaixo são as usualmente citadas
// na literatura/manual de cada instrumento — devem ser confirmadas pelo profissional
// responsável antes de uso clínico (RF13, Seção 7.1/7.9 do projeto).
seedTest(
  "BDI-II",
  "Inventário de Depressão de Beck (BDI-II)",
  "Escala de autorrelato de 21 itens para sintomas depressivos (Beck, Steer e Brown, 1996).",
  [{ code: "escore_total", name: "Escore Total", unit: "pontos", direction: "higher_better", scoringMethod: "cutoff" }]
);
seedScoreBands("BDI-II", "escore_total", [
  { minRaw: 0, maxRaw: 13, label: "Mínimo", sourceCitation: "Beck, Steer & Brown (1996)" },
  { minRaw: 14, maxRaw: 19, label: "Leve", sourceCitation: "Beck, Steer & Brown (1996)" },
  { minRaw: 20, maxRaw: 28, label: "Moderado", sourceCitation: "Beck, Steer & Brown (1996)" },
  { minRaw: 29, maxRaw: 63, label: "Grave", sourceCitation: "Beck, Steer & Brown (1996)" },
]);

seedTest(
  "BAI",
  "Inventário de Ansiedade de Beck (BAI)",
  "Escala de autorrelato de 21 itens para sintomas de ansiedade (Beck, Epstein, Brown e Steer, 1988).",
  [{ code: "escore_total", name: "Escore Total", unit: "pontos", direction: "higher_better", scoringMethod: "cutoff" }]
);
seedScoreBands("BAI", "escore_total", [
  { minRaw: 0, maxRaw: 7, label: "Mínimo", sourceCitation: "Beck, Epstein, Brown & Steer (1988)" },
  { minRaw: 8, maxRaw: 15, label: "Leve", sourceCitation: "Beck, Epstein, Brown & Steer (1988)" },
  { minRaw: 16, maxRaw: 25, label: "Moderado", sourceCitation: "Beck, Epstein, Brown & Steer (1988)" },
  { minRaw: 26, maxRaw: 63, label: "Grave", sourceCitation: "Beck, Epstein, Brown & Steer (1988)" },
]);

seedTest(
  "MEEM",
  "Mini Exame do Estado Mental (MEEM)",
  "Rastreio cognitivo breve, 0-30 pontos, ponto de corte ajustado por escolaridade (Folstein et al., 1975; adaptação brasileira: Bertolucci et al., 1994).",
  [{ code: "escore_total", name: "Escore Total", unit: "pontos", direction: "higher_better", scoringMethod: "cutoff" }]
);
seedScoreBands("MEEM", "escore_total", [
  { minRaw: 0, maxRaw: 12, education: "analfabeto", label: "Sugestivo de déficit cognitivo", sourceCitation: "Bertolucci et al. (1994) — validar com manual atual" },
  { minRaw: 13, maxRaw: 30, education: "analfabeto", label: "Dentro do esperado", sourceCitation: "Bertolucci et al. (1994) — validar com manual atual" },
  { minRaw: 0, maxRaw: 17, education: "fundamental_incompleto", label: "Sugestivo de déficit cognitivo", sourceCitation: "Bertolucci et al. (1994) — validar com manual atual" },
  { minRaw: 18, maxRaw: 30, education: "fundamental_incompleto", label: "Dentro do esperado", sourceCitation: "Bertolucci et al. (1994) — validar com manual atual" },
  { minRaw: 0, maxRaw: 25, education: "medio_superior", label: "Sugestivo de déficit cognitivo", sourceCitation: "Bertolucci et al. (1994) — validar com manual atual" },
  { minRaw: 26, maxRaw: 30, education: "medio_superior", label: "Dentro do esperado", sourceCitation: "Bertolucci et al. (1994) — validar com manual atual" },
]);

seedTest(
  "TRILHAS",
  "Teste de Trilhas (Trail Making Test — Partes A e B)",
  "Avalia atenção visual, velocidade de processamento e flexibilidade cognitiva (Reitan, 1958).",
  [
    { code: "parte_a", name: "Parte A", unit: "segundos", direction: "lower_better" },
    { code: "parte_b", name: "Parte B", unit: "segundos", direction: "lower_better" },
    {
      code: "diferenca_b_a",
      name: "Diferença B−A (custo de alternância)",
      unit: "segundos",
      direction: "lower_better",
      derivedFromA: "parte_b",
      derivedFromB: "parte_a",
    },
  ]
);

seedTest(
  "TFV",
  "Teste de Fluência Verbal (fonêmica e semântica)",
  "Avalia funções executivas e linguagem por meio da geração de palavras em 60 segundos.",
  [
    { code: "fonemica", name: "Fluência Fonêmica (palavras)", unit: "palavras", direction: "higher_better" },
    { code: "semantica", name: "Fluência Semântica (palavras)", unit: "palavras", direction: "higher_better" },
  ]
);
