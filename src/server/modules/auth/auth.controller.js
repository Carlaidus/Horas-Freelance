'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const db = require('../../../../database/db');
const { REQUIRE_AUTH, PASSWORD_REGEX, PASSWORD_HINT } = require('../../config/env');
const { getEffectivePlan, getDaysRemaining } = require('../../middleware/auth.middleware');
const { sendExpiryWarning, sendRegistrationEmail, sendPasswordResetEmail } = require('./auth.service');

const me = async (req, res) => {
  try {
    const user = req.session.userId ? await db.getUser(req.session.userId) : null;
    const effectivePlan = getEffectivePlan(user);
    const daysLeft = getDaysRemaining(user);

    if (user && effectivePlan === 'pro' && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && !user.plan_warning_sent) {
      db.setWarningFlag(user.id).catch(() => {});
      sendExpiryWarning(user, daysLeft);
    }

    res.json({
      userId: req.session.userId || null,
      requireAuth: REQUIRE_AUTH,
      authenticated: !!req.session.userId,
      role: user?.role || 'user',
      plan: effectivePlan,
      planPeriod: effectivePlan === 'free' ? null : (user?.plan_period || null),
      daysRemaining: daysLeft,
      isTrial: !!(user?.is_trial && effectivePlan === 'pro')
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const hasUsers = async (req, res) => {
  try { res.json({ hasUsers: await db.countUsers() > 0 }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
    if (!PASSWORD_REGEX.test(password)) return res.status(400).json({ error: PASSWORD_HINT });
    if (await db.findUserByEmail(email)) return res.status(400).json({ error: 'Ese email ya está registrado' });
    const hash = bcrypt.hashSync(password, 10);
    const userId = await db.createAuthUser({ name, email, password_hash: hash });
    req.session.userId = userId;
    sendRegistrationEmail(name, email);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.findUserByEmail(email);
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    req.session.userId = user.id;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const logout = (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Falta el email' });
    const user = await db.findUserByEmail(email);
    if (!user) return res.json({ success: true }); // no revelar si existe
    await db.deleteExpiredTokens();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.createResetToken(user.id, token, expiresAt);
    await sendPasswordResetEmail(user, token);
    res.json({ success: true });
  } catch (e) {
    if (e.message === 'Servicio de email no configurado') return res.status(503).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
};

const resetPassword = async (req, res) => {
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
};

module.exports = { me, hasUsers, register, login, logout, forgotPassword, resetPassword };
