const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.errors?.join(", ") || "Erro na requisição");
  return data;
}

export const api = {
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  logout: (token) => request("/api/auth/logout", { method: "POST", token }),
  me: (token) => request("/api/auth/me", { token }),
  listPatients: (token) => request("/api/patients", { token }),
  createPatient: (payload, token) => request("/api/patients", { method: "POST", body: payload, token }),
  archivePatient: (id, token) => request(`/api/patients/${id}/archive`, { method: "POST", token }),

  listUsers: (token) => request("/api/users", { token }),
  createUser: (payload, token) => request("/api/users", { method: "POST", body: payload, token }),
  updateUser: (id, payload, token) => request(`/api/users/${id}`, { method: "PUT", body: payload, token }),
  deleteUser: (id, token) => request(`/api/users/${id}`, { method: "DELETE", token }),

  listTests: (token) => request("/api/tests", { token }),
  getTest: (code, token) => request(`/api/tests/${code}`, { token }),
  listNormativeTables: (code, token) => request(`/api/tests/${code}/normative-tables`, { token }),
  createNormativeTable: (code, payload, token) =>
    request(`/api/tests/${code}/normative-tables`, { method: "POST", body: payload, token }),
  deleteNormativeTable: (id, token) =>
    request(`/api/tests/normative-tables/${id}`, { method: "DELETE", token }),
  listCompositeConversionTables: (code, token) =>
    request(`/api/tests/${code}/composite-conversion-tables`, { token }),
  createCompositeConversionTable: (code, payload, token) =>
    request(`/api/tests/${code}/composite-conversion-tables`, { method: "POST", body: payload, token }),
  deleteCompositeConversionTable: (id, token) =>
    request(`/api/tests/composite-conversion-tables/${id}`, { method: "DELETE", token }),

  listTestSessions: (patientId, token) => request(`/api/patients/${patientId}/test-sessions`, { token }),
  applyTestSession: (patientId, payload, token) =>
    request(`/api/patients/${patientId}/test-sessions`, { method: "POST", body: payload, token }),
  getTestSession: (id, token) => request(`/api/test-sessions/${id}`, { token }),
};
