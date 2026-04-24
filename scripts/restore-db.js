'use strict';

const { Pool }    = require('pg');
const fs          = require('fs');
const path        = require('path');
const readline    = require('readline');

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

// Orden de inserción respetando FK
const TABLES_INSERT = [
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

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function run() {
  const backupFile = process.argv[2];

  if (!backupFile) {
    console.error('\n❌  Debes indicar la ruta al backup.');
    console.error('    Uso: npm run restore -- backups/backup_2025-01-01_12-00-00.json\n');
    process.exit(1);
  }

  const filepath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(process.cwd(), backupFile);

  if (!fs.existsSync(filepath)) {
    console.error(`\n❌  Archivo no encontrado: ${filepath}\n`);
    process.exit(1);
  }

  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    console.error(`\n❌  No se pudo leer el backup: ${e.message}\n`);
    process.exit(1);
  }

  if (!backup.tables) {
    console.error('\n❌  El archivo no tiene el formato esperado.\n');
    process.exit(1);
  }

  // Mostrar resumen del backup
  console.log('\n📦  Cronoras — Restauración de base de datos');
  console.log('─'.repeat(44));
  console.log(`  Backup creado: ${backup.created_at}`);
  console.log(`  Archivo:       ${path.basename(filepath)}\n`);
  console.log('  Registros en el backup:');

  let total = 0;
  for (const table of TABLES_INSERT) {
    const rows = backup.tables[table] || [];
    console.log(`    ${table.padEnd(20)} ${rows.length}`);
    total += rows.length;
  }
  console.log(`\n  Total: ${total} registros`);

  console.log('\n' + '─'.repeat(44));
  console.log('  ⚠️   ADVERTENCIA');
  console.log('  Esta operación BORRARÁ todos los datos actuales');
  console.log('  de la base de datos y los reemplazará por los');
  console.log('  del backup. Esta acción NO se puede deshacer.');
  console.log('─'.repeat(44) + '\n');

  const ans1 = await ask('  ¿Confirmas? Escribe "si" para continuar: ');
  if (ans1.toLowerCase() !== 'si') {
    console.log('\n  Restauración cancelada.\n');
    process.exit(0);
  }

  const ans2 = await ask('  Segunda confirmación — escribe "RESTAURAR": ');
  if (ans2 !== 'RESTAURAR') {
    console.log('\n  Restauración cancelada.\n');
    process.exit(0);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('\n  Iniciando restauración...\n');
    await client.query('BEGIN');

    // Vaciar todas las tablas en una sola instrucción (CASCADE gestiona las FK)
    await client.query(`
      TRUNCATE ${TABLES_INSERT.join(', ')} RESTART IDENTITY CASCADE
    `);

    // Insertar en orden correcto
    for (const table of TABLES_INSERT) {
      const rows = backup.tables[table] || [];
      if (rows.length === 0) {
        console.log(`  ⏭   ${table.padEnd(20)} (vacío)`);
        continue;
      }

      const cols   = Object.keys(rows[0]);
      const colSql = cols.map(c => `"${c}"`).join(', ');

      for (const row of rows) {
        const valSql = cols.map((_, i) => `$${i + 1}`).join(', ');
        const values = cols.map(c => row[c]);
        await client.query(
          `INSERT INTO ${table} (${colSql}) VALUES (${valSql})`,
          values
        );
      }

      // Resetear secuencia al máximo id insertado
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('${table}', 'id'),
          COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1,
          false
        )
      `);

      console.log(`  ✓   ${table.padEnd(20)} ${rows.length} registros`);
    }

    await client.query('COMMIT');

    console.log('\n' + '─'.repeat(44));
    console.log('  ✅  Restauración completada con éxito.\n');

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('\n  ❌  Error durante restauración — rollback aplicado.');
    console.error(`      ${e.message}\n`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error('\n❌  Error inesperado:', e.message);
  process.exit(1);
});
