'use strict';

const { q } = require('./pool');

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
      plan_period TEXT DEFAULT NULL,
      plan_expires_at DATE DEFAULT NULL,
      is_trial BOOLEAN DEFAULT false,
      plan_warning_sent BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_warning_sent BOOLEAN DEFAULT false`);

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
      sort_order INTEGER DEFAULT 0,
      project_id INTEGER DEFAULT NULL
    )
  `);

  await q(`ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS project_id INTEGER DEFAULT NULL`);

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

  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_period TEXT DEFAULT NULL`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS annual_goal INTEGER DEFAULT 50000`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_goal INTEGER DEFAULT 4000`);
};

module.exports = { init };
