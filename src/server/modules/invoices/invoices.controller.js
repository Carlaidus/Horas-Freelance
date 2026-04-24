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

const createInvoice = async (req, res) => {
  try {
    const { lines = [], ...data } = req.body;
    const id = await db.createInvoice({ user_id: getUserId(req), ...data });
    if (lines.length) await db.setInvoiceLines(id, lines);
    res.json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const updateInvoice = async (req, res) => {
  try {
    const { lines = [], ...data } = req.body;
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

const getInvoicePdf = async (req, res) => {
  try {
    const invoice = await db.getInvoice(+req.params.id);
    if (!invoice) return res.status(404).json({ error: 'No encontrada' });
    const lines = await db.getInvoiceLines(invoice.id);
    generateInvoicePdf(invoice, lines, res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getInvoices, getNextNumber, getInvoice, createInvoice, updateInvoice, issueInvoice, deleteInvoice, getInvoicePdf };
