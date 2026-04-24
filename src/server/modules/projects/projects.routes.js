'use strict';

const { Router } = require('express');
const { getProjects, getProject, createProject, updateProject, deleteProject } = require('./projects.controller');

const router = Router();

router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

module.exports = router;
