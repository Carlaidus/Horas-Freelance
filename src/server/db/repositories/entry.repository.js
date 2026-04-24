'use strict';

const { q } = require('../pool');

const getEntries = async (projectId) => {
  const r = await q(
    'SELECT * FROM entries WHERE project_id = $1 ORDER BY date DESC, created_at DESC',
    [projectId]
  );
  return r.rows;
};

const createEntry = async (data) => {
  const r = await q(`
    INSERT INTO entries (project_id, user_id, date, hours, description, hourly_rate_override)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [
    data.project_id, data.user_id ?? 1, data.date, data.hours,
    data.description ?? '', data.hourly_rate_override ?? null
  ]);
  return r.rows[0].id;
};

const updateEntry = async (id, data) => {
  await q(`
    UPDATE entries SET date=$1, hours=$2, description=$3, hourly_rate_override=$4 WHERE id=$5
  `, [data.date, data.hours, data.description, data.hourly_rate_override ?? null, id]);
};

const deleteEntry = async (id) => {
  await q('DELETE FROM entries WHERE id = $1', [id]);
};

module.exports = { getEntries, createEntry, updateEntry, deleteEntry };
