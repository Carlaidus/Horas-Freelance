'use strict';

const db = require('../../../../database/db');
const { getUserId } = require('../../middleware/auth.middleware');

const getTimers = async (req, res) => {
  try { res.json(await db.getActiveTimers(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const startTimer = async (req, res) => {
  try {
    const userId = getUserId(req);
    const projectId = +req.params.projectId;
    const started_at = req.body.started_at || new Date().toISOString();
    await db.upsertTimer(userId, projectId, { is_active: 1, is_paused: 0, started_at, accumulated_seconds: 0 });
    res.json({ started_at });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const pauseTimer = async (req, res) => {
  try {
    const userId = getUserId(req);
    const projectId = +req.params.projectId;
    const { accumulated_seconds = 0 } = req.body;
    await db.upsertTimer(userId, projectId, { is_active: 1, is_paused: 1, started_at: null, accumulated_seconds });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const resumeTimer = async (req, res) => {
  try {
    const userId = getUserId(req);
    const projectId = +req.params.projectId;
    const { accumulated_seconds = 0 } = req.body;
    const started_at = new Date().toISOString();
    await db.upsertTimer(userId, projectId, { is_active: 1, is_paused: 0, started_at, accumulated_seconds });
    res.json({ started_at });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const clearTimer = async (req, res) => {
  try { await db.clearTimer(getUserId(req), +req.params.projectId); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getTimers, startTimer, pauseTimer, resumeTimer, clearTimer };
