import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(__dirname, "..", "data.sqlite"));

db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    cpf TEXT,
    birth_date TEXT NOT NULL,
    sex TEXT,
    education TEXT,
    father_name TEXT,
    mother_name TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    legal_guardian TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS patient_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (patient_id) REFERENCES patients(id)
  );

  -- RF27: perfis de usuário (administrador, psicólogo, secretaria/recepção, informante externo).
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'psicologo',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- RF11/RF18: catálogo extensível de testes neuropsicológicos ("plugins" - Seção 5.2 do CLAUDE.md).
  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT
  );

  -- Cada subteste/medida de um teste. direction indica se escore bruto maior é melhor ou pior.
  -- scoring_method 'z_score' (padrão, usa normative_tables) ou 'cutoff' (usa score_bands,
  -- para instrumentos com faixas de corte fixas, ex.: BDI-II, BAI, MEEM).
  CREATE TABLE IF NOT EXISTS subtests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT,
    direction TEXT NOT NULL DEFAULT 'higher_better',
    scale_mean REAL NOT NULL DEFAULT 10,
    scale_sd REAL NOT NULL DEFAULT 3,
    derived_from_a TEXT,
    derived_from_b TEXT,
    scoring_method TEXT NOT NULL DEFAULT 'z_score',
    display_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (test_id) REFERENCES tests(id),
    UNIQUE (test_id, code)
  );

  -- Faixas de corte fixas por escore bruto (e opcionalmente escolaridade), parametrizáveis (RF13).
  CREATE TABLE IF NOT EXISTS score_bands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtest_id INTEGER NOT NULL,
    min_raw REAL NOT NULL,
    max_raw REAL NOT NULL,
    education TEXT,
    label TEXT NOT NULL,
    source_citation TEXT,
    FOREIGN KEY (subtest_id) REFERENCES subtests(id)
  );

  -- RF13/RF19: tabelas normativas parametrizáveis por idade (e opcionalmente escolaridade/sexo), versionadas.
  CREATE TABLE IF NOT EXISTS normative_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtest_id INTEGER NOT NULL,
    age_min_years REAL NOT NULL,
    age_max_years REAL NOT NULL,
    education TEXT,
    sex TEXT,
    mean REAL NOT NULL,
    sd REAL NOT NULL,
    source_citation TEXT,
    version TEXT NOT NULL DEFAULT '1.0',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (subtest_id) REFERENCES subtests(id)
  );

  -- Idade equivalente (idade mental): escore bruto -> idade típica de desempenho, por subteste.
  -- is_floor indica que o escore está no piso da tabela do manual (exibir como "< idade").
  CREATE TABLE IF NOT EXISTS age_equivalent_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtest_id INTEGER NOT NULL,
    min_raw REAL NOT NULL,
    max_raw REAL NOT NULL,
    age_months INTEGER NOT NULL,
    is_floor INTEGER NOT NULL DEFAULT 0,
    source_citation TEXT,
    FOREIGN KEY (subtest_id) REFERENCES subtests(id)
  );

  -- RF15: sessão de aplicação de um teste a um paciente.
  CREATE TABLE IF NOT EXISTS test_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    test_id INTEGER NOT NULL,
    application_date TEXT NOT NULL,
    applied_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (test_id) REFERENCES tests(id),
    FOREIGN KEY (applied_by_user_id) REFERENCES users(id)
  );

  -- RF12: escores brutos por subteste, com o resultado já calculado no momento da aplicação
  -- (z/escore ponderado/percentil/classificação — ou classificação de faixa de corte). Guardar o
  -- resultado em vez de recalculá-lo depois evita duplicar a lógica do motor (z_score vs cutoff)
  -- em cada lugar que exibe o laudo, e preserva o que foi mostrado ao profissional (RF19).
  CREATE TABLE IF NOT EXISTS test_raw_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    subtest_id INTEGER NOT NULL,
    raw_score REAL NOT NULL,
    normative_table_id INTEGER,
    z REAL,
    scaled_score REAL,
    percentile REAL,
    classification TEXT,
    age_equivalent_months INTEGER,
    age_equivalent_is_floor INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES test_sessions(id),
    FOREIGN KEY (subtest_id) REFERENCES subtests(id),
    FOREIGN KEY (normative_table_id) REFERENCES normative_tables(id)
  );

  -- Índices compostos (ex.: WISC-IV QI Total, ICV, IOP, IMO, IVP): soma dos escores
  -- ponderados dos subtestes membros, convertida em escore composto (mean 100 / sd 15).
  CREATE TABLE IF NOT EXISTS composite_indices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    subtest_codes TEXT NOT NULL,
    scale_mean REAL NOT NULL DEFAULT 100,
    scale_sd REAL NOT NULL DEFAULT 15,
    display_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (test_id) REFERENCES tests(id),
    UNIQUE (test_id, code)
  );

  -- Tabela oficial soma-de-ponderados -> composto (do manual do teste). Busca exata por soma.
  CREATE TABLE IF NOT EXISTS composite_conversion_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    composite_id INTEGER NOT NULL,
    sum_scaled_score INTEGER NOT NULL,
    composite_score REAL NOT NULL,
    percentile REAL,
    ci_lower_95 REAL,
    ci_upper_95 REAL,
    version TEXT NOT NULL DEFAULT '1.0',
    FOREIGN KEY (composite_id) REFERENCES composite_indices(id)
  );

  CREATE TABLE IF NOT EXISTS test_composite_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    composite_id INTEGER NOT NULL,
    sum_scaled_score REAL NOT NULL,
    composite_score REAL,
    percentile REAL,
    ci_lower_95 REAL,
    ci_upper_95 REAL,
    is_approximate INTEGER NOT NULL DEFAULT 0,
    age_equivalent_months INTEGER,
    age_equivalent_is_floor INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES test_sessions(id),
    FOREIGN KEY (composite_id) REFERENCES composite_indices(id)
  );

  -- RF23/RF26: laudo consolidando um ou mais sessões de teste, com texto interpretativo editável (RF14).
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    created_by_user_id INTEGER,
    title TEXT NOT NULL,
    demand_description TEXT,
    interpretive_text TEXT,
    conclusion TEXT,
    referral_suggestions TEXT,
    test_session_ids TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
  );
`);

// Migração leve para bancos já existentes: adiciona colunas novas que "CREATE TABLE IF NOT EXISTS" não cobre.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("subtests", "scoring_method", "TEXT NOT NULL DEFAULT 'z_score'");
// RF24: dados exibidos no cabeçalho/rodapé do laudo.
ensureColumn("users", "crp", "TEXT");
ensureColumn("users", "clinic_name", "TEXT");
ensureColumn("test_raw_scores", "z", "REAL");
ensureColumn("test_raw_scores", "scaled_score", "REAL");
ensureColumn("test_raw_scores", "percentile", "REAL");
ensureColumn("test_raw_scores", "classification", "TEXT");
ensureColumn("test_raw_scores", "age_equivalent_months", "INTEGER");
ensureColumn("test_raw_scores", "age_equivalent_is_floor", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("test_composite_scores", "age_equivalent_months", "INTEGER");
ensureColumn("test_composite_scores", "age_equivalent_is_floor", "INTEGER NOT NULL DEFAULT 0");

export default db;
