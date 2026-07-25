import { NavLink } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function Nav() {
  const { user, logout } = useAuth();

  return (
    <nav className="nav">
      <span className="nav-brand">Neuro Equilíbrio</span>
      <NavLink to="/" end>Pacientes</NavLink>
      {user.role === "administrador" && <NavLink to="/admin">Usuários</NavLink>}
      {user.role === "administrador" && <NavLink to="/admin/norms">Normas</NavLink>}
      <span className="nav-spacer" />
      <span className="nav-user">{user.name} ({user.role})</span>
      <button type="button" onClick={logout}>Sair</button>
    </nav>
  );
}
