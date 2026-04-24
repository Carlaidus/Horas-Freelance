'use strict';

const { Router } = require('express');
const { requireAdmin } = require('../../middleware/auth.middleware');
const { track, events, analytics } = require('./analytics.controller');

const router = Router();

router.post('/api/track', track);
router.get('/admin/api/events', requireAdmin, events);
router.get('/admin/api/analytics', requireAdmin, analytics);

module.exports = router;
