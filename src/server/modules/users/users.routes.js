'use strict';

const { Router } = require('express');
const { getUser, saveUser } = require('./users.controller');

const router = Router();

router.get('/', getUser);
router.put('/', saveUser);

module.exports = router;
