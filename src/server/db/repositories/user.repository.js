'use strict';

const { q } = require('../pool');

const getUser = async (id) => {
  const r = await q('SELECT * FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
};

const saveUser = async (data) => {
  await q(`
    UPDATE users SET name=$1, email=$2, nif=$3, address=$4, city=$5, postal_code=$6,
    phone=$7, profession=$8, iva_rate=$9, irpf_rate=$10, iban=$11, annual_goal=$12, monthly_goal=$13
    WHERE id=$14
  `, [
    data.name ?? '', data.email ?? '', data.nif ?? '', data.address ?? '',
    data.city ?? '', data.postal_code ?? '', data.phone ?? '',
    data.profession ?? 'VFX Compositor', data.iva_rate ?? 21.0,
    data.irpf_rate ?? 15.0, data.iban ?? '', data.annual_goal ?? 50000,
    data.monthly_goal ?? 4000, data.id
  ]);
};

const findUserByEmail = async (email) => {
  const r = await q('SELECT * FROM users WHERE email = $1', [email]);
  return r.rows[0] || null;
};

const createAuthUser = async (data) => {
  const r = await q(
    `INSERT INTO users (name, email, password_hash, iva_rate, irpf_rate, role, plan, plan_expires_at, is_trial)
     VALUES ($1, $2, $3, 21.0, 15.0, 'user', 'pro', NOW() + INTERVAL '30 days', true) RETURNING id`,
    [data.name, data.email, data.password_hash]
  );
  return r.rows[0].id;
};

const countUsers = async () => {
  const r = await q('SELECT COUNT(*) as n FROM users WHERE password_hash IS NOT NULL');
  return parseInt(r.rows[0].n, 10);
};

const countUserProjects = async (userId) => {
  const r = await q('SELECT COUNT(*) as n FROM projects WHERE user_id = $1', [userId]);
  return parseInt(r.rows[0].n, 10);
};

const countUserCompanies = async (userId) => {
  const r = await q('SELECT COUNT(*) as n FROM companies WHERE user_id = $1', [userId]);
  return parseInt(r.rows[0].n, 10);
};

const getAdminEmail = async () => {
  const r = await q("SELECT email FROM users WHERE role='admin' AND email != '' ORDER BY id LIMIT 1");
  return r.rows[0]?.email || null;
};

const createResetToken = async (userId, token, expiresAt) => {
  await q(
    'INSERT INTO reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
    [userId, token, expiresAt]
  );
};

const findResetToken = async (token) => {
  const r = await q(
    "SELECT * FROM reset_tokens WHERE token = $1 AND expires_at > NOW()",
    [token]
  );
  return r.rows[0] || null;
};

const deleteResetToken = async (token) => {
  await q('DELETE FROM reset_tokens WHERE token = $1', [token]);
};

const deleteExpiredTokens = async () => {
  await q("DELETE FROM reset_tokens WHERE expires_at <= NOW()");
};

const updatePassword = async (userId, hash) => {
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
};

module.exports = {
  getUser, saveUser, findUserByEmail, createAuthUser,
  countUsers, countUserProjects, countUserCompanies, getAdminEmail,
  createResetToken, findResetToken, deleteResetToken, deleteExpiredTokens, updatePassword
};
