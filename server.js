'use strict';

const app = require('./src/server/app');
const db  = require('./database/db');
const { PORT, REQUIRE_AUTH } = require('./src/server/config/env');

// ── AUTH ───────────────────────────────────────────────────────
app.use('/api/auth', require('./src/server/modules/auth/auth.routes'));

// ── PLANS / CONTACT ───────────────────────────────────────────
app.use('/api/contact', require('./src/server/modules/plans/plans.routes'));

// ── USER ──────────────────────────────────────────────────────
app.use('/api/user', require('./src/server/modules/users/users.routes'));

// ── COMPANIES ─────────────────────────────────────────────────
app.use('/api/companies', require('./src/server/modules/companies/companies.routes'));

// ── PROJECTS ──────────────────────────────────────────────────
app.use('/api/projects', require('./src/server/modules/projects/projects.routes'));

// ── ENTRIES ───────────────────────────────────────────────────
app.use('/', require('./src/server/modules/entries/entries.routes'));

// ── ANALYTICS ─────────────────────────────────────────────────
app.use('/', require('./src/server/modules/analytics/analytics.routes'));

// ── TIMERS ────────────────────────────────────────────────────
app.use('/api/timers', require('./src/server/modules/timers/timers.routes'));

// ── STATS ─────────────────────────────────────────────────────
app.use('/api/stats', require('./src/server/modules/stats/stats.routes'));

// ── INVOICES ──────────────────────────────────────────────────
app.use('/api/invoices', require('./src/server/modules/invoices/invoices.routes'));

// ── ADMIN ─────────────────────────────────────────────────────
app.use('/', require('./src/server/modules/admin/admin.routes'));

// ── BOOT ──────────────────────────────────────────────────────
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🎬  FreelanceVFX Tracker`);
    console.log(`    http://localhost:${PORT}`);
    console.log(`    Auth: ${REQUIRE_AUTH ? '🔐 ACTIVA' : '🔓 local (sin login)'}\n`);
  });
}).catch(err => {
  console.error('Database init failed:', err);
  process.exit(1);
});
