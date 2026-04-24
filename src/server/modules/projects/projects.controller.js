'use strict';

const db = require('../../../../database/db');
const { getUserId, getEffectivePlan } = require('../../middleware/auth.middleware');
const { generateProjectReportPdf } = require('../../../../lib/project-report-pdf');

const ownProject = async (req, res) => {
  const p = await db.getProject(+req.params.id);
  if (!p || p.user_id !== getUserId(req)) {
    res.status(404).json({ error: 'No encontrado' });
    return null;
  }
  return p;
};

const getProjects = async (req, res) => {
  try { res.json(await db.getProjects(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const getProject = async (req, res) => {
  try { const p = await ownProject(req, res); if (p) res.json(p); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const createProject = async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await db.getUser(userId);
    if (getEffectivePlan(user) === 'free') {
      const count = await db.countUserProjects(userId);
      if (count >= 1) return res.status(403).json({ error: 'UPGRADE_REQUIRED', feature: 'projects' });
    }
    res.json({ id: await db.createProject({ user_id: userId, ...req.body }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const updateProject = async (req, res) => {
  try {
    if (!await ownProject(req, res)) return;
    await db.updateProject(+req.params.id, req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const deleteProject = async (req, res) => {
  try {
    if (!await ownProject(req, res)) return;
    await db.deleteProject(+req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getProjectReport = async (req, res) => {
  try {
    const project = await db.getProject(+req.params.id);
    if (!project) return res.status(404).json({ error: 'No encontrado' });
    const entries = await db.getEntries(+req.params.id);
    const user = await db.getUser(getUserId(req));
    generateProjectReportPdf(project, entries, user, res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getProjectExport = async (req, res) => {
  try {
    const project = await db.getProject(+req.params.id);
    const entries = await db.getEntries(+req.params.id);
    const user = await db.getUser(getUserId(req));
    res.json({ project, entries, user });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { ownProject, getProjects, getProject, createProject, updateProject, deleteProject, getProjectReport, getProjectExport };
