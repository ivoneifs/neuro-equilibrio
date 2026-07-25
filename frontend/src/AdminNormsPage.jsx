import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "./api";

const emptyNorm = { subtest_code: "", age_min_years: "", age_max_years: "", education: "", sex: "", mean: "", sd: "", source_citation: "" };
const emptyComposite = { composite_code: "", sum_scaled_score: "", composite_score: "", percentile: "", ci_lower_95: "", ci_upper_95: "" };

export function AdminNormsPage() {
  const { token } = useAuth();
  const [tests, setTests] = useState([]);
  const [testCode, setTestCode] = useState("");
  const [test, setTest] = useState(null);
  const [norms, setNorms] = useState([]);
  const [composites, setComposites] = useState([]);
  const [normForm, setNormForm] = useState(emptyNorm);
  const [compositeForm, setCompositeForm] = useState(emptyComposite);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listTests(token).then(setTests);
  }, []);

  async function loadTestData(code) {
    const [t, n, c] = await Promise.all([
      api.getTest(code, token),
      api.listNormativeTables(code, token),
      api.listCompositeConversionTables(code, token),
    ]);
    setTest(t);
    setNorms(n);
    setComposites(c);
  }

  useEffect(() => {
    if (!testCode) {
      setTest(null);
      return;
    }
    setNormForm(emptyNorm);
    setCompositeForm(emptyComposite);
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

      {test && (
        <>
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
                  {test.subtests.map((s) => (
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

          <div className="card">
            <h3>Tabelas cadastradas</h3>
            {norms.length === 0 ? <p>Nenhuma ainda.</p> : (
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
            )}
          </div>

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
      )}
    </div>
  );
}
