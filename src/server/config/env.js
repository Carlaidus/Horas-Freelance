'use strict';

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const PORT         = process.env.PORT       || 3000;
const APP_URL      = process.env.APP_URL    || `http://localhost:${PORT}`;
const FROM_EMAIL   = process.env.RESEND_FROM || 'onboarding@resend.dev';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_HINT  = 'Mínimo 8 caracteres, una mayúscula, un número y un símbolo';

module.exports = { resend, PORT, APP_URL, FROM_EMAIL, REQUIRE_AUTH, PASSWORD_REGEX, PASSWORD_HINT };
