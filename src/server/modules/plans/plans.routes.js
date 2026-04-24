'use strict';

const { Router } = require('express');
const { upgrade } = require('./plans.controller');

const router = Router();

router.post('/upgrade', upgrade);

module.exports = router;
