'use strict';

const { Router } = require('express');
const ctrl = require('./auth.controller');

const router = Router();

router.get('/me',                ctrl.me);
router.get('/has-users',         ctrl.hasUsers);
router.post('/register',         ctrl.register);
router.post('/login',            ctrl.login);
router.post('/logout',           ctrl.logout);
router.post('/forgot-password',  ctrl.forgotPassword);
router.post('/reset-password',   ctrl.resetPassword);

module.exports = router;
