import PDFDocument from "pdfkit";

const CLASSIFICATION_NOTE =
  "Este laudo foi gerado com apoio de sistema informatizado de correção e organização de escores. " +
  "A interpretação e a responsabilidade clínica são exclusivamente do(a) psicólogo(a) responsável.";

function formatAge(age) {
  return `${age.years}a ${age.months}m ${age.days}d`;
}

function h(doc, text) {
  doc.moveDown(0.5).fontSize(12).font("Helvetica-Bold").text(text.toUpperCase());
  doc.font("Helvetica").fontSize(10);
}

// RF23/RF24: monta o PDF do laudo a partir do paciente, do profissional (cabeçalho) e das
// sessões de teste selecionadas, incluindo o texto interpretativo editado pelo profissional.
export function buildReportPdf({ report, patient, ageAtReport, professional, sessions }) {
  const doc = new PDFDocument({ margin: 50, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(14).font("Helvetica-Bold").text("Laudo Psicológico de Avaliação Neuropsicológica", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(8).font("Helvetica").fillColor("gray").text(
    "Elaborado conforme Resoluções CFP nº 06/2019, 01/2009 e 09/2018.",
    { align: "center" }
  );
  doc.fillColor("black");

  h(doc, "Identificação");
  doc.text(`Paciente: ${patient.full_name}`);
  doc.text(`Data de nascimento: ${patient.birth_date}    Idade na avaliação: ${formatAge(ageAtReport)}`);
  if (patient.education) doc.text(`Escolaridade: ${patient.education}`);
  if (patient.father_name || patient.mother_name) {
    doc.text(`Filiação: ${[patient.mother_name, patient.father_name].filter(Boolean).join(" / ")}`);
  }
  doc.text(`Psicólogo(a) responsável: ${professional.name}${professional.crp ? ` — CRP ${professional.crp}` : ""}`);
  if (professional.clinic_name) doc.text(`Clínica: ${professional.clinic_name}`);
  doc.text(`Laudo gerado em: ${new Date(report.created_at).toLocaleDateString("pt-BR")}`);

  if (report.demand_description) {
    h(doc, "Descrição da Demanda");
    doc.text(report.demand_description);
  }

  h(doc, "Testes Utilizados");
  for (const s of sessions) {
    doc.text(`• ${s.test_name} — aplicado em ${s.application_date}`);
  }

  h(doc, "Análise dos Resultados");
  for (const s of sessions) {
    doc.font("Helvetica-Bold").text(s.test_name);
    doc.font("Helvetica");

    const colX = [55, 250, 300, 370, 440, 500];
    doc.fontSize(9).text("Subteste", colX[0], doc.y, { continued: false });
    let headerY = doc.y - doc.currentLineHeight();
    doc.text("Bruto", colX[1], headerY);
    doc.text("Z", colX[2], headerY);
    doc.text("Percentil", colX[3], headerY);
    doc.text("Classificação", colX[4], headerY);

    for (const score of s.scores) {
      const rowY = doc.y;
      doc.text(score.name, colX[0], rowY, { width: colX[1] - colX[0] - 5 });
      const afterY = doc.y;
      doc.text(String(score.raw_score), colX[1], rowY);
      doc.text(score.z != null ? score.z.toFixed(2) : "—", colX[2], rowY);
      doc.text(score.percentile != null ? score.percentile.toFixed(1) : "—", colX[3], rowY);
      doc.text(score.classification ?? (score.missing_norms ? "sem norma" : "—"), colX[4], rowY, { width: 100 });
      doc.y = Math.max(doc.y, afterY);
    }

    if (s.composites?.length) {
      doc.moveDown(0.3).font("Helvetica-Bold").fontSize(9).text("Índices compostos:");
      doc.font("Helvetica");
      for (const c of s.composites) {
        doc.text(
          `${c.name}: ${c.composite_score?.toFixed(1) ?? "—"}` +
            (c.percentile != null ? ` (percentil ${c.percentile.toFixed(1)})` : "") +
            (c.is_approximate ? " [estimativa — sem tabela oficial]" : "")
        );
      }
    }
    doc.moveDown(0.6).fontSize(10);
  }

  if (report.interpretive_text) {
    h(doc, "Interpretação");
    doc.text(report.interpretive_text, { align: "justify" });
  }

  if (report.conclusion) {
    h(doc, "Conclusão");
    doc.text(report.conclusion, { align: "justify" });
  }

  if (report.referral_suggestions) {
    h(doc, "Sugestões de Encaminhamento");
    doc.text(report.referral_suggestions, { align: "justify" });
  }

  doc.moveDown(2);
  doc.fontSize(9).fillColor("gray").text(CLASSIFICATION_NOTE, { align: "center" });
  doc.moveDown(3);
  doc.fillColor("black").fontSize(10).text("_______________________________________", { align: "center" });
  doc.text(`${professional.name}${professional.crp ? ` — CRP ${professional.crp}` : ""}`, { align: "center" });

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fontSize(8).fillColor("gray").text(`Página ${i + 1} de ${range.count}`, 50, doc.page.height - 40, {
      align: "center",
      width: doc.page.width - 100,
    });
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
