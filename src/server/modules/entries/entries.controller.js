'use strict';

const db = require('../../../../database/db');
const { getUserId } = require('../../middleware/auth.middleware');
const { ownProject } = require('../projects/projects.controller');

const getEntries = async (req, res) => {
  try {
    if (!await ownProject(req, res)) return;
    res.json(await db.getEntries(+req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const createEntry = async (req, res) => {
  try { res.json({ id: await db.createEntry({ user_id: getUserId(req), ...req.body }) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const updateEntry = async (req, res) => {
  try { await db.updateEntry(+req.params.id, req.body); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const deleteEntry = async (req, res) => {
  try { await db.deleteEntry(+req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getEntries, createEntry, updateEntry, deleteEntry };
