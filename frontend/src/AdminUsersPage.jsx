import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "./api";

const ROLES = ["administrador", "psicologo", "secretaria"];
const emptyForm = { name: "", email: "", password: "", role: "psicologo" };

export function AdminUsersPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setUsers(await api.listUsers(token));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(user) {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email, password: "", role: user.role });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.updateUser(editingId, payload, token);
      } else {
        await api.createUser(form, token);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    setError("");
    try {
      await api.deleteUser(id, token);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h2>Administração de usuários</h2>

      <form className="card" onSubmit={handleSubmit}>
        <h3>{editingId ? "Editar usuário" : "Novo usuário"}</h3>
        <div className="form-grid">
          <label>
            Nome
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Senha {editingId && "(deixe em branco para manter)"}
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8}
              required={!editingId}
            />
          </label>
          <label>
            Perfil
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit">{editingId ? "Salvar alterações" : "Criar usuário"}</button>
          {editingId && (
            <button type="button" onClick={cancelEdit}>Cancelar</button>
          )}
        </div>
      </form>

      <div className="card">
        <h3>Usuários do sistema</h3>
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td className="actions">
                    <button type="button" onClick={() => startEdit(u)}>Editar</button>
                    {u.id !== currentUser.id && (
                      <button type="button" onClick={() => handleDelete(u.id)}>Excluir</button>
                    )}
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
