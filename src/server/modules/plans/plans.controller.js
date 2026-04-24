'use strict';

const db = require('../../../../database/db');
const { isEmailConfigured, sendUpgradeRequest } = require('./plans.service');

const upgrade = async (req, res) => {
  try {
    if (!isEmailConfigured()) return res.status(503).json({ error: 'Email no configurado' });
    const userId = req.session.userId;
    const user = userId ? await db.getUser(userId) : null;
    const { plan, price, period } = req.body;
    if (!plan) return res.status(400).json({ error: 'Falta el plan' });
    await sendUpgradeRequest(user, plan, price, period);
    res.json({ success: true });
  } catch (e) {
    if (e.message === 'Sin email de admin configurado') return res.status(500).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
};

module.exports = { upgrade };
