'use strict';

const { Router } = require('express');
const { getProjects, getProject, createProject, updateProject, deleteProject, getProjectReport, getProjectExport } = require('./projects.controller');

const router = Router();

router.get('/', getProjects);
router.get('/:id', getProject);
router.get('/:id/report', getProjectReport);
router.get('/:id/export', getProjectExport);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

module.exports = router;
