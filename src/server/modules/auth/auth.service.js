'use strict';

const db       = require('../../../../database/db');
const { resend, FROM_EMAIL, APP_URL } = require('../../config/env');

const sendExpiryWarning = async (user, daysLeft) => {
  if (!resend || !user.email) return;
  const isTrialMsg = user.is_trial ? 'Tu período de prueba gratuito' : 'Tu plan Pro';
  resend.emails.send({
    from: FROM_EMAIL,
    to: user.email,
    subject: `Tu plan Pro en Cronoras caduca en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`,
    html: `<div style="font-family:sans-serif;padding:24px;background:#06060f;color:#dde0f5;border-radius:12px;max-width:480px">
      <h2 style="color:#f5c842;margin-bottom:8px">⏳ ${isTrialMsg} termina pronto</h2>
      <p>Hola <strong>${user.name || 'ahí'}</strong>, te quedan <strong style="color:#f5c842">${daysLeft} día${daysLeft === 1 ? '' : 's'}</strong> de plan Pro en Cronoras.</p>
      <p>Cuando expire, tu cuenta volverá al plan Básico. <strong>Tus datos no se borran</strong> — proyectos, horas, facturas y estadísticas siguen guardados, pero dejarás de poder acceder a las funciones Pro.</p>
      <p>Si quieres seguir con Pro, ve a la sección <strong>Planes</strong> dentro de la app y elige el período que prefieras.</p>
      <p style="color:#888;font-size:12px;margin-top:24px">Cronoras · Freelance Tracker</p>
    </div>`
  }).catch(() => {});
};

const sendRegistrationEmail = async (name, email) => {
  if (!resend) return;
  const adminEmail = process.env.ADMIN_EMAIL || await db.getAdminEmail();
  if (!adminEmail) return;
  resend.emails.send({
    from: FROM_EMAIL,
    to: adminEmail,
    subject: `Nuevo usuario registrado — ${name}`,
    html: `<div style="font-family:sans-serif;padding:24px;background:#06060f;color:#dde0f5;border-radius:12px">
      <h2 style="color:#f5c842">Nuevo registro en Cronoras</h2>
      <p><strong>Nombre:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p style="color:#888;font-size:12px">Plan: Pro Trial (30 días gratis) — caduca automáticamente. Activa Pro desde el panel si realiza el pago.</p>
    </div>`
  }).catch(() => {});
};

const sendPasswordResetEmail = async (user, token) => {
  if (!resend) throw new Error('Servicio de email no configurado');
  const resetUrl = `${APP_URL}/reset-password.html?token=${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: user.email,
    subject: 'Restablecer contraseña — Cronoras',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#06060f;color:#dde0f5;padding:32px;border-radius:12px">
        <h2 style="color:#f5c842;margin-bottom:16px">Cronoras</h2>
        <p style="margin-bottom:24px">Hola ${user.name || 'compositor'},<br><br>
        Recibimos una solicitud para restablecer tu contraseña.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#f5c842;color:#000;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none">Restablecer contraseña</a>
        <p style="margin-top:24px;color:#555580;font-size:12px">Este enlace caduca en 1 hora. Si no solicitaste esto, ignora este email.</p>
      </div>
    `
  });
};

const isEmailConfigured = () => !!resend;

module.exports = { sendExpiryWarning, sendRegistrationEmail, sendPasswordResetEmail, isEmailConfigured };
