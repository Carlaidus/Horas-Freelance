'use strict';

const { Router } = require('express');
const { getTimers, startTimer, pauseTimer, resumeTimer, clearTimer } = require('./timers.controller');

const router = Router();

router.get('/', getTimers);
router.post('/:projectId/start', startTimer);
router.post('/:projectId/pause', pauseTimer);
router.post('/:projectId/resume', resumeTimer);
router.delete('/:projectId', clearTimer);

module.exports = router;
