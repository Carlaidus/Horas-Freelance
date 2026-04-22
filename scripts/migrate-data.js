/**
 * Migración de datos SQLite → PostgreSQL
 * Uso: node scripts/migrate-data.js ruta/al/sqlite-export.json
 *
 * Ejecutar UNA SOLA VEZ después del primer deploy con PostgreSQL.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Uso: node scripts/migrate-data.js ruta/al/sqlite-export.json');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const q = (sql, params = []) => pool.query(sql, params);

// Inserta filas con sus IDs originales y gestiona conflictos
const insertRows = async (table, rows, columns) => {
  if (!rows || rows.length === 0) { console.log(`  ${table}: sin datos`); return; }
  let ok = 0;
  for (const row of rows) {
    const vals = columns.map(c => row[c] !== undefined ? row[c] : null);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    try {
      await q(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        vals
      );
      ok++;
    } catch (e) {
      console.warn(`  ⚠ ${table} id=${row.id}: ${e.message}`);
    }
  }
  console.log(`  ${table}: ${ok}/${rows.length} filas insertadas`);
};

// Resetea la secuencia SERIAL al máximo id existente
const resetSeq = async (table) => {
  await q(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
};

const run = async () => {
  console.log('\n🏗   Creando tablas si no existen...');
  const db = require('../database/db');
  await db.init();
  console.log('    Tablas listas.\n');

  console.log('🔄  Iniciando migración de datos...\n');

  // Orden respetando foreign keys
  await insertRows('users', data.users, [
    'id','name','email','nif','address','city','postal_code','phone','profession',
    'iva_rate','irpf_rate','iban','password_hash','email_verified','role','plan','plan_expires_at','created_at'
  ]);

  await insertRows('companies', data.companies, [
    'id','user_id','name','cif','address','city','postal_code','country','email',
    'phone','contact_person','notes','payment_days','created_at'
  ]);

  await insertRows('projects', data.projects, [
    'id','user_id','company_id','name','hourly_rate','status','invoice_number','notes',
    'budget_type','fixed_budget','is_completed','invoiced_at','expected_payment_date',
    'completed_at','purchase_order','created_at'
  ]);

  await insertRows('entries', data.entries, [
    'id','project_id','user_id','date','hours','description','hourly_rate_override','created_at'
  ]);

  await insertRows('invoice_series', data.invoice_series, [
    'id','user_id','code','description','next_number','is_active','created_at'
  ]);

  await insertRows('invoices', data.invoices, [
    'id','user_id','series_id','number','full_number','status','project_id','company_id',
    'issuer_name','issuer_nif','issuer_address','issuer_city','issuer_postal_code',
    'customer_name','customer_nif','customer_address','customer_city','customer_postal_code','customer_country',
    'issue_date','operation_date','subtotal','iva_rate','iva_exempt','iva_amount',
    'irpf_rate','irpf_amount','total','notes','issued_at','created_at','updated_at'
  ]);

  await insertRows('invoice_lines', data.invoice_lines, [
    'id','invoice_id','description','quantity','unit_price','line_total','sort_order'
  ]);

  await insertRows('reset_tokens', data.reset_tokens || [], [
    'id','user_id','token','expires_at','created_at'
  ]);

  await insertRows('timers', data.timers || [], [
    'id','user_id','project_id','is_active','is_paused','started_at','accumulated_seconds','updated_at'
  ]);

  await insertRows('events', data.events || [], [
    'id','user_id','event','metadata','created_at'
  ]);

  // Resetear todas las secuencias SERIAL
  console.log('\n🔁  Reseteando secuencias...');
  const tables = ['users','companies','projects','entries','invoice_series','invoices','invoice_lines','reset_tokens','timers','events'];
  for (const t of tables) {
    await resetSeq(t);
    console.log(`  ${t} ✓`);
  }

  // Asegurar que el usuario admin original siga siendo admin
  await q("UPDATE users SET role='admin', plan='pro' WHERE id = (SELECT MIN(id) FROM users) AND (role IS NULL OR role='user')");

  console.log('\n✅  Migración completada.\n');
  await pool.end();
};

run().catch(err => {
  console.error('\n❌  Error:', err.message);
  pool.end();
  process.exit(1);
});
