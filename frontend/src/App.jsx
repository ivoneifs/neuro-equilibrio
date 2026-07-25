import { Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { Nav } from "./Nav";
import { PatientsPage } from "./PatientsPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { ApplyTestPage } from "./ApplyTestPage";
import { AdminNormsPage } from "./AdminNormsPage";

function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Carregando...</div>;
  if (!user) return <LoginPage />;

  return (
    <div className="app">
      <Nav />
      <Routes>
        <Route path="/" element={<PatientsPage />} />
        <Route path="/patients/:patientId/apply-test" element={<ApplyTestPage />} />
        {user.role === "administrador" && <Route path="/admin" element={<AdminUsersPage />} />}
        {user.role === "administrador" && <Route path="/admin/norms" element={<AdminNormsPage />} />}
      </Routes>
    </div>
  );
}

export default App;
