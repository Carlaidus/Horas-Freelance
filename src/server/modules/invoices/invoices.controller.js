'use strict';

const db = require('../../../../database/db');
const { getUserId } = require('../../middleware/auth.middleware');
const { generateInvoicePdf } = require('../../../../lib/invoice-pdf');

const getInvoices = async (req, res) => {
  try { res.json(await db.getInvoices(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const getNextNumber = async (req, res) => {
  try { res.json({ number: await db.getNextInvoiceNumber(getUserId(req)) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await db.getInvoice(+req.params.id);
    if (!invoice) return res.status(404).json({ error: 'No encontrada' });
    const lines = await db.getInvoiceLines(invoice.id);
    res.json({ ...invoice, lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const resolveInvoiceProjectId = (lines) => {
  const ids = [...new Set(lines.map(l => l.project_id).filter(id => id != null))];
  return ids.length === 1 ? ids[0] : null;
};

const createInvoice = async (req, res) => {
  try {
    const { lines = [], ...data } = req.body;
    await db.validateInvoiceLines(lines, data.company_id);
    data.project_id = resolveInvoiceProjectId(lines);
    const id = await db.createInvoice({ user_id: getUserId(req), ...data });
    if (lines.length) await db.setInvoiceLines(id, lines);
    res.json({ id });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const updateInvoice = async (req, res) => {
  try {
    const { lines = [], ...data } = req.body;
    await db.validateInvoiceLines(lines, data.company_id);
    data.project_id = resolveInvoiceProjectId(lines);
    await db.updateInvoice(+req.params.id, data);
    await db.setInvoiceLines(+req.params.id, lines);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const issueInvoice = async (req, res) => {
  try {
    const invoice = await db.issueInvoice(+req.params.id, getUserId(req));
    res.json(invoice);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const deleteInvoice = async (req, res) => {
  try { await db.deleteInvoiceDraft(+req.params.id); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

const patchInvoiceStatus = async (req, res) => {
  try {
    await db.updateInvoiceStatus(+req.params.id, req.body.status);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const getInvoicePdf = async (req, res) => {
  try {
    const invoice = await db.getInvoice(+req.params.id);
    if (!invoice) return res.status(404).json({ error: 'No encontrada' });
    const lines = await db.getInvoiceLines(invoice.id);
    const includeEntryDetails = req.query.entryDetails === '1';
    const projectIds = lines.map(l => l.project_id).filter(id => id != null);
    const entryDetails = includeEntryDetails
      ? await db.getEntriesForProjects(projectIds, invoice.user_id)
      : [];
    generateInvoicePdf(invoice, lines, res, { entryDetails });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const previewInvoicePdf = async (req, res) => {
  try {
    const { lines = [], include_entry_details = false, ...data } = req.body;
    const invoice = {
      ...data,
      user_id: getUserId(req),
      full_number: data.full_number || String(data.number || 'BORRADOR')
    };
    const projectIds = lines.map(l => l.project_id).filter(id => id != null);
    const entryDetails = include_entry_details
      ? await db.getEntriesForProjects(projectIds, invoice.user_id)
      : [];
    generateInvoicePdf(invoice, lines, res, { entryDetails, preview: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const previewExistingInvoicePdf = async (req, res) => {
  try {
    const invoice = await db.getInvoice(+req.params.id);
    if (!invoice) return res.status(404).json({ error: 'No encontrada' });
    const lines = await db.getInvoiceLines(invoice.id);
    const includeEntryDetails = req.query.entryDetails === '1';
    const projectIds = lines.map(l => l.project_id).filter(id => id != null);
    const entryDetails = includeEntryDetails
      ? await db.getEntriesForProjects(projectIds, invoice.user_id)
      : [];
    generateInvoicePdf(invoice, lines, res, { entryDetails, preview: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getInvoices, getNextNumber, getInvoice, createInvoice, updateInvoice, issueInvoice, deleteInvoice, getInvoicePdf, previewInvoicePdf, previewExistingInvoicePdf, patchInvoiceStatus };
