export function requireAdmin(req, res, next) {
  if (req.user?.role !== "administrador") {
    return res.status(403).json({ error: "Acesso restrito a administradores" });
  }
  next();
}
