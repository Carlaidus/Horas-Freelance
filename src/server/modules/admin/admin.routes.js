'use strict';

const { Router } = require('express');
const { adminPage, getUsers, setUserPlan, requireAdmin } = require('./admin.controller');

const router = Router();

router.get('/admin', adminPage);
router.get('/admin/api/users', requireAdmin, getUsers);
router.put('/admin/api/users/:id/plan', requireAdmin, setUserPlan);

module.exports = router;
