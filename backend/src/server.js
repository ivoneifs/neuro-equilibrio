import express from "express";
import cors from "cors";
import "./seed.js";
import authRouter from "./routes/auth.js";
import patientsRouter from "./routes/patients.js";
import usersRouter from "./routes/users.js";
import testsRouter from "./routes/tests.js";
import testSessionsRouter from "./routes/testSessions.js";
import testSessionDetailRouter from "./routes/testSessionDetail.js";
import reportsRouter from "./routes/reports.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { requireAdmin } from "./middleware/requireAdmin.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/patients", requireAuth, patientsRouter);
app.use("/api/users", requireAuth, requireAdmin, usersRouter);
app.use("/api/tests", requireAuth, testsRouter);
app.use("/api/patients/:patientId/test-sessions", requireAuth, testSessionsRouter);
app.use("/api/test-sessions", requireAuth, testSessionDetailRouter);
app.use("/api/patients/:patientId/reports", requireAuth, reportsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
