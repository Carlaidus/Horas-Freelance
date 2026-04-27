'use strict';

const { pool, q } = require('../pool');

const getOrCreateDefaultSeries = async (userId) => {
  let r = await q(
    "SELECT * FROM invoice_series WHERE user_id = $1 AND is_active = 1 ORDER BY id LIMIT 1",
    [userId]
  );
  if (!r.rows[0]) {
    const ir = await q(
      "INSERT INTO invoice_series (user_id, description, next_number) VALUES ($1, 'Serie general', 354) RETURNING id",
      [userId]
    );
    r = await q("SELECT * FROM invoice_series WHERE id = $1", [ir.rows[0].id]);
  }
  return r.rows[0];
};

const getInvoiceSeries = async (userId) => {
  const r = await q("SELECT * FROM invoice_series WHERE user_id = $1 ORDER BY id", [userId]);
  return r.rows;
};

const getNextInvoiceNumber = async (userId) => {
  const s = await getOrCreateDefaultSeries(userId);
  return s.next_number;
};

const getInvoices = async (userId) => {
  const r = await q(`
    SELECT i.*, c.name as company_display_name
    FROM invoices i
    LEFT JOIN companies c ON i.company_id = c.id
    WHERE i.user_id = $1
    ORDER BY
      CASE i.status WHEN 'issued' THEN 1 ELSE 2 END,
      i.number DESC NULLS LAST,
      i.created_at DESC
  `, [userId]);
  return r.rows;
};

const getInvoice = async (id) => {
  const r = await q("SELECT * FROM invoices WHERE id = $1", [id]);
  return r.rows[0] || null;
};

const getInvoiceLines = async (invoiceId) => {
  const r = await q(
    "SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY sort_order, id",
    [invoiceId]
  );
  return r.rows;
};

const createInvoice = async (data) => {
  const r = await q(`
    INSERT INTO invoices (user_id, series_id, company_id, project_id, issue_date, operation_date,
      issuer_name, issuer_nif, issuer_address, issuer_city, issuer_postal_code,
      customer_name, customer_nif, customer_address, customer_city, customer_postal_code, customer_country,
      subtotal, iva_rate, iva_exempt, iva_amount, irpf_rate, irpf_amount, total, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
    RETURNING id
  `, [
    data.user_id ?? 1, data.series_id ?? null, data.company_id ?? null, data.project_id ?? null,
    data.issue_date ?? new Date().toISOString().split('T')[0], data.operation_date ?? null,
    data.issuer_name ?? '', data.issuer_nif ?? '', data.issuer_address ?? '',
    data.issuer_city ?? '', data.issuer_postal_code ?? '',
    data.customer_name ?? '', data.customer_nif ?? '', data.customer_address ?? '',
    data.customer_city ?? '', data.customer_postal_code ?? '', data.customer_country ?? 'España',
    data.subtotal ?? 0, data.iva_rate ?? 21, data.iva_exempt ?? 0, data.iva_amount ?? 0,
    data.irpf_rate ?? 15, data.irpf_amount ?? 0, data.total ?? 0, data.notes ?? ''
  ]);
  return r.rows[0].id;
};

const updateInvoice = async (id, data) => {
  const inv = await getInvoice(id);
  if (inv?.status === 'issued') throw new Error('No se puede editar una factura emitida');
  await q(`
    UPDATE invoices SET
      company_id=$1, project_id=$2, issue_date=$3, operation_date=$4,
      issuer_name=$5, issuer_nif=$6, issuer_address=$7, issuer_city=$8, issuer_postal_code=$9,
      customer_name=$10, customer_nif=$11, customer_address=$12, customer_city=$13,
      customer_postal_code=$14, customer_country=$15,
      subtotal=$16, iva_rate=$17, iva_exempt=$18, iva_amount=$19,
      irpf_rate=$20, irpf_amount=$21, total=$22, notes=$23, updated_at=NOW()
    WHERE id=$24 AND status='draft'
  `, [
    data.company_id ?? null, data.project_id ?? null, data.issue_date, data.operation_date ?? null,
    data.issuer_name ?? '', data.issuer_nif ?? '', data.issuer_address ?? '',
    data.issuer_city ?? '', data.issuer_postal_code ?? '',
    data.customer_name ?? '', data.customer_nif ?? '', data.customer_address ?? '',
    data.customer_city ?? '', data.customer_postal_code ?? '', data.customer_country ?? 'España',
    data.subtotal ?? 0, data.iva_rate ?? 21, data.iva_exempt ?? 0, data.iva_amount ?? 0,
    data.irpf_rate ?? 15, data.irpf_amount ?? 0, data.total ?? 0, data.notes ?? '', id
  ]);
};

const issueInvoice = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inv = (await client.query("SELECT * FROM invoices WHERE id = $1", [id])).rows[0];
    if (!inv) throw new Error('Factura no encontrada');
    if (inv.status === 'issued') throw new Error('Esta factura ya está emitida');
    if (!inv.issuer_nif) throw new Error('Falta el NIF del emisor. Completa tus datos en Ajustes.');
    if (!inv.customer_name) throw new Error('Falta el nombre del cliente');
    if (!inv.issue_date) throw new Error('Falta la fecha de emisión');
    if (inv.subtotal <= 0) throw new Error('La factura no tiene importe');

    let number = inv.number;
    let fullNumber = inv.full_number;

    if (!number) {
      let series = (await client.query(
        "SELECT * FROM invoice_series WHERE user_id = $1 AND is_active = 1 ORDER BY id LIMIT 1",
        [userId]
      )).rows[0];
      if (!series) {
        const sr = await client.query(
          "INSERT INTO invoice_series (user_id, description, next_number) VALUES ($1,'Serie general',354) RETURNING id",
          [userId]
        );
        series = (await client.query("SELECT * FROM invoice_series WHERE id = $1", [sr.rows[0].id])).rows[0];
      }
      number = series.next_number;
      fullNumber = String(number);
      const dup = (await client.query(
        "SELECT id FROM invoices WHERE user_id=$1 AND full_number=$2 AND status='issued' AND id!=$3",
        [userId, fullNumber, id]
      )).rows[0];
      if (dup) throw new Error(`El número ${fullNumber} ya está en uso`);
      await client.query(
        "UPDATE invoice_series SET next_number = next_number + 1 WHERE id = $1",
        [series.id]
      );
    }

    await client.query(
      "UPDATE invoices SET status='issued', number=$1, full_number=$2, issued_at=NOW(), updated_at=NOW() WHERE id=$3",
      [number, fullNumber, id]
    );

    const result = (await client.query("SELECT * FROM invoices WHERE id = $1", [id])).rows[0];
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const deleteInvoiceDraft = async (id) => {
  await q("DELETE FROM invoice_lines WHERE invoice_id = $1", [id]);
  await q("DELETE FROM invoices WHERE id = $1", [id]);
};

const setInvoiceLines = async (invoiceId, lines) => {
  await q("DELETE FROM invoice_lines WHERE invoice_id = $1", [invoiceId]);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await q(
      "INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, line_total, sort_order, project_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [invoiceId, l.description || '', l.quantity || 1, l.unit_price || 0, l.line_total || 0, i, l.project_id ?? null]
    );
  }
};

const validateInvoiceLines = async (lines, companyId) => {
  const projectIds = lines.map(l => l.project_id).filter(id => id != null);
  if (!companyId || !projectIds.length) return;
  const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(',');
  const r = await q(`SELECT id, company_id FROM projects WHERE id IN (${placeholders})`, projectIds);
  if (r.rows.length !== projectIds.length) throw new Error('Algún proyecto de la factura no existe');
  const wrong = r.rows.filter(p => p.company_id != companyId);
  if (wrong.length) throw new Error('Todos los proyectos deben pertenecer a la misma empresa');
};

const updateInvoiceNumber = async (id, userId, number) => {
  const inv = await getInvoice(id);
  if (!inv) throw new Error('Factura no encontrada');
  const fullNumber = String(number);
  const dup = (await q(
    "SELECT id FROM invoices WHERE user_id=$1 AND full_number=$2 AND status='issued' AND id!=$3",
    [userId, fullNumber, id]
  )).rows[0];
  if (dup) throw new Error(`El número ${fullNumber} ya está en uso`);
  await q("UPDATE invoices SET number=$1, full_number=$2, updated_at=NOW() WHERE id=$3", [number, fullNumber, id]);
};

module.exports = {
  getInvoiceSeries, getNextInvoiceNumber,
  getInvoices, getInvoice, getInvoiceLines,
  createInvoice, updateInvoice, issueInvoice,
  deleteInvoiceDraft, setInvoiceLines, updateInvoiceNumber, validateInvoiceLines
};
