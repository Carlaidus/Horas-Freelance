const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const db = require('./database/db');
const { Resend } = require('resend');
const { generateInvoicePdf } = require('./lib/invoice-pdf');
const { generateProjectReportPdf } = require('./lib/project-report-pdf');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const FROM_EMAIL = process.env.RESEND_FROM || 'onboarding@resend.dev';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_HINT = 'Mínimo 8 caracteres, una mayúscula, un número y un símbolo';

const app = express();
const PORT = process.env.PORT || 3000;
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'vfxhours-local-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ── AUTH MIDDLEWARE ────────────────────────────────────────────
const getUserId = (req) => req.session.userId || 1;

const getEffectivePlan = (user) => {
  if (!user) return 'free';
  if (user.role === 'admin') return 'pro';
  if (!user.plan || user.plan === 'free') return 'free';
  if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) return 'free';
  return user.plan;
};

const getDaysRemaining = (user) => {
  if (!user || user.role === 'admin' || !user.plan_expires_at || user.plan === 'free') return null;
  const diff = Math.ceil((new Date(user.plan_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await db.getUser(getUserId(req));
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

app.use((req, res, next) => {
  const isPublic = req.path === '/login.html' || req.path === '/reset-password.html'
    || req.path.startsWith('/api/auth/') || req.path.startsWith('/css/')
    || req.path.startsWith('/js/');
  if (!REQUIRE_AUTH || isPublic || req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autenticado' });
  res.redirect('/login.html');
});

// ── AUTH ROUTES ────────────────────────────────────────────────
app.get('/api/auth/me', async (req, res) => {
  try {
    const user = req.session.userId ? await db.getUser(req.session.userId) : null;
    res.json({
      userId: req.session.userId || null,
      requireAuth: REQUIRE_AUTH,
      authenticated: !!req.session.userId,
      role: user?.role || 'user',
      plan: getEffectivePlan(user),
      daysRemaining: getDaysRemaining(user)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/has-users', async (req, res) => {
  try { res.json({ hasUsers: await db.countUsers() > 0 }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
    if (!PASSWORD_REGEX.test(password)) return res.status(400).json({ error: PASSWORD_HINT });
    if (await db.findUserByEmail(email)) return res.status(400).json({ error: 'Ese email ya está registrado' });
    const hash = bcrypt.hashSync(password, 10);
    const userId = await db.createAuthUser({ name, email, password_hash: hash });
    req.session.userId = userId;

    // Notificar al admin del nuevo registro
    if (resend) {
      const adminEmail = process.env.ADMIN_EMAIL || await db.getAdminEmail();
      if (adminEmail) {
        resend.emails.send({
          from: FROM_EMAIL,
          to: adminEmail,
          subject: `Nuevo usuario registrado — ${name}`,
          html: `<div style="font-family:sans-serif;padding:24px;background:#06060f;color:#dde0f5;border-radius:12px">
            <h2 style="color:#f5c842">Nuevo registro en VFX Hours</h2>
            <p><strong>Nombre:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p style="color:#888;font-size:12px">Plan: Free — activa Pro desde el panel de administración si ha realizado el pago.</p>
          </div>`
        }).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.findUserByEmail(email);
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    req.session.userId = user.id;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Falta el email' });
    const user = await db.findUserByEmail(email);
    if (!user) return res.json({ success: true });
    if (!resend) return res.status(503).json({ error: 'Servicio de email no configurado' });

    await db.deleteExpiredTokens();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.createResetToken(user.id, token, expiresAt);

    const resetUrl = `${APP_URL}/reset-password.html?token=${token}`;
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Restablecer contraseña — VFX Hours',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#06060f;color:#dde0f5;padding:32px;border-radius:12px">
          <h2 style="color:#f5c842;margin-bottom:16px">VFX Hours Tracker</h2>
          <p style="margin-bottom:24px">Hola ${user.name || 'compositor'},<br><br>
          Recibimos una solicitud para restablecer tu contraseña.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#f5c842;color:#000;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none">Restablecer contraseña</a>
          <p style="margin-top:24px;color:#555580;font-size:12px">Este enlace caduca en 1 hora. Si no solicitaste esto, ignora este email.</p>
        </div>
      `
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Faltan datos' });
    if (!PASSWORD_REGEX.test(password)) return res.status(400).json({ error: PASSWORD_HINT });
    const record = await db.findResetToken(token);
    if (!record) return res.status(400).json({ error: 'Enlace inválido o caducado' });
    const hash = bcrypt.hashSync(password, 10);
    await db.updatePassword(record.user_id, hash);
    await db.deleteResetToken(token);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
  try { res.json(await db.getProjectStatsDetail(+req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
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
    const { plan, expires_at } = req.body;
    if (!['free', 'basic', 'pro'].includes(plan)) return res.status(400).json({ error: 'Plan inválido' });
    await db.setUserPlan(+req.params.id, plan, expires_at || null);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname, 'public')));

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
