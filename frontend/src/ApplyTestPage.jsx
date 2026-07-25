import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { api } from "./api";

export function ApplyTestPage() {
  const { patientId } = useParams();
  const { token } = useAuth();
  const [tests, setTests] = useState([]);
  const [testCode, setTestCode] = useState("");
  const [test, setTest] = useState(null);
  const [applicationDate, setApplicationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rawScores, setRawScores] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    api.listTests(token).then(setTests);
    api.listTestSessions(patientId, token).then(setSessions);
  }, [patientId]);

  useEffect(() => {
    if (!testCode) {
      setTest(null);
      return;
    }
    setRawScores({});
    setResult(null);
    api.getTest(testCode, token).then(setTest);
  }, [testCode]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    try {
      const numericScores = Object.fromEntries(
        Object.entries(rawScores).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])
      );
      const res = await api.applyTestSession(
        patientId,
        { test_code: testCode, application_date: applicationDate, raw_scores: numericScores },
        token
      );
      setResult(res);
      setSessions(await api.listTestSessions(patientId, token));
    } catch (err) {
      setError(err.message);
    }
  }

  const baseSubtests = test?.subtests.filter((s) => !s.derived_from_a) ?? [];
  const derivedSubtests = test?.subtests.filter((s) => s.derived_from_a) ?? [];

  return (
    <div className="page">
      <p>
        <Link to="/">← Voltar para pacientes</Link>
        {" · "}
        <Link to={`/patients/${patientId}/report`}>Gerar laudo</Link>
      </p>
      <h2>Aplicar teste</h2>

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Teste
            <select value={testCode} onChange={(e) => setTestCode(e.target.value)} required>
              <option value="">Selecione...</option>
              {tests.map((t) => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Data de aplicação
            <input type="date" value={applicationDate} onChange={(e) => setApplicationDate(e.target.value)} required />
          </label>
        </div>

        {test && (
          <>
            <h3>Escores brutos</h3>
            <div className="form-grid">
              {baseSubtests.map((s) => (
                <label key={s.code}>
                  {s.name} {s.unit && `(${s.unit})`}
                  <input
                    type="number"
                    step="any"
                    value={rawScores[s.code] ?? ""}
                    onChange={(e) => setRawScores({ ...rawScores, [s.code]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            {derivedSubtests.length > 0 && (
              <p className="subtitle">
                Calculados automaticamente: {derivedSubtests.map((s) => s.name).join(", ")}
              </p>
            )}
            {error && <p className="error">{error}</p>}
            <button type="submit">Calcular resultado</button>
          </>
        )}
      </form>

      {result && (
        <div className="card">
          <h3>Resultado</h3>
          <p>Idade na aplicação: {result.ageAtApplication.years}a {result.ageAtApplication.months}m {result.ageAtApplication.days}d</p>
          <table>
            <thead>
              <tr>
                <th>Subteste</th><th>Bruto</th><th>Z</th><th>Ponderado</th><th>Percentil</th><th>Classificação</th><th>Idade Eq.</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.code}>
                  <td>{r.name}</td>
                  <td>{r.rawScore}</td>
                  <td>{r.z != null ? r.z.toFixed(2) : "—"}</td>
                  <td>{r.scaledScore != null ? r.scaledScore.toFixed(1) : "—"}</td>
                  <td>{r.percentile != null ? r.percentile.toFixed(1) : "—"}</td>
                  <td>{r.classification ?? (r.missingNorms ? "sem tabela normativa" : "—")}</td>
                  <td>{r.ageEquivalent ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.composites?.length > 0 && (
            <>
              <h4>Índices compostos</h4>
              <table>
                <thead>
                  <tr><th>Índice</th><th>Soma ponderados</th><th>Escore</th><th>Percentil</th><th>Idade Eq.</th><th></th></tr>
                </thead>
                <tbody>
                  {result.composites.map((c) => (
                    <tr key={c.code}>
                      <td>{c.name}</td>
                      <td>{c.sumScaledScore}</td>
                      <td>{c.compositeScore?.toFixed(1)}</td>
                      <td>{c.percentile?.toFixed(1)}</td>
                      <td>{c.ageEquivalent ?? "—"}</td>
                      <td>{c.isApproximate && "estimativa (sem tabela oficial)"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3>Histórico de aplicações</h3>
        {sessions.length === 0 ? (
          <p>Nenhum teste aplicado ainda.</p>
        ) : (
          <table>
            <thead><tr><th>Teste</th><th>Data</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}><td>{s.test_name}</td><td>{s.application_date}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
