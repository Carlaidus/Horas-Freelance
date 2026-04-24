'use strict';

const db = require('../../../../database/db');
const { getUserId } = require('../../middleware/auth.middleware');

const getUser = async (req, res) => {
  try { res.json(await db.getUser(getUserId(req)) || {}); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const saveUser = async (req, res) => {
  try { await db.saveUser({ id: getUserId(req), ...req.body }); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getUser, saveUser };
