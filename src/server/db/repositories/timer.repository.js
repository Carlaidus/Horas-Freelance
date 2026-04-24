'use strict';

const { q } = require('../pool');

const getActiveTimers = async (userId) => {
  const r = await q(
    'SELECT * FROM timers WHERE user_id = $1 AND is_active = 1',
    [userId]
  );
  return r.rows;
};

const upsertTimer = async (userId, projectId, data) => {
  await q(`
    INSERT INTO timers (user_id, project_id, is_active, is_paused, started_at, accumulated_seconds, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT(user_id, project_id) DO UPDATE SET
      is_active=EXCLUDED.is_active, is_paused=EXCLUDED.is_paused,
      started_at=EXCLUDED.started_at, accumulated_seconds=EXCLUDED.accumulated_seconds,
      updated_at=EXCLUDED.updated_at
  `, [userId, projectId, data.is_active, data.is_paused, data.started_at, data.accumulated_seconds]);
};

const clearTimer = async (userId, projectId) => {
  await q('DELETE FROM timers WHERE user_id = $1 AND project_id = $2', [userId, projectId]);
};

module.exports = { getActiveTimers, upsertTimer, clearTimer };
