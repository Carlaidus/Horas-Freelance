const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database/db');

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

app.use((req, res, next) => {
  const isPublic = req.path === '/login.html' || req.path.startsWith('/api/auth/') || req.path.startsWith('/css/') || req.path.startsWith('/js/');
  if (!REQUIRE_AUTH || isPublic || req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autenticado' });
  res.redirect('/login.html');
});

// ── AUTH ROUTES ────────────────────────────────────────────────
app.get('/api/auth/me', (req, res) => {
  if (REQUIRE_AUTH && !req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  res.json({ userId: getUserId(req), requireAuth: REQUIRE_AUTH });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
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
app.get('/api/projects', (req, res) => res.json(db.getProjects(getUserId(req))));
app.get('/api/projects/:id', (req, res) => res.json(db.getProject(+req.params.id)));
app.post('/api/projects', (req, res) => res.json({ id: db.createProject({ user_id: getUserId(req), ...req.body }) }));
app.put('/api/projects/:id', (req, res) => { db.updateProject(+req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/projects/:id', (req, res) => { db.deleteProject(+req.params.id); res.json({ success: true }); });

// ── ENTRIES ───────────────────────────────────────────────────
app.get('/api/projects/:id/entries', (req, res) => res.json(db.getEntries(+req.params.id)));
app.post('/api/entries', (req, res) => res.json({ id: db.createEntry({ user_id: getUserId(req), ...req.body }) }));
app.put('/api/entries/:id', (req, res) => { db.updateEntry(+req.params.id, req.body); res.json({ success: true }); });
app.delete('/api/entries/:id', (req, res) => { db.deleteEntry(+req.params.id); res.json({ success: true }); });

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

// ── EXPORT ────────────────────────────────────────────────────
app.get('/api/projects/:id/export', (req, res) => {
  const project = db.getProject(+req.params.id);
  const entries = db.getEntries(+req.params.id);
  const user = db.getUser(getUserId(req));
  res.json({ project, entries, user });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\n🎬  FreelanceVFX Tracker`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`    Auth: ${REQUIRE_AUTH ? '🔐 ACTIVA' : '🔓 local (sin login)'}\n`);
});
