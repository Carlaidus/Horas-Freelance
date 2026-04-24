'use strict';

const db            = require('../../../database/db');
const { REQUIRE_AUTH } = require('../config/env');

const getUserId = (req) => req.session.userId || 1;

const getEffectivePlan = (user) => {
  if (!user) return 'free';
  if (user.role === 'admin') return 'pro';
  if (!user.plan || user.plan === 'free') return 'free';
  if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) return 'free';
  return user.plan;
};

const getDaysRemaining = (user) => {
  if (!user || user.role === 'admin' || !user.plan_expires_at || user.plan === 'free') return null;
  const diff = Math.ceil((new Date(user.plan_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await db.getUser(getUserId(req));
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const sessionGuard = (req, res, next) => {
  const isPublic = req.path === '/login.html' || req.path === '/reset-password.html'
    || req.path === '/manifest.json' || req.path === '/sw.js'
    || req.path.startsWith('/api/auth/') || req.path.startsWith('/css/')
    || req.path.startsWith('/js/') || req.path.startsWith('/icons/');
  if (!REQUIRE_AUTH || isPublic || req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autenticado' });
  res.redirect('/login.html');
};

module.exports = { getUserId, getEffectivePlan, getDaysRemaining, requireAdmin, sessionGuard };
