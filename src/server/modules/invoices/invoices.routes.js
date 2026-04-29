'use strict';

const { Router } = require('express');
const { getInvoices, getNextNumber, getInvoice, createInvoice, updateInvoice, issueInvoice, deleteInvoice, getInvoicePdf, previewInvoicePdf, patchInvoiceStatus } = require('./invoices.controller');

const router = Router();

router.get('/', getInvoices);
router.get('/next-number', getNextNumber);  // antes de /:id para evitar conflicto
router.post('/preview-pdf', previewInvoicePdf);
router.get('/:id', getInvoice);
router.get('/:id/pdf', getInvoicePdf);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.post('/:id/issue', issueInvoice);
router.patch('/:id/status', patchInvoiceStatus);
router.delete('/:id', deleteInvoice);

module.exports = router;
