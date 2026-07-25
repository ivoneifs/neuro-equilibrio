import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "./api";

const emptyNorm = { subtest_code: "", age_min_years: "", age_max_years: "", education: "", sex: "", mean: "", sd: "", source_citation: "" };
const emptyComposite = { composite_code: "", sum_scaled_score: "", composite_score: "", percentile: "", ci_lower_95: "", ci_upper_95: "" };
const emptyBand = { subtest_code: "", min_raw: "", max_raw: "", education: "", label: "", source_citation: "" };
const emptyAgeEq = { subtest_code: "", min_raw: "", max_raw: "", age_years: "", age_months: "", is_floor: false, source_citation: "" };

export function AdminNormsPage() {
  const { token } = useAuth();
  const [tests, setTests] = useState([]);
  const [testCode, setTestCode] = useState("");
  const [test, setTest] = useState(null);
  const [norms, setNorms] = useState([]);
  const [composites, setComposites] = useState([]);
  const [bands, setBands] = useState([]);
  const [ageEquivalents, setAgeEquivalents] = useState([]);
  const [normForm, setNormForm] = useState(emptyNorm);
  const [compositeForm, setCompositeForm] = useState(emptyComposite);
  const [bandForm, setBandForm] = useState(emptyBand);
  const [ageEqForm, setAgeEqForm] = useState(emptyAgeEq);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listTests(token).then(setTests);
  }, []);

  async function loadTestData(code) {
    const [t, n, c, b, a] = await Promise.all([
      api.getTest(code, token),
      api.listNormativeTables(code, token),
      api.listCompositeConversionTables(code, token),
      api.listScoreBands(code, token),
      api.listAgeEquivalentTables(code, token),
    ]);
    setTest(t);
    setNorms(n);
    setComposites(c);
    setBands(b);
    setAgeEquivalents(a);
  }

  useEffect(() => {
    if (!testCode) {
      setTest(null);
      return;
    }
    setNormForm(emptyNorm);
    setCompositeForm(emptyComposite);
    setBandForm(emptyBand);
    setAgeEqForm(emptyAgeEq);
    loadTestData(testCode);
  }, [testCode]);

  async function handleAddNorm(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createNormativeTable(
        testCode,
        {
          ...normForm,
          age_min_years: Number(normForm.age_min_years),
          age_max_years: Number(normForm.age_max_years),
          mean: Number(normForm.mean),
          sd: Number(normForm.sd),
          education: normForm.education || null,
          sex: normForm.sex || null,
        },
        token
      );
      setNormForm(emptyNorm);
      await loadTestData(testCode);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteNorm(id) {
    await api.deleteNormativeTable(id, token);
    await loadTestData(testCode);
  }

  async function handleAddBand(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createScoreBand(
        testCode,
        {
          ...bandForm,
          min_raw: Number(bandForm.min_raw),
          max_raw: Number(bandForm.max_raw),
          education: bandForm.education || null,
        },
        token
      );
      setBandForm(emptyBand);
      await loadTestData(testCode);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddAgeEq(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createAgeEquivalentTable(
        testCode,
        {
          ...ageEqForm,
          min_raw: Number(ageEqForm.min_raw),
          max_raw: Number(ageEqForm.max_raw),
          age_years: Number(ageEqForm.age_years),
          age_months: Number(ageEqForm.age_months),
        },
        token
      );
      setAgeEqForm(emptyAgeEq);
      await loadTestData(testCode);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteAgeEq(id) {
    await api.deleteAgeEquivalentTable(id, token);
    await loadTestData(testCode);
  }

  async function handleDeleteBand(id) {
    await api.deleteScoreBand(id, token);
    await loadTestData(testCode);
  }

  async function handleAddComposite(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createCompositeConversionTable(
        testCode,
        {
          ...compositeForm,
          sum_scaled_score: Number(compositeForm.sum_scaled_score),
          composite_score: Number(compositeForm.composite_score),
          percentile: compositeForm.percentile ? Number(compositeForm.percentile) : null,
          ci_lower_95: compositeForm.ci_lower_95 ? Number(compositeForm.ci_lower_95) : null,
          ci_upper_95: compositeForm.ci_upper_95 ? Number(compositeForm.ci_upper_95) : null,
        },
        token
      );
      setCompositeForm(emptyComposite);
      await loadTestData(testCode);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteComposite(id) {
    await api.deleteCompositeConversionTable(id, token);
    await loadTestData(testCode);
  }

  return (
    <div className="page">
      <h2>Tabelas normativas</h2>
      <p className="subtitle">
        Cadastre aqui os valores oficiais do manual de cada teste (média/DP por faixa etária,
        tabelas de conversão de compostos). O sistema não vem com essas normas pré-carregadas —
        elas devem ser inseridas pelo profissional habilitado a partir do manual licenciado.
      </p>

      <div className="card">
        <label>
          Teste
          <select value={testCode} onChange={(e) => setTestCode(e.target.value)}>
            <option value="">Selecione...</option>
            {tests.map((t) => (
              <option key={t.code} value={t.code}>{t.name}</option>
            ))}
          </select>
        </label>
      </div>

      {test && (() => {
        const zScoreSubtests = test.subtests.filter((s) => s.scoring_method !== "cutoff");
        const cutoffSubtests = test.subtests.filter((s) => s.scoring_method === "cutoff");
        return (
        <>
          {zScoreSubtests.length > 0 && (
          <form className="card" onSubmit={handleAddNorm}>
            <h3>Nova tabela normativa (subteste)</h3>
            <div className="form-grid">
              <label>
                Subteste
                <select
                  value={normForm.subtest_code}
                  onChange={(e) => setNormForm({ ...normForm, subtest_code: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {zScoreSubtests.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Idade mín. (anos)
                <input type="number" step="any" value={normForm.age_min_years}
                  onChange={(e) => setNormForm({ ...normForm, age_min_years: e.target.value })} required />
              </label>
              <label>
                Idade máx. (anos)
                <input type="number" step="any" value={normForm.age_max_years}
                  onChange={(e) => setNormForm({ ...normForm, age_max_years: e.target.value })} required />
              </label>
              <label>
                Escolaridade (opcional)
                <input value={normForm.education} onChange={(e) => setNormForm({ ...normForm, education: e.target.value })} />
              </label>
              <label>
                Sexo (opcional)
                <select value={normForm.sex} onChange={(e) => setNormForm({ ...normForm, sex: e.target.value })}>
                  <option value="">-</option>
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                </select>
              </label>
              <label>
                Média
                <input type="number" step="any" value={normForm.mean}
                  onChange={(e) => setNormForm({ ...normForm, mean: e.target.value })} required />
              </label>
              <label>
                Desvio Padrão
                <input type="number" step="any" value={normForm.sd}
                  onChange={(e) => setNormForm({ ...normForm, sd: e.target.value })} required />
              </label>
              <label>
                Fonte/citação
                <input value={normForm.source_citation}
                  onChange={(e) => setNormForm({ ...normForm, source_citation: e.target.value })}
                  placeholder="Ex: Manual FDT, Sedó et al. 2015" />
              </label>
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit">Adicionar tabela</button>
          </form>
          )}

          {norms.length > 0 && (
          <div className="card">
            <h3>Tabelas cadastradas</h3>
            <table>
                <thead>
                  <tr><th>Subteste</th><th>Faixa etária</th><th>Média</th><th>DP</th><th>Fonte</th><th></th></tr>
                </thead>
                <tbody>
                  {norms.map((n) => (
                    <tr key={n.id}>
                      <td>{n.subtest_name}</td>
                      <td>{n.age_min_years}–{n.age_max_years} anos{n.education ? `, ${n.education}` : ""}{n.sex ? `, ${n.sex}` : ""}</td>
                      <td>{n.mean}</td>
                      <td>{n.sd}</td>
                      <td>{n.source_citation}</td>
                      <td><button type="button" onClick={() => handleDeleteNorm(n.id)}>Excluir</button></td>
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
          )}

          {zScoreSubtests.length > 0 && (
            <>
              <form className="card" onSubmit={handleAddAgeEq}>
                <h3>Nova idade equivalente (subteste)</h3>
                <div className="form-grid">
                  <label>
                    Subteste
                    <select
                      value={ageEqForm.subtest_code}
                      onChange={(e) => setAgeEqForm({ ...ageEqForm, subtest_code: e.target.value })}
                      required
                    >
                      <option value="">Selecione...</option>
                      {zScoreSubtests.map((s) => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Escore mín.
                    <input type="number" step="any" value={ageEqForm.min_raw}
                      onChange={(e) => setAgeEqForm({ ...ageEqForm, min_raw: e.target.value })} required />
                  </label>
                  <label>
                    Escore máx.
                    <input type="number" step="any" value={ageEqForm.max_raw}
                      onChange={(e) => setAgeEqForm({ ...ageEqForm, max_raw: e.target.value })} required />
                  </label>
                  <label>
                    Idade equivalente — anos
                    <input type="number" value={ageEqForm.age_years}
                      onChange={(e) => setAgeEqForm({ ...ageEqForm, age_years: e.target.value })} required />
                  </label>
                  <label>
                    Idade equivalente — meses
                    <input type="number" min="0" max="11" value={ageEqForm.age_months}
                      onChange={(e) => setAgeEqForm({ ...ageEqForm, age_months: e.target.value })} required />
                  </label>
                  <label>
                    <input type="checkbox" checked={ageEqForm.is_floor}
                      onChange={(e) => setAgeEqForm({ ...ageEqForm, is_floor: e.target.checked })} />
                    {" "}Piso da tabela (exibir como "menor que")
                  </label>
                  <label>
                    Fonte/citação
                    <input value={ageEqForm.source_citation}
                      onChange={(e) => setAgeEqForm({ ...ageEqForm, source_citation: e.target.value })} />
                  </label>
                </div>
                <button type="submit">Adicionar idade equivalente</button>
              </form>

              {ageEquivalents.length > 0 && (
              <div className="card">
                <h3>Idades equivalentes cadastradas</h3>
                <table>
                  <thead>
                    <tr><th>Subteste</th><th>Faixa bruta</th><th>Idade equivalente</th><th>Fonte</th><th></th></tr>
                  </thead>
                  <tbody>
                    {ageEquivalents.map((a) => (
                      <tr key={a.id}>
                        <td>{a.subtest_name}</td>
                        <td>{a.min_raw}–{a.max_raw}</td>
                        <td>{a.is_floor ? "< " : ""}{Math.floor(a.age_months / 12)}a, {a.age_months % 12}m</td>
                        <td>{a.source_citation}</td>
                        <td><button type="button" onClick={() => handleDeleteAgeEq(a.id)}>Excluir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}

          {cutoffSubtests.length > 0 && (
            <>
              <form className="card" onSubmit={handleAddBand}>
                <h3>Nova faixa de corte (subteste)</h3>
                <div className="form-grid">
                  <label>
                    Subteste
                    <select
                      value={bandForm.subtest_code}
                      onChange={(e) => setBandForm({ ...bandForm, subtest_code: e.target.value })}
                      required
                    >
                      <option value="">Selecione...</option>
                      {cutoffSubtests.map((s) => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Escore mín.
                    <input type="number" step="any" value={bandForm.min_raw}
                      onChange={(e) => setBandForm({ ...bandForm, min_raw: e.target.value })} required />
                  </label>
                  <label>
                    Escore máx.
                    <input type="number" step="any" value={bandForm.max_raw}
                      onChange={(e) => setBandForm({ ...bandForm, max_raw: e.target.value })} required />
                  </label>
                  <label>
                    Escolaridade (opcional)
                    <input value={bandForm.education}
                      onChange={(e) => setBandForm({ ...bandForm, education: e.target.value })} />
                  </label>
                  <label>
                    Classificação
                    <input value={bandForm.label}
                      onChange={(e) => setBandForm({ ...bandForm, label: e.target.value })}
                      placeholder="Ex: Moderado" required />
                  </label>
                  <label>
                    Fonte/citação
                    <input value={bandForm.source_citation}
                      onChange={(e) => setBandForm({ ...bandForm, source_citation: e.target.value })} />
                  </label>
                </div>
                <button type="submit">Adicionar faixa</button>
              </form>

              {bands.length > 0 && (
              <div className="card">
                <h3>Faixas cadastradas</h3>
                <table>
                  <thead>
                    <tr><th>Subteste</th><th>Faixa</th><th>Escolaridade</th><th>Classificação</th><th>Fonte</th><th></th></tr>
                  </thead>
                  <tbody>
                    {bands.map((b) => (
                      <tr key={b.id}>
                        <td>{b.subtest_name}</td>
                        <td>{b.min_raw}–{b.max_raw}</td>
                        <td>{b.education ?? "-"}</td>
                        <td>{b.label}</td>
                        <td>{b.source_citation}</td>
                        <td><button type="button" onClick={() => handleDeleteBand(b.id)}>Excluir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}

          {test.composites?.length > 0 && (
            <>
              <form className="card" onSubmit={handleAddComposite}>
                <h3>Tabela oficial de conversão (índice composto)</h3>
                <div className="form-grid">
                  <label>
                    Índice
                    <select
                      value={compositeForm.composite_code}
                      onChange={(e) => setCompositeForm({ ...compositeForm, composite_code: e.target.value })}
                      required
                    >
                      <option value="">Selecione...</option>
                      {test.composites.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Soma dos ponderados
                    <input type="number" value={compositeForm.sum_scaled_score}
                      onChange={(e) => setCompositeForm({ ...compositeForm, sum_scaled_score: e.target.value })} required />
                  </label>
                  <label>
                    Escore composto
                    <input type="number" step="any" value={compositeForm.composite_score}
                      onChange={(e) => setCompositeForm({ ...compositeForm, composite_score: e.target.value })} required />
                  </label>
                  <label>
                    Percentil
                    <input type="number" step="any" value={compositeForm.percentile}
                      onChange={(e) => setCompositeForm({ ...compositeForm, percentile: e.target.value })} />
                  </label>
                  <label>
                    IC 95% inferior
                    <input type="number" step="any" value={compositeForm.ci_lower_95}
                      onChange={(e) => setCompositeForm({ ...compositeForm, ci_lower_95: e.target.value })} />
                  </label>
                  <label>
                    IC 95% superior
                    <input type="number" step="any" value={compositeForm.ci_upper_95}
                      onChange={(e) => setCompositeForm({ ...compositeForm, ci_upper_95: e.target.value })} />
                  </label>
                </div>
                <button type="submit">Adicionar linha</button>
              </form>

              <div className="card">
                <h3>Conversões cadastradas</h3>
                {composites.length === 0 ? <p>Nenhuma ainda (sistema usa estimativa aproximada até você cadastrar).</p> : (
                  <table>
                    <thead>
                      <tr><th>Índice</th><th>Soma</th><th>Escore</th><th>Percentil</th><th></th></tr>
                    </thead>
                    <tbody>
                      {composites.map((c) => (
                        <tr key={c.id}>
                          <td>{c.composite_name}</td>
                          <td>{c.sum_scaled_score}</td>
                          <td>{c.composite_score}</td>
                          <td>{c.percentile}</td>
                          <td><button type="button" onClick={() => handleDeleteComposite(c.id)}>Excluir</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
        );
      })()}
    </div>
  );
}
