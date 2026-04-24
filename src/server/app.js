'use strict';

const express = require('express');
const cors    = require('cors');
const session = require('express-session');
const path    = require('path');

const { sessionGuard } = require('./middleware/auth.middleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'cronoras-local-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(sessionGuard);
app.use(express.static(path.join(__dirname, '../../public')));

module.exports = app;
