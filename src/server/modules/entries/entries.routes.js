'use strict';

const { Router } = require('express');
const { getEntries, createEntry, updateEntry, deleteEntry } = require('./entries.controller');

const router = Router();

router.get('/api/projects/:id/entries', getEntries);
router.post('/api/entries', createEntry);
router.put('/api/entries/:id', updateEntry);
router.delete('/api/entries/:id', deleteEntry);

module.exports = router;
