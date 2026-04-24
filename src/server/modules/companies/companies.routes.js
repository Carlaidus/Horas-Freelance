'use strict';

const { Router } = require('express');
const { getCompanies, createCompany, updateCompany, deleteCompany } = require('./companies.controller');

const router = Router();

router.get('/', getCompanies);
router.post('/', createCompany);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

module.exports = router;
