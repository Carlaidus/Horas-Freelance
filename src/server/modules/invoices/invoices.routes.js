'use strict';

const { Router } = require('express');
const { getInvoices, getNextNumber, getInvoice, createInvoice, updateInvoice, issueInvoice, deleteInvoice } = require('./invoices.controller');

const router = Router();

router.get('/', getInvoices);
router.get('/next-number', getNextNumber);  // antes de /:id para evitar conflicto
router.get('/:id', getInvoice);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.post('/:id/issue', issueInvoice);
router.delete('/:id', deleteInvoice);

module.exports = router;
