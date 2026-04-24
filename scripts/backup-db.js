'use strict';

const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

// Carga .env si existe (desarrollo local)
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
} catch (_) {}

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL no está definida.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Orden respetando dependencias FK
const TABLES = [
  'users',
  'invoice_series',
  'companies',
  'projects',
  'entries',
  'timers',
  'invoices',
  'invoice_lines',
  'reset_tokens',
  'events'
];

async function run() {
  console.log('\n📦  Cronoras — Backup de base de datos');
  console.log('─'.repeat(40));

  const data   = {};
  let   total  = 0;

  for (const table of TABLES) {
    try {
      const r = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
      data[table] = r.rows;
      total += r.rows.length;
      console.log(`  ${table.padEnd(20)} ${r.rows.length} registros`);
    } catch (e) {
      console.warn(`  ${table.padEnd(20)} (tabla no encontrada — omitida)`);
      data[table] = [];
    }
  }

  const now      = new Date();
  const ts       = now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
  const filename = `backup_${ts}.json`;
  const dir      = path.join(__dirname, '..', 'backups');

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify({ created_at: now.toISOString(), tables: data }, null, 2), 'utf8');

  console.log('─'.repeat(40));
  console.log(`\n✅  Backup guardado: backups/${filename}`);
  console.log(`    Total: ${total} registros\n`);

  await pool.end();
}

run().catch(e => {
  console.error('\n❌  Error en backup:', e.message);
  process.exit(1);
});
