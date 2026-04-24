'use strict';

const { Router } = require('express');
const { requireAdmin } = require('../../middleware/auth.middleware');
const { adminPage, getUsers, setUserPlan } = require('./admin.controller');

const router = Router();

router.get('/admin', adminPage);
router.get('/admin/api/users', requireAdmin, getUsers);
router.put('/admin/api/users/:id/plan', requireAdmin, setUserPlan);

module.exports = router;
