// RF14: gera um texto interpretativo-base a partir dos escores, sempre editável pelo profissional
// antes da finalização do laudo. Nunca deve ser tratado como conclusão definitiva (Seção 8 do projeto).
export function buildDraftInterpretiveText(sessions) {
  const paragraphs = [];

  for (const s of sessions) {
    const sentences = [];
    for (const score of s.scores) {
      if (score.classification == null) continue;
      if (score.percentile != null) {
        sentences.push(
          `No subteste ${score.name}, o(a) paciente obteve desempenho classificado como ${score.classification} ` +
            `(percentil ${score.percentile.toFixed(1)}).`
        );
      } else {
        sentences.push(
          `No ${score.name}, o(a) paciente obteve escore bruto de ${score.raw_score}, compatível com classificação ${score.classification}.`
        );
      }
    }
    for (const c of s.composites ?? []) {
      const approx = c.is_approximate ? " (estimativa — sem tabela oficial de conversão cadastrada)" : "";
      sentences.push(
        `O índice ${c.name} resultou em escore composto ${c.composite_score?.toFixed(1) ?? "—"}${approx}.`
      );
    }
    if (sentences.length > 0) {
      paragraphs.push(`${s.test_name}: ${sentences.join(" ")}`);
    }
  }

  paragraphs.push(
    "[Rascunho gerado automaticamente a partir dos escores informados — revise, complemente e edite " +
      "livremente antes de finalizar o laudo. Não representa conclusão clínica definitiva.]"
  );

  return paragraphs.join("\n\n");
}
