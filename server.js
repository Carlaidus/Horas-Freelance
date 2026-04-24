'use strict';

const path = require('path');

const app = require('./src/server/app');
const db  = require('./database/db');
const { PORT, REQUIRE_AUTH } = require('./src/server/config/env');
const { getUserId, getEffectivePlan, getDaysRemaining, requireAdmin } = require('./src/server/middleware/auth.middleware');
const { generateInvoicePdf }       = require('./lib/invoice-pdf');
const { generateProjectReportPdf } = require('./lib/project-report-pdf');

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

app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const invoice = await db.getInvoice(+req.params.id);
    if (!invoice) return res.status(404).json({ error: 'No encontrada' });
    const lines = await db.getInvoiceLines(invoice.id);
    generateInvoicePdf(invoice, lines, res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PROJECT REPORT PDF ────────────────────────────────────────
app.get('/api/projects/:id/report', async (req, res) => {
  try {
    const project = await db.getProject(+req.params.id);
    if (!project) return res.status(404).json({ error: 'No encontrado' });
    const entries = await db.getEntries(+req.params.id);
    const user = await db.getUser(getUserId(req));
    generateProjectReportPdf(project, entries, user, res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EXPORT ────────────────────────────────────────────────────
app.get('/api/projects/:id/export', async (req, res) => {
  try {
    const project = await db.getProject(+req.params.id);
    const entries = await db.getEntries(+req.params.id);
    const user = await db.getUser(getUserId(req));
    res.json({ project, entries, user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN ─────────────────────────────────────────────────────
app.get('/admin', async (req, res) => {
  try {
    const user = req.session.userId ? await db.getUser(req.session.userId) : null;
    if (!user || user.role !== 'admin') return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } catch (e) { res.redirect('/'); }
});

app.get('/admin/api/users', requireAdmin, async (req, res) => {
  try {
    const users = (await db.getAllUsers()).map(u => ({
      ...u,
      effective_plan: getEffectivePlan(u),
      days_remaining: getDaysRemaining(u)
    }));
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/admin/api/users/:id/plan', requireAdmin, async (req, res) => {
  try {
    const { plan, expires_at, period, is_trial } = req.body;
    if (!['free', 'basic', 'pro'].includes(plan)) return res.status(400).json({ error: 'Plan inválido' });
    await db.setUserPlan(+req.params.id, plan, expires_at || null, period || null, !!is_trial);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
