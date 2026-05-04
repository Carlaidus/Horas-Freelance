'use strict';

const db = require('../../../../database/db');
const { getUserId } = require('../../middleware/auth.middleware');

const monthly = async (req, res) => {
  try {
    const { from, to, group } = req.query;
    if (from && to) return res.json(await db.getMonthlyStatsRange(getUserId(req), from, to, group || 'month'));
    res.json(await db.getMonthlyStats(getUserId(req)));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const heatmap = async (req, res) => {
  try { res.json(await db.getHeatmapData(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const clients = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (from && to) return res.json(await db.getClientStatsRange(getUserId(req), from, to));
    res.json(await db.getClientStats(getUserId(req)));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const projects = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.json([]);
    res.json(await db.getProjectStatsRange(getUserId(req), from, to));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const companyDayRates = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.json([]);
    res.json(await db.getCompanyDayRateStatsRange(getUserId(req), from, to));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const projectHours = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.json([]);
    res.json(await db.getProjectHoursStatsRange(getUserId(req), from, to));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const summary = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (from && to) return res.json(await db.getSummaryRange(getUserId(req), from, to));
    res.json(await db.getYearlySummary(getUserId(req)));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const paidMonthly = async (req, res) => {
  try { res.json(await db.getPaidMonthlyStats(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

const projectDetail = async (req, res) => {
  try {
    const { from, to, group } = req.query;
    res.json(await db.getProjectStatsDetail(+req.params.id, from, to, group || 'month'));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const treasury = async (req, res) => {
  try { res.json(await db.getTreasuryData(getUserId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = {
  monthly, heatmap, clients, projects, companyDayRates, projectHours,
  summary, paidMonthly, projectDetail, treasury
};
