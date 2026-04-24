'use strict';

const { init }  = require('../src/server/db/init-schema');
const userRepo  = require('../src/server/db/repositories/user.repository');
const compRepo  = require('../src/server/db/repositories/company.repository');
const projRepo  = require('../src/server/db/repositories/project.repository');
const entryRepo = require('../src/server/db/repositories/entry.repository');
const timerRepo = require('../src/server/db/repositories/timer.repository');
const invRepo   = require('../src/server/db/repositories/invoice.repository');
const statsRepo = require('../src/server/db/repositories/stats.repository');
const adminRepo = require('../src/server/db/repositories/admin.repository');
const eventRepo = require('../src/server/db/repositories/event.repository');

module.exports = {
  init,
  ...userRepo,
  ...compRepo,
  ...projRepo,
  ...entryRepo,
  ...timerRepo,
  ...invRepo,
  ...statsRepo,
  ...adminRepo,
  ...eventRepo
};
