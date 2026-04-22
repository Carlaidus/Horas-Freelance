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
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 días
}));

// ── AUTH MIDDLEWARE ────────────────────────────────────────────
const getUserId = (req) => req.session.userId || 1;

const getEffectivePlan = (user) => {
  if (!user) return 'free';
  if (user.role === 'admin') return user.plan || 'pro';
  if (!user.plan || user.plan === 'free') return 'free';
  if (!user.plan_expires_at) return user.plan;
  return new Date(user.plan_expires_at) >= new Date() ? user.plan : 'free';
};

const getDaysRemaining = (user) => {
  if (!user || user.role === 'admin' || !user.plan_expires_at || user.plan === 'free') return null;
  return Math.ceil((new Date(user.plan_expires_at) - new Date()) / 86400000);
};

const requireAdmin = (req, res, next) => {
  const user = db.getUser(getUserId(req));
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

app.use((req, res, next) => {
  const isPublic = req.path === '/login.html' || req.path === '/reset-password.html' || req.path.startsWith('/api/auth/') || req.path.startsWith('/css/') || req.path.startsWith('/js/');
  if (!REQUIRE_AUTH || isPublic || req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autenticado' });
  res.redirect('/login.html');
});

// ── AUTH ROUTES ────────────────────────────────────────────────
app.get('/api/auth/me', (req, res) => {
  const user = req.session.userId ? db.getUser(req.session.userId) : null;
  const effectivePlan = getEffectivePlan(user);
  const daysRemaining = getDaysRemaining(user);
  res.json({
    userId: req.session.userId || null,
    requireAuth: REQUIRE_AUTH,
    authenticated: !!req.session.userId,
    role: user?.role || 'user',
    plan: effectivePlan,
    daysRemaining
  });
});

app.get('/api/auth/has-users', (req, res) => {
  res.json({ hasUsers: db.countUsers() > 0 });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (!PASSWORD_REGEX.test(password)) return res.status(400).json({ error: PASSWORD_HINT });
  if (db.findUserByEmail(email)) return res.status(400).json({ error: 'Ese email ya está registrado' });
  const hash = bcrypt.hashSync(password, 10);
  const userId = db.createAuthUser({ name, email, password_hash: hash });
  req.session.userId = userId;
  res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.findUserByEmail(email);
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  req.session.userId = user.id;
  res.json({ success: true });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Falta el email' });
  const user = db.findUserByEmail(email);
  // Always return success to avoid user enumeration
  if (!user) return res.json({ success: true });
  if (!resend) return res.status(503).json({ error: 'Servicio de email no configurado' });

  db.deleteExpiredTokens();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  db.createResetToken(user.id, token, expiresAt);

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
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Faltan datos' });
  if (!PASSWORD_REGEX.test(password)) return res.status(400).json({ error: PASSWORD_HINT });
  const record = db.findResetToken(token);
  if (!record) return res.status(400).json({ error: 'Enlace inválido o caducado' });
  const hash = bcrypt.hashSync(password, 10);
  db.updatePassword(record.user_id, hash);
  db.deleteResetToken(token);
  res.json({ success: true });
});

// ── USER ──────────────────────────────────────────────────────
app.get('/api/user', (req, res) => res.json(db.getUser(getUserId(req)) || {}));
app.put('/api/user', (req, res) => {
  db.saveUser({ id: getUserId(req), ...req.body });
  res.json({ success: true });
});

// ── COMPANIES ─────────────────────────────────────────────────
app.get('/api/companies', (req, res) => res.json(db.getCompanies(getUserId(req))));
app.post('/api/companies', (req, res) => res.json({ id: db.createCompany({ user_id: getUserId(req), ...req.body }) }));
app.put('/api/companies/:id', (req, res) => { db.updateCompany(+req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/companies/:id', (req, res) => { db.deleteCompany(+req.params.id); res.json({ success: true }); });

// ── PROJECTS ──────────────────────────────────────────────────
const ownProject = (req, res) => {
  const p = db.getProject(+req.params.id);
  if (!p || p.user_id !== getUserId(req)) { res.status(404).json({ error: 'No encontrado' }); return null; }
  return p;
};
app.get('/api/projects', (req, res) => res.json(db.getProjects(getUserId(req))));
app.get('/api/projects/:id', (req, res) => { const p = ownProject(req, res); if (p) res.json(p); });
app.post('/api/projects', (req, res) => res.json({ id: db.createProject({ user_id: getUserId(req), ...req.body }) }));
app.put('/api/projects/:id', (req, res) => { if (!ownProject(req, res)) return; db.updateProject(+req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/projects/:id', (req, res) => { if (!ownProject(req, res)) return; db.deleteProject(+req.params.id); res.json({ success: true }); });

// ── ENTRIES ───────────────────────────────────────────────────
app.get('/api/projects/:id/entries', (req, res) => { if (!ownProject(req, res)) return; res.json(db.getEntries(+req.params.id)); });
app.post('/api/entries', (req, res) => res.json({ id: db.createEntry({ user_id: getUserId(req), ...req.body }) }));
app.put('/api/entries/:id', (req, res) => { db.updateEntry(+req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/entries/:id', (req, res) => { db.deleteEntry(+req.params.id); res.json({ success: true }); });

// ── ANALYTICS ─────────────────────────────────────────────────
app.post('/api/track', (req, res) => {
  const { event, metadata } = req.body;
  if (event) db.createEvent(getUserId(req), event, metadata);
  res.json({ ok: true });
});

app.get('/admin/api/events', requireAdmin, (req, res) => {
  res.json({ stats: db.getEventStats(), recent: db.getRecentEvents(100) });
});

app.get('/admin/api/analytics', requireAdmin, (req, res) => {
  res.json({
    totals: db.getAppTotals(),
    eventsPerDay: db.getEventsPerDay(30),
    dailyActiveUsers: db.getDailyActiveUsers(30),
    eventsByHour: db.getEventsByHour(),
    newUsersPerMonth: db.getNewUsersPerMonth(),
    topUsers: db.getTopUsersByActivity(10),
    eventStats: db.getEventStats(),
    recentEvents: db.getRecentEvents(500)
  });
});

// ── TIMERS ────────────────────────────────────────────────────
app.get('/api/timers', (req, res) => {
  res.json(db.getActiveTimers(getUserId(req)));
});

app.post('/api/timers/:projectId/start', (req, res) => {
  const userId = getUserId(req);
  const projectId = +req.params.projectId;
  const started_at = req.body.started_at || new Date().toISOString();
  db.upsertTimer(userId, projectId, { is_active: 1, is_paused: 0, started_at, accumulated_seconds: 0 });
  res.json({ started_at });
});

app.post('/api/timers/:projectId/pause', (req, res) => {
  const userId = getUserId(req);
  const projectId = +req.params.projectId;
  const { accumulated_seconds = 0 } = req.body;
  db.upsertTimer(userId, projectId, { is_active: 1, is_paused: 1, started_at: null, accumulated_seconds });
  res.json({ success: true });
});

app.post('/api/timers/:projectId/resume', (req, res) => {
  const userId = getUserId(req);
  const projectId = +req.params.projectId;
  const { accumulated_seconds = 0 } = req.body;
  const started_at = new Date().toISOString();
  db.upsertTimer(userId, projectId, { is_active: 1, is_paused: 0, started_at, accumulated_seconds });
  res.json({ started_at });
});

app.delete('/api/timers/:projectId', (req, res) => {
  db.clearTimer(getUserId(req), +req.params.projectId);
  res.json({ success: true });
});

// ── STATS ─────────────────────────────────────────────────────
app.get('/api/stats/monthly', (req, res) => {
  const { from, to, group } = req.query;
  if (from && to) return res.json(db.getMonthlyStatsRange(getUserId(req), from, to, group || 'month'));
  res.json(db.getMonthlyStats(getUserId(req)));
});
app.get('/api/stats/heatmap', (req, res) => res.json(db.getHeatmapData(getUserId(req))));
app.get('/api/stats/clients', (req, res) => {
  const { from, to } = req.query;
  if (from && to) return res.json(db.getClientStatsRange(getUserId(req), from, to));
  res.json(db.getClientStats(getUserId(req)));
});
app.get('/api/stats/summary', (req, res) => {
  const { from, to } = req.query;
  if (from && to) return res.json(db.getSummaryRange(getUserId(req), from, to));
  res.json(db.getYearlySummary(getUserId(req)));
});
app.get('/api/stats/project/:id', (req, res) => res.json(db.getProjectStatsDetail(+req.params.id)));
app.get('/api/stats/treasury', (req, res) => res.json(db.getTreasuryData(getUserId(req))));

// ── INVOICES ──────────────────────────────────────────────────
app.get('/api/invoices', (req, res) => res.json(db.getInvoices(getUserId(req))));
app.get('/api/invoices/next-number', (req, res) => res.json({ number: db.getNextInvoiceNumber(getUserId(req)) }));

app.get('/api/invoices/:id', (req, res) => {
  const invoice = db.getInvoice(+req.params.id);
  if (!invoice) return res.status(404).json({ error: 'No encontrada' });
  const lines = db.getInvoiceLines(invoice.id);
  res.json({ ...invoice, lines });
});

app.post('/api/invoices', (req, res) => {
  const { lines = [], ...data } = req.body;
  const id = db.createInvoice({ user_id: getUserId(req), ...data });
  if (lines.length) db.setInvoiceLines(id, lines);
  res.json({ id });
});

app.put('/api/invoices/:id', (req, res) => {
  try {
    const { lines = [], ...data } = req.body;
    db.updateInvoice(+req.params.id, data);
    db.setInvoiceLines(+req.params.id, lines);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/invoices/:id/issue', (req, res) => {
  try {
    const invoice = db.issueInvoice(+req.params.id, getUserId(req));
    res.json(invoice);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/invoices/:id', (req, res) => {
  try {
    db.deleteInvoiceDraft(+req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/invoices/:id/pdf', (req, res) => {
  try {
    const invoice = db.getInvoice(+req.params.id);
    if (!invoice) return res.status(404).json({ error: 'No encontrada' });
    const lines = db.getInvoiceLines(invoice.id);
    generateInvoicePdf(invoice, lines, res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PROJECT REPORT PDF ────────────────────────────────────────
app.get('/api/projects/:id/report', (req, res) => {
  try {
    const project = db.getProject(+req.params.id);
    if (!project) return res.status(404).json({ error: 'No encontrado' });
    const entries = db.getEntries(+req.params.id);
    const user = db.getUser(getUserId(req));
    generateProjectReportPdf(project, entries, user, res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EXPORT ────────────────────────────────────────────────────
app.get('/api/projects/:id/export', (req, res) => {
  const project = db.getProject(+req.params.id);
  const entries = db.getEntries(+req.params.id);
  const user = db.getUser(getUserId(req));
  res.json({ project, entries, user });
});

// ── ADMIN ─────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  const user = req.session.userId ? db.getUser(req.session.userId) : null;
  if (!user || user.role !== 'admin') return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/api/users', requireAdmin, (req, res) => {
  const users = db.getAllUsers().map(u => ({
    ...u,
    effective_plan: getEffectivePlan(u),
    days_remaining: getDaysRemaining(u)
  }));
  res.json(users);
});

app.put('/admin/api/users/:id/plan', requireAdmin, (req, res) => {
  const { plan, expires_at } = req.body;
  if (!['free', 'basic', 'pro'].includes(plan)) return res.status(400).json({ error: 'Plan inválido' });
  db.setUserPlan(+req.params.id, plan, expires_at || null);
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\n🎬  FreelanceVFX Tracker`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`    Auth: ${REQUIRE_AUTH ? '🔐 ACTIVA' : '🔓 local (sin login)'}\n`);
});
