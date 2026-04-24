'use strict';

const { q } = require('../pool');

const createEvent = async (userId, event, metadata) => {
  await q(
    'INSERT INTO events (user_id, event, metadata) VALUES ($1,$2,$3)',
    [userId, event, metadata ? JSON.stringify(metadata) : null]
  );
};

const getEventStats = async () => {
  const r = await q(`
    SELECT event,
      COUNT(*) as total,
      COUNT(DISTINCT user_id) as unique_users,
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as last_7d,
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 ELSE 0 END) as last_24h
    FROM events
    GROUP BY event ORDER BY total DESC
  `);
  return r.rows;
};

const getRecentEvents = async (limit = 50) => {
  const r = await q(`
    SELECT e.*, u.name as user_name
    FROM events e LEFT JOIN users u ON e.user_id = u.id
    ORDER BY e.created_at DESC LIMIT $1
  `, [limit]);
  return r.rows;
};

const getEventsPerDay = async (days = 30) => {
  const r = await q(`
    SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') as day, event, COUNT(*) as count
    FROM events
    WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
    GROUP BY TO_CHAR(created_at::date, 'YYYY-MM-DD'), event
    ORDER BY day
  `, [days]);
  return r.rows;
};

const getDailyActiveUsers = async (days = 30) => {
  const r = await q(`
    SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') as day, COUNT(DISTINCT user_id) as users
    FROM events
    WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
    GROUP BY TO_CHAR(created_at::date, 'YYYY-MM-DD')
    ORDER BY day
  `, [days]);
  return r.rows;
};

const getEventsByHour = async () => {
  const r = await q(`
    SELECT EXTRACT(HOUR FROM created_at)::integer as hour, COUNT(*) as count
    FROM events GROUP BY EXTRACT(HOUR FROM created_at)::integer ORDER BY hour
  `);
  return r.rows;
};

const getNewUsersPerMonth = async () => {
  const r = await q(`
    SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count
    FROM users
    WHERE created_at IS NOT NULL
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month DESC LIMIT 12
  `);
  return r.rows;
};

const getAppTotals = async () => {
  const r = await q(`
    SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM projects) as total_projects,
      (SELECT COUNT(*) FROM entries) as total_entries,
      (SELECT COALESCE(SUM(hours),0) FROM entries) as total_hours,
      (SELECT COUNT(*) FROM invoices) as total_invoices,
      (SELECT COUNT(*) FROM events WHERE created_at >= NOW() - INTERVAL '1 day') as events_24h,
      (SELECT COUNT(DISTINCT user_id) FROM events WHERE created_at >= NOW() - INTERVAL '1 day') as dau,
      (SELECT COUNT(DISTINCT user_id) FROM events WHERE created_at >= NOW() - INTERVAL '7 days') as wau
  `);
  return r.rows[0];
};

const getTopUsersByActivity = async (limit = 10) => {
  const r = await q(`
    SELECT u.name, u.email, u.plan, COUNT(e.id) as event_count,
      SUM(CASE WHEN e.created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as last_7d
    FROM users u LEFT JOIN events e ON u.id = e.user_id
    GROUP BY u.id, u.name, u.email, u.plan ORDER BY event_count DESC LIMIT $1
  `, [limit]);
  return r.rows;
};

module.exports = {
  createEvent, getEventStats, getRecentEvents,
  getEventsPerDay, getDailyActiveUsers, getEventsByHour,
  getNewUsersPerMonth, getAppTotals, getTopUsersByActivity
};
