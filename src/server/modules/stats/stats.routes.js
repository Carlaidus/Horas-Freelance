'use strict';

const { Router } = require('express');
const { monthly, heatmap, clients, summary, paidMonthly, projectDetail, treasury } = require('./stats.controller');

const router = Router();

router.get('/monthly', monthly);
router.get('/heatmap', heatmap);
router.get('/clients', clients);
router.get('/summary', summary);
router.get('/paid-monthly', paidMonthly);
router.get('/project/:id', projectDetail);
router.get('/treasury', treasury);

module.exports = router;
