const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'tracker.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    nif TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    postal_code TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    profession TEXT DEFAULT 'VFX Compositor',
    iva_rate REAL DEFAULT 21.0,
    irpf_rate REAL DEFAULT 15.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    cif TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    postal_code TEXT DEFAULT '',
    country TEXT DEFAULT 'España',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    contact_person TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    company_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    hourly_rate REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    invoice_number TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL DEFAULT 1,
    date DATE NOT NULL,
    hours REAL NOT NULL,
    description TEXT DEFAULT '',
    hourly_rate_override REAL DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO users (id, name) VALUES (1, '');
`);

// Migraciones seguras (no fallan si la columna ya existe)
try { db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT NULL'); } catch(_) {}
try { db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0'); } catch(_) {}
try { db.exec('ALTER TABLE companies ADD COLUMN payment_days INTEGER DEFAULT 30'); } catch(_) {}
try { db.exec("ALTER TABLE projects ADD COLUMN budget_type TEXT DEFAULT 'hourly'"); } catch(_) {}
try { db.exec('ALTER TABLE projects ADD COLUMN fixed_budget REAL DEFAULT NULL'); } catch(_) {}
try { db.exec('ALTER TABLE projects ADD COLUMN is_completed INTEGER DEFAULT 0'); } catch(_) {}
try { db.exec('ALTER TABLE projects ADD COLUMN invoiced_at DATE DEFAULT NULL'); } catch(_) {}
try { db.exec('ALTER TABLE projects ADD COLUMN expected_payment_date DATE DEFAULT NULL'); } catch(_) {}

// USER
const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const saveUser = (data) => db.prepare(`
  INSERT OR REPLACE INTO users (id, name, email, nif, address, city, postal_code, phone, profession, iva_rate, irpf_rate)
  VALUES (@id, @name, @email, @nif, @address, @city, @postal_code, @phone, @profession, @iva_rate, @irpf_rate)
`).run({ id: 1, name: '', email: '', nif: '', address: '', city: '', postal_code: '', phone: '', profession: 'VFX Compositor', iva_rate: 21.0, irpf_rate: 15.0, ...data });

// COMPANIES
const getCompanies = (userId) => db.prepare('SELECT * FROM companies WHERE user_id = ? ORDER BY name').all(userId);
const createCompany = (data) => db.prepare(`
  INSERT INTO companies (user_id, name, cif, address, city, postal_code, country, email, phone, contact_person, notes, payment_days)
  VALUES (@user_id, @name, @cif, @address, @city, @postal_code, @country, @email, @phone, @contact_person, @notes, @payment_days)
`).run({ user_id: 1, cif: '', address: '', city: '', postal_code: '', country: 'España', email: '', phone: '', contact_person: '', notes: '', payment_days: 30, ...data }).lastInsertRowid;
const updateCompany = (id, data) => db.prepare(`
  UPDATE companies SET name=@name, cif=@cif, address=@address, city=@city, postal_code=@postal_code,
  country=@country, email=@email, phone=@phone, contact_person=@contact_person, notes=@notes,
  payment_days=@payment_days WHERE id=@id
`).run({ cif: '', address: '', city: '', postal_code: '', country: 'España', email: '', phone: '', contact_person: '', notes: '', payment_days: 30, ...data, id });
const deleteCompany = (id) => db.prepare('DELETE FROM companies WHERE id = ?').run(id);

// PROJECTS
const getProjects = (userId) => db.prepare(`
  SELECT p.*, c.name as company_name,
    COALESCE(SUM(e.hours), 0) as total_hours,
    COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount
  FROM projects p
  LEFT JOIN companies c ON p.company_id = c.id
  LEFT JOIN entries e ON e.project_id = p.id
  WHERE p.user_id = ?
  GROUP BY p.id
  ORDER BY p.created_at DESC
`).all(userId);

const getProject = (id) => db.prepare(`
  SELECT p.*, c.name as company_name, c.cif as company_cif, c.address as company_address,
    c.city as company_city, c.postal_code as company_postal_code, c.email as company_email,
    c.phone as company_phone, c.contact_person as company_contact,
    COALESCE(SUM(e.hours), 0) as total_hours,
    COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount
  FROM projects p
  LEFT JOIN companies c ON p.company_id = c.id
  LEFT JOIN entries e ON e.project_id = p.id
  WHERE p.id = ?
  GROUP BY p.id
`).get(id);

const createProject = (data) => db.prepare(`
  INSERT INTO projects (user_id, company_id, name, hourly_rate, status, notes)
  VALUES (@user_id, @company_id, @name, @hourly_rate, @status, @notes)
`).run({ user_id: 1, status: 'pending', notes: '', ...data }).lastInsertRowid;

const updateProject = (id, data) => db.prepare(`
  UPDATE projects SET name=@name, company_id=@company_id, hourly_rate=@hourly_rate,
  status=@status, invoice_number=@invoice_number, notes=@notes,
  budget_type=@budget_type, fixed_budget=@fixed_budget, is_completed=@is_completed,
  invoiced_at=@invoiced_at, expected_payment_date=@expected_payment_date WHERE id=@id
`).run({ invoice_number: '', notes: '', budget_type: 'hourly', fixed_budget: null,
         is_completed: 0, invoiced_at: null, expected_payment_date: null, ...data, id });

const deleteProject = (id) => {
  db.prepare('DELETE FROM entries WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
};

// ENTRIES
const getEntries = (projectId) => db.prepare(
  'SELECT * FROM entries WHERE project_id = ? ORDER BY date DESC, created_at DESC'
).all(projectId);

const createEntry = (data) => db.prepare(`
  INSERT INTO entries (project_id, user_id, date, hours, description, hourly_rate_override)
  VALUES (@project_id, @user_id, @date, @hours, @description, @hourly_rate_override)
`).run({ user_id: 1, description: '', hourly_rate_override: null, ...data }).lastInsertRowid;

const updateEntry = (id, data) => db.prepare(`
  UPDATE entries SET date=@date, hours=@hours, description=@description, hourly_rate_override=@hourly_rate_override
  WHERE id=@id
`).run({ hourly_rate_override: null, ...data, id });

const deleteEntry = (id) => db.prepare('DELETE FROM entries WHERE id = ?').run(id);

// STATS
const getMonthlyStats = (userId) => db.prepare(`
  SELECT strftime('%Y-%m', e.date) as month,
    SUM(e.hours) as hours,
    SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings
  FROM entries e
  JOIN projects p ON e.project_id = p.id
  WHERE p.user_id = ?
  GROUP BY strftime('%Y-%m', e.date)
  ORDER BY month ASC
  LIMIT 12
`).all(userId);

const getHeatmapData = (userId) => db.prepare(`
  SELECT e.date, SUM(e.hours) as hours
  FROM entries e
  JOIN projects p ON e.project_id = p.id
  WHERE p.user_id = ? AND e.date >= date('now', '-365 days')
  GROUP BY e.date
`).all(userId);

const getClientStats = (userId) => db.prepare(`
  SELECT c.name as company, c.id as company_id,
    SUM(e.hours) as hours,
    SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings,
    COUNT(DISTINCT p.id) as projects
  FROM entries e
  JOIN projects p ON e.project_id = p.id
  JOIN companies c ON p.company_id = c.id
  WHERE p.user_id = ?
  GROUP BY c.id
  ORDER BY earnings DESC
`).all(userId);

const getYearlySummary = (userId) => db.prepare(`
  SELECT
    COALESCE(SUM(e.hours), 0) as total_hours,
    COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_earnings,
    COUNT(DISTINCT p.id) as total_projects,
    COUNT(DISTINCT p.company_id) as total_clients,
    COALESCE(AVG(p.hourly_rate), 0) as avg_rate
  FROM entries e
  JOIN projects p ON e.project_id = p.id
  WHERE p.user_id = ? AND strftime('%Y', e.date) = strftime('%Y', 'now')
`).get(userId);

// STATS CON RANGO DE FECHAS
const getMonthlyStatsRange = (userId, from, to, groupBy = 'month') => {
  const groupExpr = groupBy === 'day' ? "strftime('%Y-%m-%d', e.date)"
    : groupBy === 'week' ? "strftime('%Y-%W', e.date)"
    : "strftime('%Y-%m', e.date)";
  return db.prepare(`
    SELECT ${groupExpr} as period,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = ? AND e.date >= ? AND e.date <= ?
    GROUP BY ${groupExpr}
    ORDER BY period ASC
  `).all(userId, from, to);
};

const getSummaryRange = (userId, from, to) => db.prepare(`
  SELECT
    COALESCE(SUM(e.hours), 0) as total_hours,
    COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_earnings,
    COUNT(DISTINCT p.id) as total_projects,
    COUNT(DISTINCT p.company_id) as total_clients,
    COALESCE(AVG(p.hourly_rate), 0) as avg_rate
  FROM entries e
  JOIN projects p ON e.project_id = p.id
  WHERE p.user_id = ? AND e.date >= ? AND e.date <= ?
`).get(userId, from, to);

const getClientStatsRange = (userId, from, to) => db.prepare(`
  SELECT c.name as company, c.id as company_id,
    SUM(e.hours) as hours,
    SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings,
    COUNT(DISTINCT p.id) as projects
  FROM entries e
  JOIN projects p ON e.project_id = p.id
  JOIN companies c ON p.company_id = c.id
  WHERE p.user_id = ? AND e.date >= ? AND e.date <= ?
  GROUP BY c.id
  ORDER BY earnings DESC
`).all(userId, from, to);

const getProjectStatsDetail = (projectId) => {
  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
      COUNT(*) as entry_count,
      MIN(e.date) as first_date,
      MAX(e.date) as last_date,
      COALESCE(AVG(e.hours), 0) as avg_hours_per_entry
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE e.project_id = ?
  `).get(projectId);
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', e.date) as period,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE e.project_id = ?
    GROUP BY strftime('%Y-%m', e.date)
    ORDER BY period ASC
  `).all(projectId);
  return { summary, monthly };
};

const getTreasuryData = (userId) => db.prepare(`
  SELECT p.id, p.name, p.status, p.budget_type, p.fixed_budget, p.is_completed,
    p.invoiced_at, p.expected_payment_date, p.invoice_number, p.created_at,
    c.name as company_name, COALESCE(c.payment_days, 30) as payment_days,
    COALESCE(SUM(e.hours), 0) as total_hours,
    COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
    CASE
      WHEN p.expected_payment_date IS NOT NULL THEN p.expected_payment_date
      WHEN p.invoiced_at IS NOT NULL
        THEN date(p.invoiced_at, '+' || COALESCE(c.payment_days, 30) || ' days')
      ELSE NULL
    END as forecast_date
  FROM projects p
  LEFT JOIN companies c ON p.company_id = c.id
  LEFT JOIN entries e ON e.project_id = p.id
  WHERE p.user_id = ?
  GROUP BY p.id
  ORDER BY
    CASE p.status WHEN 'sent' THEN 1 WHEN 'pending' THEN 2 WHEN 'paid' THEN 3 ELSE 4 END,
    forecast_date ASC NULLS LAST,
    p.created_at DESC
`).all(userId);

// AUTH
const findUserByEmail = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);
const createAuthUser = (data) => db.prepare(`
  INSERT INTO users (name, email, password_hash, iva_rate, irpf_rate)
  VALUES (@name, @email, @password_hash, 21.0, 15.0)
`).run(data).lastInsertRowid;

module.exports = {
  getUser, saveUser, findUserByEmail, createAuthUser,
  getCompanies, createCompany, updateCompany, deleteCompany,
  getProjects, getProject, createProject, updateProject, deleteProject,
  getEntries, createEntry, updateEntry, deleteEntry,
  getMonthlyStats, getHeatmapData, getClientStats, getYearlySummary,
  getMonthlyStatsRange, getSummaryRange, getClientStatsRange,
  getProjectStatsDetail, getTreasuryData
};
