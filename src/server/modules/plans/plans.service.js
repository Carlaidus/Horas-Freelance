'use strict';

const { resend, FROM_EMAIL } = require('../../config/env');
const db = require('../../../../database/db');

const isEmailConfigured = () => !!resend;

const sendUpgradeRequest = async (user, plan, price, period) => {
  const userName  = user?.name  || 'Usuario';
  const userEmail = user?.email || '—';
  const adminEmail = process.env.ADMIN_EMAIL || await db.getAdminEmail();
  if (!adminEmail) throw new Error('Sin email de admin configurado');

  await resend.emails.send({
    from: FROM_EMAIL,
    to: adminEmail,
    subject: `Solicitud de activación: ${plan} — ${userName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#06060f;color:#dde0f5;padding:32px;border-radius:12px">
        <h2 style="color:#f5c842;margin-bottom:4px">Cronoras — Solicitud de upgrade</h2>
        <p style="color:#555580;font-size:12px;margin-bottom:24px">Recibida desde la app</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#888;width:120px">Usuario</td><td style="color:#dde0f5;font-weight:600">${userName}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Email</td><td style="color:#dde0f5">${userEmail}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Plan</td><td style="color:#f5c842;font-weight:700">${plan}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Precio</td><td style="color:#dde0f5;font-weight:600">${price || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Periodo</td><td style="color:#dde0f5">${period || '—'}</td></tr>
        </table>
        <p style="margin-top:24px;padding:14px 16px;background:rgba(245,200,66,0.08);border:1px solid rgba(245,200,66,0.2);border-radius:8px;font-size:13px;color:#aaa">
          Activa el plan desde el <strong style="color:#f5c842">Panel Admin</strong> una vez recibido el pago.
        </p>
      </div>
    `
  });
};

module.exports = { isEmailConfigured, sendUpgradeRequest };
