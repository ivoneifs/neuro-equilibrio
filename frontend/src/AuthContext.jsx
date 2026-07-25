import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me(token)
      .then(({ user }) => setUser(user))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function handleAuthenticated({ user, token }) {
    localStorage.setItem("token", token);
    setToken(token);
    setUser(user);
  }

  async function login(email, password) {
    const result = await api.login({ email, password });
    handleAuthenticated(result);
  }

  async function register(name, email, password) {
    const result = await api.register({ name, email, password });
    handleAuthenticated(result);
  }

  async function logout() {
    if (token) await api.logout(token).catch(() => {});
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
