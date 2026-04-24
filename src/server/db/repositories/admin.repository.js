'use strict';

const { q } = require('../pool');

const getAllUsers = async () => {
  const r = await q(`
    SELECT id, name, email, role, plan, plan_expires_at, plan_period, is_trial, created_at,
      CASE
        WHEN role = 'admin' THEN NULL
        WHEN plan = 'free' THEN NULL
        WHEN plan_expires_at IS NULL THEN NULL
        ELSE (plan_expires_at::date - CURRENT_DATE)::integer
      END as days_remaining
    FROM users
    ORDER BY created_at DESC
  `);
  return r.rows;
};

const setUserPlan = async (userId, plan, expiresAt, period, isTrial = false) => {
  await q(
    'UPDATE users SET plan=$1, plan_expires_at=$2, plan_period=$3, is_trial=$4, plan_warning_sent=false WHERE id=$5',
    [plan, expiresAt || null, period || null, isTrial, userId]
  );
};

const setWarningFlag = async (userId) => {
  await q('UPDATE users SET plan_warning_sent=true WHERE id=$1', [userId]);
};

module.exports = { getAllUsers, setUserPlan, setWarningFlag };
