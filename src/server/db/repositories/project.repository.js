'use strict';

const { q } = require('../pool');

const getProjects = async (userId) => {
  const r = await q(`
    SELECT p.*, c.name as company_name,
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
      MIN(e.date) as first_entry_date,
      MAX(e.date) as last_entry_date
    FROM projects p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN entries e ON e.project_id = p.id
    WHERE p.user_id = $1
    GROUP BY p.id, c.name
    ORDER BY p.created_at DESC
  `, [userId]);
  return r.rows;
};

const getProject = async (id) => {
  const r = await q(`
    SELECT p.*, c.name as company_name, c.cif as company_cif, c.address as company_address,
      c.city as company_city, c.postal_code as company_postal_code, c.email as company_email,
      c.phone as company_phone, c.contact_person as company_contact,
      COALESCE(SUM(e.hours), 0) as total_hours,
      COALESCE(SUM(e.hours * COALESCE(e.hourly_rate_override, p.hourly_rate)), 0) as total_amount,
      MIN(e.date) as first_entry_date,
      MAX(e.date) as last_entry_date
    FROM projects p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN entries e ON e.project_id = p.id
    WHERE p.id = $1
    GROUP BY p.id, c.name, c.cif, c.address, c.city, c.postal_code, c.email, c.phone, c.contact_person
  `, [id]);
  return r.rows[0] || null;
};

const createProject = async (data) => {
  const r = await q(`
    INSERT INTO projects (user_id, company_id, name, hourly_rate, status, notes)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [
    data.user_id ?? 1, data.company_id, data.name,
    data.hourly_rate, data.status ?? 'pending', data.notes ?? ''
  ]);
  return r.rows[0].id;
};

const updateProject = async (id, data) => {
  await q(`
    UPDATE projects SET name=$1, company_id=$2, hourly_rate=$3, status=$4, invoice_number=$5,
    notes=$6, budget_type=$7, fixed_budget=$8, is_completed=$9, invoiced_at=$10,
    expected_payment_date=$11, completed_at=$12, purchase_order=$13
    WHERE id=$14
  `, [
    data.name, data.company_id, data.hourly_rate, data.status,
    data.invoice_number ?? '', data.notes ?? '', data.budget_type ?? 'hourly',
    data.fixed_budget ?? null, data.is_completed ?? 0,
    data.invoiced_at ?? null, data.expected_payment_date ?? null,
    data.completed_at ?? null, data.purchase_order ?? '', id
  ]);
};

const deleteProject = async (id) => {
  await q('DELETE FROM entries WHERE project_id = $1', [id]);
  await q('DELETE FROM projects WHERE id = $1', [id]);
};

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject };
