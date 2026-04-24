'use strict';

const path = require('path');
const db = require('../../../../database/db');
const { getEffectivePlan, getDaysRemaining, requireAdmin } = require('../../middleware/auth.middleware');

const adminPage = async (req, res) => {
  try {
    const user = req.session.userId ? await db.getUser(req.session.userId) : null;
    if (!user || user.role !== 'admin') return res.redirect('/');
    res.sendFile(path.join(__dirname, '../../../../public/admin.html'));
  } catch (e) { res.redirect('/'); }
};

const getUsers = async (req, res) => {
  try {
    const users = (await db.getAllUsers()).map(u => ({
      ...u,
      effective_plan: getEffectivePlan(u),
      days_remaining: getDaysRemaining(u)
    }));
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const setUserPlan = async (req, res) => {
  try {
    const { plan, expires_at, period, is_trial } = req.body;
    if (!['free', 'basic', 'pro'].includes(plan)) return res.status(400).json({ error: 'Plan inválido' });
    await db.setUserPlan(+req.params.id, plan, expires_at || null, period || null, !!is_trial);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { adminPage, getUsers, setUserPlan, requireAdmin };
