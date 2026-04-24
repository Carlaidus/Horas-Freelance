'use strict';

const app = require('./src/server/app');
const db  = require('./database/db');
const { PORT, REQUIRE_AUTH } = require('./src/server/config/env');
const { getUserId, getEffectivePlan, requireAdmin } = require('./src/server/middleware/auth.middleware');
const { generateInvoicePdf }       = require('./lib/invoice-pdf');
const { generateProjectReportPdf } = require('./lib/project-report-pdf');

// ── AUTH ───────────────────────────────────────────────────────
app.use('/api/auth', require('./src/server/modules/auth/auth.routes'));

// ── USER ──────────────────────────────────────────────────────
app.get('/api/user', async (req, res) => {
  try { res.json(await db.getUser(getUserId(req)) || {}); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/user', async (req, res) => {
  try { await db.saveUser({ id: getUserId(req), ...req.body }); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── COMPANIES ─────────────────────────────────────────────────
app.get('/api/companies', async (req, res) => {
  try { res.json(await db.getCompanies(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/companies', async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await db.getUser(userId);
    if (getEffectivePlan(user) === 'free') {
      const count = await db.countUserCompanies(userId);
      if (count >= 1) return res.status(403).json({ error: 'UPGRADE_REQUIRED', feature: 'companies' });
    }
    res.json({ id: await db.createCompany({ user_id: userId, ...req.body }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/companies/:id', async (req, res) => {
  try { await db.updateCompany(+req.params.id, req.body); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/companies/:id', async (req, res) => {
  try { await db.deleteCompany(+req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PROJECTS ──────────────────────────────────────────────────
const ownProject = async (req, res) => {
  const p = await db.getProject(+req.params.id);
  if (!p || p.user_id !== getUserId(req)) {
    res.status(404).json({ error: 'No encontrado' });
    return null;
  }
  return p;
};

app.post('/api/contact/upgrade', async (req, res) => {
  try {
    if (!resend) return res.status(503).json({ error: 'Email no configurado' });
    const userId = req.session.userId;
    const user = userId ? await db.getUser(userId) : null;
    const { plan, price, period } = req.body;
    if (!plan) return res.status(400).json({ error: 'Falta el plan' });

    const userName = user?.name || 'Usuario';
    const userEmail = user?.email || '—';
    const adminEmail = process.env.ADMIN_EMAIL || await db.getAdminEmail();
    if (!adminEmail) return res.status(500).json({ error: 'Sin email de admin configurado' });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `Solicitud de activación: ${plan} — ${userName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#06060f;color:#dde0f5;padding:32px;border-radius:12px">
          <h2 style="color:#f5c842;margin-bottom:4px">Cronoras — Solicitud de upgrade</h2>
          <p style="color:#555580;font-size:12px;margin-bottom:24px">Recibida desde la app</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#888;width:120px">Usuario</td><td style="color:#dde0f5;font-weight:600">${userName}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Email</td><td style="color:#dde0f5">${userEmail}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Plan</td><td style="color:#f5c842;font-weight:700">${plan}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Precio</td><td style="color:#dde0f5;font-weight:600">${price || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Periodo</td><td style="color:#dde0f5">${period || '—'}</td></tr>
          </table>
          <p style="margin-top:24px;padding:14px 16px;background:rgba(245,200,66,0.08);border:1px solid rgba(245,200,66,0.2);border-radius:8px;font-size:13px;color:#aaa">
            Activa el plan desde el <strong style="color:#f5c842">Panel Admin</strong> una vez recibido el pago.
          </p>
        </div>
      `
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects', async (req, res) => {
  try { res.json(await db.getProjects(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:id', async (req, res) => {
  try { const p = await ownProject(req, res); if (p) res.json(p); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/projects', async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await db.getUser(userId);
    if (getEffectivePlan(user) === 'free') {
      const count = await db.countUserProjects(userId);
      if (count >= 1) return res.status(403).json({ error: 'UPGRADE_REQUIRED', feature: 'projects' });
    }
    res.json({ id: await db.createProject({ user_id: userId, ...req.body }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    if (!await ownProject(req, res)) return;
    await db.updateProject(+req.params.id, req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    if (!await ownProject(req, res)) return;
    await db.deleteProject(+req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ENTRIES ───────────────────────────────────────────────────
app.get('/api/projects/:id/entries', async (req, res) => {
  try {
    if (!await ownProject(req, res)) return;
    res.json(await db.getEntries(+req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/entries', async (req, res) => {
  try { res.json({ id: await db.createEntry({ user_id: getUserId(req), ...req.body }) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/entries/:id', async (req, res) => {
  try { await db.updateEntry(+req.params.id, req.body); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/entries/:id', async (req, res) => {
  try { await db.deleteEntry(+req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

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
