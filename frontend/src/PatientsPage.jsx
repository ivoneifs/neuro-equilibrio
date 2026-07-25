import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { api } from "./api";

const emptyForm = { full_name: "", cpf: "", birth_date: "", sex: "", education: "" };

export function PatientsPage() {
  const { token } = useAuth();
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setPatients(await api.listPatients(token));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createPatient(form, token);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleArchive(id) {
    await api.archivePatient(id, token);
    await load();
  }

  return (
    <div className="page">
      <h2>Pacientes</h2>

      <form className="card" onSubmit={handleSubmit}>
        <h3>Novo paciente</h3>
        <div className="form-grid">
          <label>
            Nome completo
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </label>
          <label>
            CPF
            <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
          </label>
          <label>
            Data de nascimento
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              required
            />
          </label>
          <label>
            Sexo
            <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
              <option value="">-</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
            </select>
          </label>
          <label>
            Escolaridade
            <input
              value={form.education}
              onChange={(e) => setForm({ ...form, education: e.target.value })}
            />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit">Cadastrar paciente</button>
      </form>

      <div className="card">
        <h3>Pacientes cadastrados</h3>
        {loading ? (
          <p>Carregando...</p>
        ) : patients.length === 0 ? (
          <p>Nenhum paciente cadastrado ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Nascimento</th>
                <th>Idade atual</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name}</td>
                  <td>{p.birth_date}</td>
                  <td>
                    {p.age.years}a {p.age.months}m {p.age.days}d
                  </td>
                  <td className="actions">
                    <Link to={`/patients/${p.id}/apply-test`}>Aplicar teste</Link>
                    <button type="button" onClick={() => handleArchive(p.id)}>
                      Arquivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
