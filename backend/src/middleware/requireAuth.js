import { getUserFromRequest } from "../routes/auth.js";

export function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });
  req.user = user;
  next();
}
