'use strict';

const path = require('path');

const app = require('./src/server/app');
const db  = require('./database/db');
const { PORT, REQUIRE_AUTH } = require('./src/server/config/env');
const { getUserId, getEffectivePlan, requireAdmin } = require('./src/server/middleware/auth.middleware');
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
app.post('/api/track', async (req, res) => {
  try {
    const { event, metadata } = req.body;
    if (event) await db.createEvent(getUserId(req), event, metadata);
    res.json({ ok: true });
  } catch (_) { res.json({ ok: true }); }
});

app.get('/admin/api/events', requireAdmin, async (req, res) => {
  try { res.json({ stats: await db.getEventStats(), recent: await db.getRecentEvents(100) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/api/analytics', requireAdmin, async (req, res) => {
  try {
    const [totals, eventsPerDay, dailyActiveUsers, eventsByHour, newUsersPerMonth, topUsers, eventStats, recentEvents] = await Promise.all([
      db.getAppTotals(),
      db.getEventsPerDay(30),
      db.getDailyActiveUsers(30),
      db.getEventsByHour(),
      db.getNewUsersPerMonth(),
      db.getTopUsersByActivity(10),
      db.getEventStats(),
      db.getRecentEvents(500)
    ]);
    res.json({ totals, eventsPerDay, dailyActiveUsers, eventsByHour, newUsersPerMonth, topUsers, eventStats, recentEvents });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TIMERS ────────────────────────────────────────────────────
app.get('/api/timers', async (req, res) => {
  try { res.json(await db.getActiveTimers(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/timers/:projectId/start', async (req, res) => {
  try {
    const userId = getUserId(req);
    const projectId = +req.params.projectId;
    const started_at = req.body.started_at || new Date().toISOString();
    await db.upsertTimer(userId, projectId, { is_active: 1, is_paused: 0, started_at, accumulated_seconds: 0 });
    res.json({ started_at });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/timers/:projectId/pause', async (req, res) => {
  try {
    const userId = getUserId(req);
    const projectId = +req.params.projectId;
    const { accumulated_seconds = 0 } = req.body;
    await db.upsertTimer(userId, projectId, { is_active: 1, is_paused: 1, started_at: null, accumulated_seconds });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/timers/:projectId/resume', async (req, res) => {
  try {
    const userId = getUserId(req);
    const projectId = +req.params.projectId;
    const { accumulated_seconds = 0 } = req.body;
    const started_at = new Date().toISOString();
    await db.upsertTimer(userId, projectId, { is_active: 1, is_paused: 0, started_at, accumulated_seconds });
    res.json({ started_at });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/timers/:projectId', async (req, res) => {
  try { await db.clearTimer(getUserId(req), +req.params.projectId); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STATS ─────────────────────────────────────────────────────
app.get('/api/stats/monthly', async (req, res) => {
  try {
    const { from, to, group } = req.query;
    if (from && to) return res.json(await db.getMonthlyStatsRange(getUserId(req), from, to, group || 'month'));
    res.json(await db.getMonthlyStats(getUserId(req)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/heatmap', async (req, res) => {
  try { res.json(await db.getHeatmapData(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/clients', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (from && to) return res.json(await db.getClientStatsRange(getUserId(req), from, to));
    res.json(await db.getClientStats(getUserId(req)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (from && to) return res.json(await db.getSummaryRange(getUserId(req), from, to));
    res.json(await db.getYearlySummary(getUserId(req)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/project/:id', async (req, res) => {
  try {
    const { from, to, group } = req.query;
    res.json(await db.getProjectStatsDetail(+req.params.id, from, to, group || 'month'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/treasury', async (req, res) => {
  try { res.json(await db.getTreasuryData(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── INVOICES ──────────────────────────────────────────────────
app.get('/api/invoices', async (req, res) => {
  try { res.json(await db.getInvoices(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/next-number', async (req, res) => {
  try { res.json({ number: await db.getNextInvoiceNumber(getUserId(req)) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const invoice = await db.getInvoice(+req.params.id);
    if (!invoice) return res.status(404).json({ error: 'No encontrada' });
    const lines = await db.getInvoiceLines(invoice.id);
    res.json({ ...invoice, lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const { lines = [], ...data } = req.body;
    const id = await db.createInvoice({ user_id: getUserId(req), ...data });
    if (lines.length) await db.setInvoiceLines(id, lines);
    res.json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const { lines = [], ...data } = req.body;
    await db.updateInvoice(+req.params.id, data);
    await db.setInvoiceLines(+req.params.id, lines);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/invoices/:id/issue', async (req, res) => {
  try {
    const invoice = await db.issueInvoice(+req.params.id, getUserId(req));
    res.json(invoice);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try { await db.deleteInvoiceDraft(+req.params.id); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

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
