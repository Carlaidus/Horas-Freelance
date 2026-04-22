const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const q = (sql, params = []) => pool.query(sql, params);

// ── INIT / SCHEMA ─────────────────────────────────────────────
const init = async () => {
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      nif TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      profession TEXT DEFAULT 'VFX Compositor',
      iva_rate FLOAT DEFAULT 21.0,
      irpf_rate FLOAT DEFAULT 15.0,
      iban TEXT DEFAULT '',
      password_hash TEXT DEFAULT NULL,
      email_verified INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user',
      plan TEXT DEFAULT 'free',
      plan_expires_at DATE DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
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
      payment_days INTEGER DEFAULT 30,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      hourly_rate FLOAT NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      invoice_number TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      budget_type TEXT DEFAULT 'hourly',
      fixed_budget FLOAT DEFAULT NULL,
      is_completed INTEGER DEFAULT 0,
      invoiced_at DATE DEFAULT NULL,
      expected_payment_date DATE DEFAULT NULL,
      completed_at DATE DEFAULT NULL,
      purchase_order TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1,
      date DATE NOT NULL,
      hours FLOAT NOT NULL,
      description TEXT DEFAULT '',
      hourly_rate_override FLOAT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS invoice_series (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1,
      code TEXT DEFAULT '',
      description TEXT DEFAULT 'Serie general',
      next_number INTEGER DEFAULT 354,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
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
      subtotal FLOAT DEFAULT 0,
      iva_rate FLOAT DEFAULT 21.0,
      iva_exempt INTEGER DEFAULT 0,
      iva_amount FLOAT DEFAULT 0,
      irpf_rate FLOAT DEFAULT 15.0,
      irpf_amount FLOAT DEFAULT 0,
      total FLOAT DEFAULT 0,
      notes TEXT DEFAULT '',
      issued_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS invoice_lines (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL,
      description TEXT DEFAULT '',
      quantity FLOAT DEFAULT 1,
      unit_price FLOAT DEFAULT 0,
      line_total FLOAT DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      event TEXT NOT NULL,
      metadata TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS timers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 0,
      is_paused INTEGER DEFAULT 0,
      started_at TEXT DEFAULT NULL,
      accumulated_seconds FLOAT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, project_id)
    )
  `);
};

// ── USER ──────────────────────────────────────────────────────
const getUser = async (id) => {
  const r = await q('SELECT * FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
};

const saveUser = async (data) => {
  await q(`
    UPDATE users SET name=$1, email=$2, nif=$3, address=$4, city=$5, postal_code=$6,
    phone=$7, profession=$8, iva_rate=$9, irpf_rate=$10, iban=$11
    WHERE id=$12
  `, [
    data.name ?? '', data.email ?? '', data.nif ?? '', data.address ?? '',
    data.city ?? '', data.postal_code ?? '', data.phone ?? '',
    data.profession ?? 'VFX Compositor', data.iva_rate ?? 21.0,
    data.irpf_rate ?? 15.0, data.iban ?? '', data.id
  ]);
};

const findUserByEmail = async (email) => {
  const r = await q('SELECT * FROM users WHERE email = $1', [email]);
  return r.rows[0] || null;
};

const createAuthUser = async (data) => {
  const r = await q(
    `INSERT INTO users (name, email, password_hash, iva_rate, irpf_rate, role, plan)
     VALUES ($1, $2, $3, 21.0, 15.0, 'user', 'free') RETURNING id`,
    [data.name, data.email, data.password_hash]
  );
  return r.rows[0].id;
};

const countUsers = async () => {
  const r = await q('SELECT COUNT(*) as n FROM users WHERE password_hash IS NOT NULL');
  return parseInt(r.rows[0].n, 10);
};

// ── COMPANIES ─────────────────────────────────────────────────
const getCompanies = async (userId) => {
  const r = await q('SELECT * FROM companies WHERE user_id = $1 ORDER BY name', [userId]);
  return r.rows;
};

const createCompany = async (data) => {
  const r = await q(`
    INSERT INTO companies (user_id, name, cif, address, city, postal_code, country, email, phone, contact_person, notes, payment_days)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id
  `, [
    data.user_id ?? 1, data.name, data.cif ?? '', data.address ?? '',
    data.city ?? '', data.postal_code ?? '', data.country ?? 'España',
    data.email ?? '', data.phone ?? '', data.contact_person ?? '',
    data.notes ?? '', data.payment_days ?? 30
  ]);
  return r.rows[0].id;
};

const updateCompany = async (id, data) => {
  await q(`
    UPDATE companies SET name=$1, cif=$2, address=$3, city=$4, postal_code=$5,
    country=$6, email=$7, phone=$8, contact_person=$9, notes=$10, payment_days=$11
    WHERE id=$12
  `, [
    data.name, data.cif ?? '', data.address ?? '', data.city ?? '',
    data.postal_code ?? '', data.country ?? 'España', data.email ?? '',
    data.phone ?? '', data.contact_person ?? '', data.notes ?? '',
    data.payment_days ?? 30, id
  ]);
};

const deleteCompany = async (id) => {
  await q('DELETE FROM companies WHERE id = $1', [id]);
};

// ── PROJECTS ──────────────────────────────────────────────────
const getProjects = async (userId) => {
  const r = await q(`
    SELECT p.*, c.name as company_name,
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
      MIN(e.date) as first_entry_date,
      MAX(e.date) as last_entry_date
    FROM projects p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN entries e ON e.project_id = p.id
    WHERE p.user_id = $1
    GROUP BY p.id, c.name
    ORDER BY p.created_at DESC
  `, [userId]);
  return r.rows;
};

const getProject = async (id) => {
  const r = await q(`
    SELECT p.*, c.name as company_name, c.cif as company_cif, c.address as company_address,
      c.city as company_city, c.postal_code as company_postal_code, c.email as company_email,
      c.phone as company_phone, c.contact_person as company_contact,
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
      MIN(e.date) as first_entry_date,
      MAX(e.date) as last_entry_date
    FROM projects p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN entries e ON e.project_id = p.id
    WHERE p.id = $1
    GROUP BY p.id, c.name, c.cif, c.address, c.city, c.postal_code, c.email, c.phone, c.contact_person
  `, [id]);
  return r.rows[0] || null;
};

const createProject = async (data) => {
  const r = await q(`
    INSERT INTO projects (user_id, company_id, name, hourly_rate, status, notes)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [
    data.user_id ?? 1, data.company_id, data.name,
    data.hourly_rate, data.status ?? 'pending', data.notes ?? ''
  ]);
  return r.rows[0].id;
};

const updateProject = async (id, data) => {
  await q(`
    UPDATE projects SET name=$1, company_id=$2, hourly_rate=$3, status=$4, invoice_number=$5,
    notes=$6, budget_type=$7, fixed_budget=$8, is_completed=$9, invoiced_at=$10,
    expected_payment_date=$11, completed_at=$12, purchase_order=$13
    WHERE id=$14
  `, [
    data.name, data.company_id, data.hourly_rate, data.status,
    data.invoice_number ?? '', data.notes ?? '', data.budget_type ?? 'hourly',
    data.fixed_budget ?? null, data.is_completed ?? 0,
    data.invoiced_at ?? null, data.expected_payment_date ?? null,
    data.completed_at ?? null, data.purchase_order ?? '', id
  ]);
};

const deleteProject = async (id) => {
  await q('DELETE FROM entries WHERE project_id = $1', [id]);
  await q('DELETE FROM projects WHERE id = $1', [id]);
};

// ── ENTRIES ───────────────────────────────────────────────────
const getEntries = async (projectId) => {
  const r = await q(
    'SELECT * FROM entries WHERE project_id = $1 ORDER BY date DESC, created_at DESC',
    [projectId]
  );
  return r.rows;
};

const createEntry = async (data) => {
  const r = await q(`
    INSERT INTO entries (project_id, user_id, date, hours, description, hourly_rate_override)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [
    data.project_id, data.user_id ?? 1, data.date, data.hours,
    data.description ?? '', data.hourly_rate_override ?? null
  ]);
  return r.rows[0].id;
};

const updateEntry = async (id, data) => {
  await q(`
    UPDATE entries SET date=$1, hours=$2, description=$3, hourly_rate_override=$4 WHERE id=$5
  `, [data.date, data.hours, data.description, data.hourly_rate_override ?? null, id]);
};

const deleteEntry = async (id) => {
  await q('DELETE FROM entries WHERE id = $1', [id]);
};

// ── STATS ─────────────────────────────────────────────────────
const getMonthlyStats = async (userId) => {
  const r = await q(`
    SELECT TO_CHAR(e.date::date, 'YYYY-MM') as month,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1
    GROUP BY TO_CHAR(e.date::date, 'YYYY-MM')
    ORDER BY month ASC
    LIMIT 12
  `, [userId]);
  return r.rows;
};

const getHeatmapData = async (userId) => {
  const r = await q(`
    SELECT TO_CHAR(e.date::date, 'YYYY-MM-DD') as date, SUM(e.hours) as hours
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1 AND e.date >= CURRENT_DATE - INTERVAL '365 days'
    GROUP BY e.date
  `, [userId]);
  return r.rows;
};

const getClientStats = async (userId) => {
  const r = await q(`
    SELECT c.name as company, c.id as company_id,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings,
      COUNT(DISTINCT p.id) as projects
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    JOIN companies c ON p.company_id = c.id
    WHERE p.user_id = $1
    GROUP BY c.id, c.name
    ORDER BY earnings DESC
  `, [userId]);
  return r.rows;
};

const getYearlySummary = async (userId) => {
  const r = await q(`
    SELECT
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_earnings,
      COUNT(DISTINCT p.id) as total_projects,
      COUNT(DISTINCT p.company_id) as total_clients,
      COALESCE(AVG(p.hourly_rate), 0) as avg_rate
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1 AND TO_CHAR(e.date::date, 'YYYY') = TO_CHAR(NOW(), 'YYYY')
  `, [userId]);
  return r.rows[0];
};

const getMonthlyStatsRange = async (userId, from, to, groupBy = 'month') => {
  const groupExpr = groupBy === 'day'
    ? "TO_CHAR(e.date::date, 'YYYY-MM-DD')"
    : groupBy === 'week'
    ? "TO_CHAR(e.date::date, 'IYYY-IW')"
    : "TO_CHAR(e.date::date, 'YYYY-MM')";
  const r = await q(`
    SELECT ${groupExpr} as period,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1 AND e.date >= $2 AND e.date <= $3
    GROUP BY ${groupExpr}
    ORDER BY period ASC
  `, [userId, from, to]);
  return r.rows;
};

const getSummaryRange = async (userId, from, to) => {
  const r = await q(`
    SELECT
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_earnings,
      COUNT(DISTINCT p.id) as total_projects,
      COUNT(DISTINCT p.company_id) as total_clients,
      COALESCE(AVG(p.hourly_rate), 0) as avg_rate
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1 AND e.date >= $2 AND e.date <= $3
  `, [userId, from, to]);
  return r.rows[0];
};

const getClientStatsRange = async (userId, from, to) => {
  const r = await q(`
    SELECT c.name as company, c.id as company_id,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings,
      COUNT(DISTINCT p.id) as projects
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    JOIN companies c ON p.company_id = c.id
    WHERE p.user_id = $1 AND e.date >= $2 AND e.date <= $3
    GROUP BY c.id, c.name
    ORDER BY earnings DESC
  `, [userId, from, to]);
  return r.rows;
};

const getProjectStatsDetail = async (projectId) => {
  const sr = await q(`
    SELECT
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
      COUNT(*) as entry_count,
      MIN(e.date) as first_date,
      MAX(e.date) as last_date,
      COALESCE(AVG(e.hours), 0) as avg_hours_per_entry
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE e.project_id = $1
  `, [projectId]);
  const mr = await q(`
    SELECT TO_CHAR(e.date::date, 'YYYY-MM') as period,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE e.project_id = $1
    GROUP BY TO_CHAR(e.date::date, 'YYYY-MM')
    ORDER BY period ASC
  `, [projectId]);
  return { summary: sr.rows[0], monthly: mr.rows };
};

const getTreasuryData = async (userId) => {
  const r = await q(`
    SELECT p.id, p.name, p.status, p.budget_type, p.fixed_budget, p.is_completed,
      p.invoiced_at, p.expected_payment_date, p.invoice_number, p.created_at,
      c.name as company_name, COALESCE(c.payment_days, 30) as payment_days,
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
      CASE
        WHEN p.expected_payment_date IS NOT NULL THEN p.expected_payment_date
        WHEN p.invoiced_at IS NOT NULL
          THEN p.invoiced_at + (COALESCE(c.payment_days, 30) * INTERVAL '1 day')
        ELSE NULL
      END as forecast_date
    FROM projects p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN entries e ON e.project_id = p.id
    WHERE p.user_id = $1
    GROUP BY p.id, c.name, c.payment_days
    ORDER BY
      CASE p.status WHEN 'sent' THEN 1 WHEN 'pending' THEN 2 WHEN 'paid' THEN 3 ELSE 4 END,
      forecast_date ASC NULLS LAST,
      p.created_at DESC
  `, [userId]);
  return r.rows;
};

// ── INVOICE SERIES ────────────────────────────────────────────
const getOrCreateDefaultSeries = async (userId) => {
  let r = await q(
    "SELECT * FROM invoice_series WHERE user_id = $1 AND is_active = 1 ORDER BY id LIMIT 1",
    [userId]
  );
  if (!r.rows[0]) {
    const ir = await q(
      "INSERT INTO invoice_series (user_id, description, next_number) VALUES ($1, 'Serie general', 354) RETURNING id",
      [userId]
    );
    r = await q("SELECT * FROM invoice_series WHERE id = $1", [ir.rows[0].id]);
  }
  return r.rows[0];
};

const getInvoiceSeries = async (userId) => {
  const r = await q("SELECT * FROM invoice_series WHERE user_id = $1 ORDER BY id", [userId]);
  return r.rows;
};

const getNextInvoiceNumber = async (userId) => {
  const s = await getOrCreateDefaultSeries(userId);
  return s.next_number;
};

// ── INVOICES ──────────────────────────────────────────────────
const getInvoices = async (userId) => {
  const r = await q(`
    SELECT i.*, c.name as company_display_name
    FROM invoices i
    LEFT JOIN companies c ON i.company_id = c.id
    WHERE i.user_id = $1
    ORDER BY
      CASE i.status WHEN 'issued' THEN 1 ELSE 2 END,
      i.number DESC NULLS LAST,
      i.created_at DESC
  `, [userId]);
  return r.rows;
};

const getInvoice = async (id) => {
  const r = await q("SELECT * FROM invoices WHERE id = $1", [id]);
  return r.rows[0] || null;
};

const getInvoiceLines = async (invoiceId) => {
  const r = await q(
    "SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY sort_order, id",
    [invoiceId]
  );
  return r.rows;
};

const createInvoice = async (data) => {
  const r = await q(`
    INSERT INTO invoices (user_id, series_id, company_id, project_id, issue_date, operation_date,
      issuer_name, issuer_nif, issuer_address, issuer_city, issuer_postal_code,
      customer_name, customer_nif, customer_address, customer_city, customer_postal_code, customer_country,
      subtotal, iva_rate, iva_exempt, iva_amount, irpf_rate, irpf_amount, total, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
    RETURNING id
  `, [
    data.user_id ?? 1, data.series_id ?? null, data.company_id ?? null, data.project_id ?? null,
    data.issue_date ?? new Date().toISOString().split('T')[0], data.operation_date ?? null,
    data.issuer_name ?? '', data.issuer_nif ?? '', data.issuer_address ?? '',
    data.issuer_city ?? '', data.issuer_postal_code ?? '',
    data.customer_name ?? '', data.customer_nif ?? '', data.customer_address ?? '',
    data.customer_city ?? '', data.customer_postal_code ?? '', data.customer_country ?? 'España',
    data.subtotal ?? 0, data.iva_rate ?? 21, data.iva_exempt ?? 0, data.iva_amount ?? 0,
    data.irpf_rate ?? 15, data.irpf_amount ?? 0, data.total ?? 0, data.notes ?? ''
  ]);
  return r.rows[0].id;
};

const updateInvoice = async (id, data) => {
  const inv = await getInvoice(id);
  if (inv?.status === 'issued') throw new Error('No se puede editar una factura emitida');
  await q(`
    UPDATE invoices SET
      company_id=$1, project_id=$2, issue_date=$3, operation_date=$4,
      issuer_name=$5, issuer_nif=$6, issuer_address=$7, issuer_city=$8, issuer_postal_code=$9,
      customer_name=$10, customer_nif=$11, customer_address=$12, customer_city=$13,
      customer_postal_code=$14, customer_country=$15,
      subtotal=$16, iva_rate=$17, iva_exempt=$18, iva_amount=$19,
      irpf_rate=$20, irpf_amount=$21, total=$22, notes=$23, updated_at=NOW()
    WHERE id=$24 AND status='draft'
  `, [
    data.company_id ?? null, data.project_id ?? null, data.issue_date, data.operation_date ?? null,
    data.issuer_name ?? '', data.issuer_nif ?? '', data.issuer_address ?? '',
    data.issuer_city ?? '', data.issuer_postal_code ?? '',
    data.customer_name ?? '', data.customer_nif ?? '', data.customer_address ?? '',
    data.customer_city ?? '', data.customer_postal_code ?? '', data.customer_country ?? 'España',
    data.subtotal ?? 0, data.iva_rate ?? 21, data.iva_exempt ?? 0, data.iva_amount ?? 0,
    data.irpf_rate ?? 15, data.irpf_amount ?? 0, data.total ?? 0, data.notes ?? '', id
  ]);
};

const issueInvoice = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inv = (await client.query("SELECT * FROM invoices WHERE id = $1", [id])).rows[0];
    if (!inv) throw new Error('Factura no encontrada');
    if (inv.status === 'issued') throw new Error('Esta factura ya está emitida');
    if (!inv.issuer_nif) throw new Error('Falta el NIF del emisor. Completa tus datos en Ajustes.');
    if (!inv.customer_name) throw new Error('Falta el nombre del cliente');
    if (!inv.issue_date) throw new Error('Falta la fecha de emisión');
    if (inv.subtotal <= 0) throw new Error('La factura no tiene importe');

    let number = inv.number;
    let fullNumber = inv.full_number;

    if (!number) {
      let series = (await client.query(
        "SELECT * FROM invoice_series WHERE user_id = $1 AND is_active = 1 ORDER BY id LIMIT 1",
        [userId]
      )).rows[0];
      if (!series) {
        const sr = await client.query(
          "INSERT INTO invoice_series (user_id, description, next_number) VALUES ($1,'Serie general',354) RETURNING id",
          [userId]
        );
        series = (await client.query("SELECT * FROM invoice_series WHERE id = $1", [sr.rows[0].id])).rows[0];
      }
      number = series.next_number;
      fullNumber = String(number);
      const dup = (await client.query(
        "SELECT id FROM invoices WHERE user_id=$1 AND full_number=$2 AND status='issued' AND id!=$3",
        [userId, fullNumber, id]
      )).rows[0];
      if (dup) throw new Error(`El número ${fullNumber} ya está en uso`);
      await client.query(
        "UPDATE invoice_series SET next_number = next_number + 1 WHERE id = $1",
        [series.id]
      );
    }

    await client.query(
      "UPDATE invoices SET status='issued', number=$1, full_number=$2, issued_at=NOW(), updated_at=NOW() WHERE id=$3",
      [number, fullNumber, id]
    );

    const result = (await client.query("SELECT * FROM invoices WHERE id = $1", [id])).rows[0];
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const deleteInvoiceDraft = async (id) => {
  await q("DELETE FROM invoice_lines WHERE invoice_id = $1", [id]);
  await q("DELETE FROM invoices WHERE id = $1", [id]);
};

const setInvoiceLines = async (invoiceId, lines) => {
  await q("DELETE FROM invoice_lines WHERE invoice_id = $1", [invoiceId]);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await q(
      "INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, line_total, sort_order) VALUES ($1,$2,$3,$4,$5,$6)",
      [invoiceId, l.description || '', l.quantity || 1, l.unit_price || 0, l.line_total || 0, i]
    );
  }
};

const updateInvoiceNumber = async (id, userId, number) => {
  const inv = await getInvoice(id);
  if (!inv) throw new Error('Factura no encontrada');
  const fullNumber = String(number);
  const dup = (await q(
    "SELECT id FROM invoices WHERE user_id=$1 AND full_number=$2 AND status='issued' AND id!=$3",
    [userId, fullNumber, id]
  )).rows[0];
  if (dup) throw new Error(`El número ${fullNumber} ya está en uso`);
  await q("UPDATE invoices SET number=$1, full_number=$2, updated_at=NOW() WHERE id=$3", [number, fullNumber, id]);
};

// ── ADMIN ─────────────────────────────────────────────────────
const getAllUsers = async () => {
  const r = await q(`
    SELECT id, name, email, role, plan, plan_expires_at, created_at,
      CASE
        WHEN role = 'admin' THEN NULL
        WHEN plan = 'free' THEN NULL
        WHEN plan_expires_at IS NULL THEN NULL
        ELSE (plan_expires_at::date - CURRENT_DATE)::integer
      END as days_remaining
    FROM users
    ORDER BY created_at DESC
  `);
  return r.rows;
};

const setUserPlan = async (userId, plan, expiresAt) => {
  await q(
    'UPDATE users SET plan=$1, plan_expires_at=$2 WHERE id=$3',
    [plan, expiresAt || null, userId]
  );
};

// ── EVENTS / ANALYTICS ────────────────────────────────────────
const createEvent = async (userId, event, metadata) => {
  await q(
    'INSERT INTO events (user_id, event, metadata) VALUES ($1,$2,$3)',
    [userId, event, metadata ? JSON.stringify(metadata) : null]
  );
};

const getEventStats = async () => {
  const r = await q(`
    SELECT event,
      COUNT(*) as total,
      COUNT(DISTINCT user_id) as unique_users,
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as last_7d,
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 ELSE 0 END) as last_24h
    FROM events
    GROUP BY event ORDER BY total DESC
  `);
  return r.rows;
};

const getRecentEvents = async (limit = 50) => {
  const r = await q(`
    SELECT e.*, u.name as user_name
    FROM events e LEFT JOIN users u ON e.user_id = u.id
    ORDER BY e.created_at DESC LIMIT $1
  `, [limit]);
  return r.rows;
};

const getEventsPerDay = async (days = 30) => {
  const r = await q(`
    SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') as day, event, COUNT(*) as count
    FROM events
    WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
    GROUP BY TO_CHAR(created_at::date, 'YYYY-MM-DD'), event
    ORDER BY day
  `, [days]);
  return r.rows;
};

const getDailyActiveUsers = async (days = 30) => {
  const r = await q(`
    SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') as day, COUNT(DISTINCT user_id) as users
    FROM events
    WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
    GROUP BY TO_CHAR(created_at::date, 'YYYY-MM-DD')
    ORDER BY day
  `, [days]);
  return r.rows;
};

const getEventsByHour = async () => {
  const r = await q(`
    SELECT EXTRACT(HOUR FROM created_at)::integer as hour, COUNT(*) as count
    FROM events GROUP BY EXTRACT(HOUR FROM created_at)::integer ORDER BY hour
  `);
  return r.rows;
};

const getNewUsersPerMonth = async () => {
  const r = await q(`
    SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count
    FROM users
    WHERE created_at IS NOT NULL
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month DESC LIMIT 12
  `);
  return r.rows;
};

const getAppTotals = async () => {
  const r = await q(`
    SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM projects) as total_projects,
      (SELECT COUNT(*) FROM entries) as total_entries,
      (SELECT COALESCE(SUM(hours),0) FROM entries) as total_hours,
      (SELECT COUNT(*) FROM invoices) as total_invoices,
      (SELECT COUNT(*) FROM events WHERE created_at >= NOW() - INTERVAL '1 day') as events_24h,
      (SELECT COUNT(DISTINCT user_id) FROM events WHERE created_at >= NOW() - INTERVAL '1 day') as dau,
      (SELECT COUNT(DISTINCT user_id) FROM events WHERE created_at >= NOW() - INTERVAL '7 days') as wau
  `);
  return r.rows[0];
};

const getTopUsersByActivity = async (limit = 10) => {
  const r = await q(`
    SELECT u.name, u.email, u.plan, COUNT(e.id) as event_count,
      SUM(CASE WHEN e.created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as last_7d
    FROM users u LEFT JOIN events e ON u.id = e.user_id
    GROUP BY u.id, u.name, u.email, u.plan ORDER BY event_count DESC LIMIT $1
  `, [limit]);
  return r.rows;
};

// ── TIMERS ────────────────────────────────────────────────────
const getActiveTimers = async (userId) => {
  const r = await q(
    'SELECT * FROM timers WHERE user_id = $1 AND is_active = 1',
    [userId]
  );
  return r.rows;
};

const upsertTimer = async (userId, projectId, data) => {
  await q(`
    INSERT INTO timers (user_id, project_id, is_active, is_paused, started_at, accumulated_seconds, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT(user_id, project_id) DO UPDATE SET
      is_active=EXCLUDED.is_active, is_paused=EXCLUDED.is_paused,
      started_at=EXCLUDED.started_at, accumulated_seconds=EXCLUDED.accumulated_seconds,
      updated_at=EXCLUDED.updated_at
  `, [userId, projectId, data.is_active, data.is_paused, data.started_at, data.accumulated_seconds]);
};

const clearTimer = async (userId, projectId) => {
  await q('DELETE FROM timers WHERE user_id = $1 AND project_id = $2', [userId, projectId]);
};

// ── RESET TOKENS ──────────────────────────────────────────────
const createResetToken = async (userId, token, expiresAt) => {
  await q(
    'INSERT INTO reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
    [userId, token, expiresAt]
  );
};

const findResetToken = async (token) => {
  const r = await q(
    "SELECT * FROM reset_tokens WHERE token = $1 AND expires_at > NOW()",
    [token]
  );
  return r.rows[0] || null;
};

const deleteResetToken = async (token) => {
  await q('DELETE FROM reset_tokens WHERE token = $1', [token]);
};

const deleteExpiredTokens = async () => {
  await q("DELETE FROM reset_tokens WHERE expires_at <= NOW()");
};

const updatePassword = async (userId, hash) => {
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
};

module.exports = {
  init,
  getUser, saveUser, findUserByEmail, createAuthUser, getAllUsers, setUserPlan,
  getCompanies, createCompany, updateCompany, deleteCompany,
  getProjects, getProject, createProject, updateProject, deleteProject,
  getEntries, createEntry, updateEntry, deleteEntry,
  getMonthlyStats, getHeatmapData, getClientStats, getYearlySummary,
  getMonthlyStatsRange, getSummaryRange, getClientStatsRange,
  getProjectStatsDetail, getTreasuryData,
  countUsers, createResetToken, findResetToken, deleteResetToken, deleteExpiredTokens, updatePassword,
  getInvoices, getInvoice, getInvoiceLines, createInvoice, updateInvoice, issueInvoice,
  deleteInvoiceDraft, setInvoiceLines, getNextInvoiceNumber, updateInvoiceNumber, getInvoiceSeries,
  getActiveTimers, upsertTimer, clearTimer,
  createEvent, getEventStats, getRecentEvents,
  getEventsPerDay, getDailyActiveUsers, getEventsByHour,
  getNewUsersPerMonth, getAppTotals, getTopUsersByActivity
};
