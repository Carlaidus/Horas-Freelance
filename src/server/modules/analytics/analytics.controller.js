'use strict';

const db = require('../../../../database/db');
const { getUserId } = require('../../middleware/auth.middleware');

const track = async (req, res) => {
  try {
    const { event, metadata } = req.body;
    if (event) await db.createEvent(getUserId(req), event, metadata);
    res.json({ ok: true });
  } catch (_) { res.json({ ok: true }); }
};

const events = async (req, res) => {
  try { res.json({ stats: await db.getEventStats(), recent: await db.getRecentEvents(100) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const analytics = async (req, res) => {
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
};

module.exports = { track, events, analytics };
