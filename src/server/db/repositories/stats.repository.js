'use strict';

const { q } = require('../pool');

const getMonthlyStats = async (userId) => {
  const r = await q(`
    SELECT TO_CHAR(e.date::date, 'YYYY-MM') as month,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1
    GROUP BY TO_CHAR(e.date::date, 'YYYY-MM')
    ORDER BY month ASC
    LIMIT 12
  `, [userId]);
  return r.rows;
};

const getHeatmapData = async (userId) => {
  const r = await q(`
    SELECT TO_CHAR(e.date::date, 'YYYY-MM-DD') as date, SUM(e.hours) as hours
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1 AND e.date >= CURRENT_DATE - INTERVAL '365 days'
    GROUP BY e.date
  `, [userId]);
  return r.rows;
};

const getClientStats = async (userId) => {
  const r = await q(`
    SELECT c.name as company, c.id as company_id,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings,
      COUNT(DISTINCT p.id) as projects
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    JOIN companies c ON p.company_id = c.id
    WHERE p.user_id = $1
    GROUP BY c.id, c.name
    ORDER BY earnings DESC
  `, [userId]);
  return r.rows;
};

const getYearlySummary = async (userId) => {
  const r = await q(`
    SELECT
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_earnings,
      COUNT(DISTINCT p.id) as total_projects,
      COUNT(DISTINCT p.company_id) as total_clients,
      COALESCE(AVG(p.hourly_rate), 0) as avg_rate
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1 AND TO_CHAR(e.date::date, 'YYYY') = TO_CHAR(NOW(), 'YYYY')
  `, [userId]);
  return r.rows[0];
};

const getMonthlyStatsRange = async (userId, from, to, groupBy = 'month') => {
  const groupExpr = groupBy === 'day'
    ? "TO_CHAR(e.date::date, 'YYYY-MM-DD')"
    : groupBy === 'week'
    ? "TO_CHAR(e.date::date, 'IYYY-IW')"
    : "TO_CHAR(e.date::date, 'YYYY-MM')";
  const r = await q(`
    SELECT ${groupExpr} as period,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1 AND e.date >= $2 AND e.date <= $3
    GROUP BY ${groupExpr}
    ORDER BY period ASC
  `, [userId, from, to]);
  return r.rows;
};

const getSummaryRange = async (userId, from, to) => {
  const r = await q(`
    SELECT
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_earnings,
      COUNT(DISTINCT p.id) as total_projects,
      COUNT(DISTINCT p.company_id) as total_clients,
      COALESCE(AVG(p.hourly_rate), 0) as avg_rate,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) FILTER (
        WHERE NOT EXISTS (
          SELECT 1
          FROM invoice_lines il
          JOIN invoices i ON i.id = il.invoice_id
          WHERE il.project_id = p.id AND i.status IN ('issued', 'paid')
        )
      ), 0) as unbilled_earnings,
      COALESCE((
        SELECT SUM(i.total)
        FROM invoices i
        WHERE i.user_id = $1
          AND i.status = 'issued'
          AND i.issue_date >= $2
          AND i.issue_date <= $3
      ), 0) as pending_amount,
      COALESCE((
        SELECT SUM(i.total)
        FROM invoices i
        WHERE i.user_id = $1
          AND i.status = 'paid'
          AND i.updated_at::date >= $2
          AND i.updated_at::date <= $3
      ), 0) as paid_amount
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = $1 AND e.date >= $2 AND e.date <= $3
  `, [userId, from, to]);
  return r.rows[0];
};

const getPaidMonthlyStats = async (userId) => {
  const r = await q(`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
        date_trunc('month', CURRENT_DATE),
        INTERVAL '1 month'
      )::date AS month_start
    )
    SELECT
      TO_CHAR(m.month_start, 'YYYY-MM') as period,
      COALESCE(SUM(i.total), 0) as paid
    FROM months m
    LEFT JOIN invoices i
      ON i.user_id = $1
      AND i.status = 'paid'
      AND date_trunc('month', i.updated_at)::date = m.month_start
    GROUP BY m.month_start
    ORDER BY m.month_start ASC
  `, [userId]);
  return r.rows;
};

const getClientStatsRange = async (userId, from, to) => {
  const r = await q(`
    SELECT c.name as company, c.id as company_id,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings,
      COUNT(DISTINCT p.id) as projects
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    JOIN companies c ON p.company_id = c.id
    WHERE p.user_id = $1 AND e.date >= $2 AND e.date <= $3
    GROUP BY c.id, c.name
    ORDER BY earnings DESC
  `, [userId, from, to]);
  return r.rows;
};

const getProjectStatsDetail = async (projectId, from, to, group = 'month') => {
  const fmt = group === 'day'  ? `TO_CHAR(e.date::date, 'YYYY-MM-DD')`
            : group === 'week' ? `TO_CHAR(e.date::date, 'IYYY-IW')`
            :                    `TO_CHAR(e.date::date, 'YYYY-MM')`;
  const params = [projectId];
  let dateWhere = '';
  if (from && to) { params.push(from, to); dateWhere = `AND e.date >= $2 AND e.date <= $3`; }

  const sr = await q(`
    SELECT
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
      COUNT(*) as entry_count,
      MIN(e.date) as first_date,
      MAX(e.date) as last_date,
      COALESCE(AVG(e.hours), 0) as avg_hours_per_entry
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE e.project_id = $1 ${dateWhere}
  `, params);

  const mr = await q(`
    SELECT ${fmt} as period,
      SUM(e.hours) as hours,
      SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)) as earnings
    FROM entries e
    JOIN projects p ON e.project_id = p.id
    WHERE e.project_id = $1 ${dateWhere}
    GROUP BY ${fmt}
    ORDER BY period ASC
  `, params);

  return { summary: sr.rows[0], monthly: mr.rows };
};

const getTreasuryData = async (userId) => {
  const r = await q(`
    SELECT p.id, p.name, p.status, p.budget_type, p.fixed_budget, p.is_completed,
      p.invoiced_at, p.expected_payment_date, p.invoice_number, p.created_at,
      c.name as company_name, COALESCE(c.payment_days, 30) as payment_days,
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
      CASE
        WHEN p.expected_payment_date IS NOT NULL THEN p.expected_payment_date
        WHEN p.invoiced_at IS NOT NULL
          THEN p.invoiced_at + (COALESCE(c.payment_days, 30) * INTERVAL '1 day')
        ELSE NULL
      END as forecast_date
    FROM projects p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN entries e ON e.project_id = p.id
    WHERE p.user_id = $1
    GROUP BY p.id, c.name, c.payment_days
    ORDER BY
      CASE p.status WHEN 'sent' THEN 1 WHEN 'pending' THEN 2 WHEN 'paid' THEN 3 ELSE 4 END,
      forecast_date ASC NULLS LAST,
      p.created_at DESC
  `, [userId]);
  return r.rows;
};

module.exports = {
  getMonthlyStats, getHeatmapData, getClientStats, getYearlySummary,
  getMonthlyStatsRange, getSummaryRange, getClientStatsRange,
  getPaidMonthlyStats, getProjectStatsDetail, getTreasuryData
};
