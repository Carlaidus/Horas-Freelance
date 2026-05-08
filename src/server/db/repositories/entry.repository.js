'use strict';

const { q } = require('../pool');

const getEntries = async (projectId) => {
  const r = await q(
    `SELECT e.*, i.full_number as invoice_number, i.status as invoice_status
     FROM entries e
     LEFT JOIN invoices i ON e.invoice_id = i.id
     WHERE e.project_id = $1
     ORDER BY e.date DESC, e.created_at DESC`,
    [projectId]
  );
  return r.rows;
};

const getEntriesForProjects = async (projectIds, userId) => {
  const ids = [...new Set((projectIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const r = await q(
    `SELECT e.*
     FROM entries e
     WHERE project_id IN (${placeholders}) AND user_id = $${ids.length + 1}
     ORDER BY date ASC, created_at ASC`,
    [...ids, userId]
  );
  return r.rows;
};

const getEntriesForInvoiceProjects = async (projectIds, userId, invoiceId = null) => {
  const ids = [...new Set((projectIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const params = [...ids, userId];
  const invoiceWhere = invoiceId
    ? `AND e.invoice_id = $${ids.length + 2}`
    : 'AND e.invoice_id IS NULL';
  if (invoiceId) params.push(invoiceId);
  const r = await q(
    `SELECT e.*
     FROM entries e
     WHERE e.project_id IN (${placeholders}) AND e.user_id = $${ids.length + 1} ${invoiceWhere}
     ORDER BY e.date ASC, e.created_at ASC`,
    params
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
  const existing = (await q('SELECT invoice_id FROM entries WHERE id = $1', [id])).rows[0];
  if (existing?.invoice_id) throw new Error('Esta entrada ya está facturada. Anula o elimina la factura para poder modificarla.');
  await q(`
    UPDATE entries
    SET project_id=COALESCE($1, project_id), date=$2, hours=$3, description=$4, hourly_rate_override=$5
    WHERE id=$6
  `, [data.project_id ?? null, data.date, data.hours, data.description, data.hourly_rate_override ?? null, id]);
};

const deleteEntry = async (id) => {
  const existing = (await q('SELECT invoice_id FROM entries WHERE id = $1', [id])).rows[0];
  if (existing?.invoice_id) throw new Error('Esta entrada ya está facturada. Anula o elimina la factura para poder borrarla.');
  await q('DELETE FROM entries WHERE id = $1', [id]);
};

module.exports = { getEntries, getEntriesForProjects, getEntriesForInvoiceProjects, createEntry, updateEntry, deleteEntry };
