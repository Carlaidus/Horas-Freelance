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
    iban TEXT DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS invoice_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    code TEXT DEFAULT '',
    description TEXT DEFAULT 'Serie general',
    next_number INTEGER DEFAULT 354,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    series_id INTEGER,
    number INTEGER,
    full_number TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    project_id INTEGER DEFAULT NULL,
    company_id INTEGER DEFAULT NULL,
    issuer_name TEXT DEFAULT '',
    issuer_nif TEXT DEFAULT '',
    issuer_address TEXT DEFAULT '',
    issuer_city TEXT DEFAULT '',
    issuer_postal_code TEXT DEFAULT '',
    customer_name TEXT DEFAULT '',
    customer_nif TEXT DEFAULT '',
    customer_address TEXT DEFAULT '',
    customer_city TEXT DEFAULT '',
    customer_postal_code TEXT DEFAULT '',
    customer_country TEXT DEFAULT 'España',
    issue_date DATE,
    operation_date DATE DEFAULT NULL,
    subtotal REAL DEFAULT 0,
    iva_rate REAL DEFAULT 21.0,
    iva_exempt INTEGER DEFAULT 0,
    iva_amount REAL DEFAULT 0,
    irpf_rate REAL DEFAULT 15.0,
    irpf_amount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    issued_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    description TEXT DEFAULT '',
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    line_total REAL DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migraciones seguras (no fallan si la columna ya existe)
try { db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT NULL'); } catch(_) {}
try { db.exec("ALTER TABLE users ADD COLUMN iban TEXT DEFAULT ''"); } catch(_) {}
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
  INSERT OR REPLACE INTO users (id, name, email, nif, address, city, postal_code, phone, profession, iva_rate, irpf_rate, iban)
  VALUES (@id, @name, @email, @nif, @address, @city, @postal_code, @phone, @profession, @iva_rate, @irpf_rate, @iban)
`).run({ id: 1, name: '', email: '', nif: '', address: '', city: '', postal_code: '', phone: '', profession: 'VFX Compositor', iva_rate: 21.0, irpf_rate: 15.0, iban: '', ...data });

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

// INVOICE SERIES
const getOrCreateDefaultSeries = (userId) => {
  let s = db.prepare("SELECT * FROM invoice_series WHERE user_id = ? AND is_active = 1 ORDER BY id LIMIT 1").get(userId);
  if (!s) {
    const id = db.prepare("INSERT INTO invoice_series (user_id, description, next_number) VALUES (?, 'Serie general', 354)").run(userId).lastInsertRowid;
    s = db.prepare("SELECT * FROM invoice_series WHERE id = ?").get(id);
  }
  return s;
};
const getInvoiceSeries = (userId) => db.prepare("SELECT * FROM invoice_series WHERE user_id = ? ORDER BY id").all(userId);
const getNextInvoiceNumber = (userId) => getOrCreateDefaultSeries(userId).next_number;

// INVOICES
const getInvoices = (userId) => db.prepare(`
  SELECT i.*, c.name as company_display_name
  FROM invoices i
  LEFT JOIN companies c ON i.company_id = c.id
  WHERE i.user_id = ?
  ORDER BY
    CASE i.status WHEN 'issued' THEN 1 ELSE 2 END,
    i.number DESC,
    i.created_at DESC
`).all(userId);

const getInvoice = (id) => db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
const getInvoiceLines = (invoiceId) => db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY sort_order, id").all(invoiceId);

const createInvoice = (data) => db.prepare(`
  INSERT INTO invoices (user_id, series_id, company_id, project_id, issue_date, operation_date,
    issuer_name, issuer_nif, issuer_address, issuer_city, issuer_postal_code,
    customer_name, customer_nif, customer_address, customer_city, customer_postal_code, customer_country,
    subtotal, iva_rate, iva_exempt, iva_amount, irpf_rate, irpf_amount, total, notes)
  VALUES (@user_id, @series_id, @company_id, @project_id, @issue_date, @operation_date,
    @issuer_name, @issuer_nif, @issuer_address, @issuer_city, @issuer_postal_code,
    @customer_name, @customer_nif, @customer_address, @customer_city, @customer_postal_code, @customer_country,
    @subtotal, @iva_rate, @iva_exempt, @iva_amount, @irpf_rate, @irpf_amount, @total, @notes)
`).run({
  user_id: 1, series_id: null, company_id: null, project_id: null,
  issue_date: new Date().toISOString().split('T')[0], operation_date: null,
  issuer_name: '', issuer_nif: '', issuer_address: '', issuer_city: '', issuer_postal_code: '',
  customer_name: '', customer_nif: '', customer_address: '', customer_city: '', customer_postal_code: '', customer_country: 'España',
  subtotal: 0, iva_rate: 21, iva_exempt: 0, iva_amount: 0, irpf_rate: 15, irpf_amount: 0, total: 0, notes: '',
  ...data
}).lastInsertRowid;

const updateInvoice = (id, data) => {
  const inv = db.prepare("SELECT status FROM invoices WHERE id = ?").get(id);
  if (inv?.status === 'issued') throw new Error('No se puede editar una factura emitida');
  return db.prepare(`
    UPDATE invoices SET
      company_id=@company_id, project_id=@project_id, issue_date=@issue_date, operation_date=@operation_date,
      issuer_name=@issuer_name, issuer_nif=@issuer_nif, issuer_address=@issuer_address, issuer_city=@issuer_city, issuer_postal_code=@issuer_postal_code,
      customer_name=@customer_name, customer_nif=@customer_nif, customer_address=@customer_address, customer_city=@customer_city,
      customer_postal_code=@customer_postal_code, customer_country=@customer_country,
      subtotal=@subtotal, iva_rate=@iva_rate, iva_exempt=@iva_exempt, iva_amount=@iva_amount,
      irpf_rate=@irpf_rate, irpf_amount=@irpf_amount, total=@total, notes=@notes,
      updated_at=datetime('now')
    WHERE id=@id AND status='draft'
  `).run({ ...data, id });
};

const issueInvoice = (id, userId) => {
  const tx = db.transaction(() => {
    const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    if (!inv) throw new Error('Factura no encontrada');
    if (inv.status === 'issued') throw new Error('Esta factura ya está emitida');
    if (!inv.issuer_nif) throw new Error('Falta el NIF del emisor. Completa tus datos en Ajustes.');
    if (!inv.customer_name) throw new Error('Falta el nombre del cliente');
    if (!inv.issue_date) throw new Error('Falta la fecha de emisión');
    if (inv.subtotal <= 0) throw new Error('La factura no tiene importe');

    let number = inv.number;
    let fullNumber = inv.full_number;

    if (!number) {
      const series = getOrCreateDefaultSeries(userId);
      number = series.next_number;
      fullNumber = String(number);
      // Check no duplicate
      const dup = db.prepare("SELECT id FROM invoices WHERE user_id=? AND full_number=? AND status='issued' AND id!=?").get(userId, fullNumber, id);
      if (dup) throw new Error(`El número ${fullNumber} ya está en uso`);
      db.prepare("UPDATE invoice_series SET next_number = next_number + 1 WHERE id = ?").run(series.id);
    }

    db.prepare(`
      UPDATE invoices SET status='issued', number=?, full_number=?, issued_at=datetime('now'), updated_at=datetime('now')
      WHERE id=?
    `).run(number, fullNumber, id);

    return db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
  });
  return tx();
};

const deleteInvoiceDraft = (id) => {
  const inv = db.prepare("SELECT status FROM invoices WHERE id = ?").get(id);
  if (inv?.status === 'issued') throw new Error('No se puede eliminar una factura emitida');
  db.prepare("DELETE FROM invoice_lines WHERE invoice_id = ?").run(id);
  db.prepare("DELETE FROM invoices WHERE id = ? AND status = 'draft'").run(id);
};

const setInvoiceLines = (invoiceId, lines) => {
  db.prepare("DELETE FROM invoice_lines WHERE invoice_id = ?").run(invoiceId);
  const stmt = db.prepare("INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, line_total, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
  lines.forEach((l, i) => stmt.run(invoiceId, l.description || '', l.quantity || 1, l.unit_price || 0, l.line_total || 0, i));
};

const updateInvoiceNumber = (id, userId, number) => {
  const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
  if (!inv) throw new Error('Factura no encontrada');
  const fullNumber = String(number);
  const dup = db.prepare("SELECT id FROM invoices WHERE user_id=? AND full_number=? AND status='issued' AND id!=?").get(userId, fullNumber, id);
  if (dup) throw new Error(`El número ${fullNumber} ya está en uso`);
  db.prepare("UPDATE invoices SET number=?, full_number=?, updated_at=datetime('now') WHERE id=?").run(number, fullNumber, id);
};

// AUTH
const findUserByEmail = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);
const createAuthUser = (data) => db.prepare(`
  INSERT INTO users (name, email, password_hash, iva_rate, irpf_rate)
  VALUES (@name, @email, @password_hash, 21.0, 15.0)
`).run(data).lastInsertRowid;
const countUsers = () => db.prepare('SELECT COUNT(*) as n FROM users WHERE password_hash IS NOT NULL').get().n;

// RESET TOKENS
const createResetToken = (userId, token, expiresAt) => db.prepare(
  'INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
).run(userId, token, expiresAt);
const findResetToken = (token) => db.prepare(
  "SELECT * FROM reset_tokens WHERE token = ? AND expires_at > datetime('now')"
).get(token);
const deleteResetToken = (token) => db.prepare('DELETE FROM reset_tokens WHERE token = ?').run(token);
const deleteExpiredTokens = () => db.prepare("DELETE FROM reset_tokens WHERE expires_at <= datetime('now')").run();
const updatePassword = (userId, hash) => db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);

module.exports = {
  getUser, saveUser, findUserByEmail, createAuthUser,
  getCompanies, createCompany, updateCompany, deleteCompany,
  getProjects, getProject, createProject, updateProject, deleteProject,
  getEntries, createEntry, updateEntry, deleteEntry,
  getMonthlyStats, getHeatmapData, getClientStats, getYearlySummary,
  getMonthlyStatsRange, getSummaryRange, getClientStatsRange,
  getProjectStatsDetail, getTreasuryData,
  countUsers, createResetToken, findResetToken, deleteResetToken, deleteExpiredTokens, updatePassword,
  getInvoices, getInvoice, getInvoiceLines, createInvoice, updateInvoice, issueInvoice,
  deleteInvoiceDraft, setInvoiceLines, getNextInvoiceNumber, updateInvoiceNumber, getInvoiceSeries
};
