import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { api } from "./api";

export function ReportPage() {
  const { patientId } = useParams();
  const { token } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({
    title: "",
    demand_description: "",
    interpretive_text: "",
    conclusion: "",
    referral_suggestions: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listTestSessions(patientId, token).then(setSessions);
    api.listReports(patientId, token).then(setReports);
  }, [patientId]);

  function toggleSession(id) {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleDraft() {
    if (selectedSessionIds.length === 0) return;
    const { interpretiveText } = await api.draftReportText(patientId, selectedSessionIds, token);
    setForm({ ...form, interpretive_text: interpretiveText });
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (selectedSessionIds.length === 0) {
      setError("Selecione ao menos uma sessão de teste");
      return;
    }
    setBusy(true);
    try {
      const { id } = await api.createReport(
        patientId,
        { ...form, test_session_ids: selectedSessionIds },
        token
      );
      setReports(await api.listReports(patientId, token));
      await handleDownload(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(reportId) {
    const blob = await api.fetchReportPdfBlob(patientId, reportId, token);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  return (
    <div className="page">
      <p><Link to={`/patients/${patientId}/apply-test`}>← Voltar</Link></p>
      <h2>Gerar laudo</h2>

      <div className="card">
        <h3>1. Selecione as sessões de teste a incluir</h3>
        {sessions.length === 0 ? (
          <p>Nenhum teste aplicado para este paciente ainda.</p>
        ) : (
          <table>
            <thead><tr><th></th><th>Teste</th><th>Data</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedSessionIds.includes(s.id)}
                      onChange={() => toggleSession(s.id)}
                    />
                  </td>
                  <td>{s.test_name}</td>
                  <td>{s.application_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form className="card" onSubmit={handleCreate}>
        <h3>2. Conteúdo do laudo</h3>
        <label>
          Título
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          Descrição da demanda
          <textarea rows={2} value={form.demand_description}
            onChange={(e) => setForm({ ...form, demand_description: e.target.value })} />
        </label>
        <label>
          Texto interpretativo
          <div className="actions">
            <button type="button" onClick={handleDraft} disabled={selectedSessionIds.length === 0}>
              Gerar rascunho a partir dos escores
            </button>
          </div>
          <textarea rows={8} value={form.interpretive_text}
            onChange={(e) => setForm({ ...form, interpretive_text: e.target.value })} />
        </label>
        <label>
          Conclusão
          <textarea rows={3} value={form.conclusion}
            onChange={(e) => setForm({ ...form, conclusion: e.target.value })} />
        </label>
        <label>
          Sugestões de encaminhamento
          <textarea rows={2} value={form.referral_suggestions}
            onChange={(e) => setForm({ ...form, referral_suggestions: e.target.value })} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Gerando..." : "Salvar e gerar PDF"}
        </button>
      </form>

      <div className="card">
        <h3>Laudos anteriores</h3>
        {reports.length === 0 ? <p>Nenhum laudo gerado ainda.</p> : (
          <table>
            <thead><tr><th>Título</th><th>Data</th><th></th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  <td><button type="button" onClick={() => handleDownload(r.id)}>Baixar PDF</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
