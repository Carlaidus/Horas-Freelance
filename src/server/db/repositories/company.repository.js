'use strict';

const { q } = require('../pool');

const getCompanies = async (userId) => {
  const r = await q('SELECT * FROM companies WHERE user_id = $1 ORDER BY name', [userId]);
  return r.rows;
};

const createCompany = async (data) => {
  const r = await q(`
    INSERT INTO companies (user_id, name, cif, address, city, postal_code, country, email, phone, contact_person, notes, payment_days)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id
  `, [
    data.user_id ?? 1, data.name, data.cif ?? '', data.address ?? '',
    data.city ?? '', data.postal_code ?? '', data.country ?? 'España',
    data.email ?? '', data.phone ?? '', data.contact_person ?? '',
    data.notes ?? '', data.payment_days ?? 30
  ]);
  return r.rows[0].id;
};

const updateCompany = async (id, data) => {
  await q(`
    UPDATE companies SET name=$1, cif=$2, address=$3, city=$4, postal_code=$5,
    country=$6, email=$7, phone=$8, contact_person=$9, notes=$10, payment_days=$11
    WHERE id=$12
  `, [
    data.name, data.cif ?? '', data.address ?? '', data.city ?? '',
    data.postal_code ?? '', data.country ?? 'España', data.email ?? '',
    data.phone ?? '', data.contact_person ?? '', data.notes ?? '',
    data.payment_days ?? 30, id
  ]);
};

const deleteCompany = async (id) => {
  await q('DELETE FROM companies WHERE id = $1', [id]);
};

module.exports = { getCompanies, createCompany, updateCompany, deleteCompany };
