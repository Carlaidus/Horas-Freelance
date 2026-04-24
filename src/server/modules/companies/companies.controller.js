'use strict';

const db = require('../../../../database/db');
const { getUserId, getEffectivePlan } = require('../../middleware/auth.middleware');

const getCompanies = async (req, res) => {
  try { res.json(await db.getCompanies(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const createCompany = async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await db.getUser(userId);
    if (getEffectivePlan(user) === 'free') {
      const count = await db.countUserCompanies(userId);
      if (count >= 1) return res.status(403).json({ error: 'UPGRADE_REQUIRED', feature: 'companies' });
    }
    res.json({ id: await db.createCompany({ user_id: userId, ...req.body }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const updateCompany = async (req, res) => {
  try { await db.updateCompany(+req.params.id, req.body); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const deleteCompany = async (req, res) => {
  try { await db.deleteCompany(+req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getCompanies, createCompany, updateCompany, deleteCompany };
