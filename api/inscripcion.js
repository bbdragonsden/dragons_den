const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER  = 'bbdragonsden@gmail.com';
const FROM   = 'Dragons Den <onboarding@resend.dev>';

function row(label, value) {
  return `
  <tr>
    <td style="padding:10px 16px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#555;font-family:Arial,sans-serif;width:140px;vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="padding:10px 16px;font-size:14px;color:#e8e8e8;font-family:Arial,sans-serif;line-height:1.5;">${value || '—'}</td>
  </tr>`;
}

function section(title) {
  return `
  <tr><td colspan="2" style="padding:20px 16px 6px;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#c8a96e;font-family:Arial,sans-serif;border-top:1px solid #1e1e1e;">${title}</td></tr>`;
}

function ownerHTML(d) {
  const esHijo = d.para_quien === 'Para su hijo/a';
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="padding-bottom:32px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:6px;height:6px;background:#c8a96e;border-radius:50%;vertical-align:middle;"></td>
      <td style="padding-left:10px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c8a96e;vertical-align:middle;font-weight:700;">Nueva inscripci&oacute;n &mdash; Campus Verano 2026</td>
    </tr></table>
  </td></tr>

  <!-- Name headline -->
  <tr><td style="padding-bottom:28px;border-bottom:1px solid #1e1e1e;">
    <h1 style="margin:0 0 4px;font-size:34px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1.1;">${d.nombre}</h1>
    <p style="margin:0;font-size:13px;color:#c8a96e;">${d.email} &middot; ${d.telefono}</p>
  </td></tr>

  <!-- Data table -->
  <tr><td style="padding-top:8px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${section('Jugador/a')}
      ${row('Inscripci&oacute;n', d.para_quien)}
      ${row('Nombre', d.nombre)}
      ${row('Edad', d.edad ? d.edad + ' a&ntilde;os' : '—')}
      ${row('Posici&oacute;n', d.posicion)}
      ${row('Nivel', d.nivel)}
      ${row('Club actual', d.club)}
      ${esHijo ? section('Padre / Madre / Tutor') : ''}
      ${esHijo ? row('Nombre tutor', d.tutor_nombre) : ''}
      ${esHijo ? row('Relaci&oacute;n', d.tutor_relacion) : ''}
      ${section('Contacto')}
      ${row('Email', `<a href="mailto:${d.email}" style="color:#c8a96e;">${d.email}</a>`)}
      ${row('Tel&eacute;fono', `<a href="https://wa.me/34${d.telefono.replace(/\D/g,'')}" style="color:#c8a96e;">${d.telefono}</a>`)}
      ${section('Disponibilidad')}
      ${row('Meses', d.meses)}
      ${row('Alumni', d.anterior)}
      ${section('Salud y objetivos')}
      ${row('Lesiones / alergias', d.lesiones)}
      ${row('Objetivo', d.objetivo)}
      ${section('Marketing')}
      ${row('C&oacute;mo nos conoci&oacute;', d.origen)}
      ${d.comentarios && d.comentarios !== '—' ? section('Comentarios') + row('', d.comentarios) : ''}
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #141414;padding-top:20px;margin-top:32px;">
    <p style="margin:0;font-size:10px;color:#2a2a2a;letter-spacing:1px;text-transform:uppercase;">Dragons Den Basketball Academy &middot; dragonsden.es</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

function userHTML({ nombre, nivel, meses }) {
  const firstName = (nombre || '').split(' ')[0];
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#0a0a0a;">Plaza confirmada en Dragons Den Basketball Academy &mdash; La guarida te espera.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:48px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0a0a0a;">

<tr><td><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#c8a96e;height:1px;font-size:0;">&nbsp;</td></tr></table></td></tr>

<tr><td style="padding:52px 56px 40px;">
  <p style="margin:0;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#c8a96e;font-family:Arial,sans-serif;">Summer Basketball Academy &mdash; 2026</p>
  <h1 style="margin:28px 0 0;font-size:64px;line-height:0.9;letter-spacing:6px;color:#ffffff;font-family:Arial Black,Arial,sans-serif;text-transform:uppercase;font-weight:900;">DRAGONS<br><span style="color:#c8a96e;">DEN</span></h1>
</td></tr>

<tr><td style="padding:0 56px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#c8a96e;height:1px;font-size:0;">&nbsp;</td></tr></table></td></tr>

<tr><td style="padding:56px 56px 48px;">
  <p style="margin:0 0 32px;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#c8a96e;font-family:Arial,sans-serif;">Inscripci&oacute;n recibida</p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-left:2px solid #c8a96e;padding-left:24px;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#666;font-family:Arial,sans-serif;">Bienvenido/a</p>
    <h2 style="margin:0;font-size:38px;letter-spacing:3px;color:#ffffff;font-family:Arial Black,Arial,sans-serif;text-transform:uppercase;line-height:1.1;">${firstName}</h2>
  </td></tr></table>
  <p style="margin:32px 0 0;font-size:15px;color:#999;line-height:1.9;font-family:Arial,sans-serif;">Tu solicitud ha sido recibida. En las pr&oacute;ximas <span style="color:#ffffff;font-weight:600;">24&ndash;48 horas</span> nos pondremos en contacto contigo para confirmar todos los detalles de tu plaza.</p>
</td></tr>

<tr><td style="padding:0 56px 56px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(200,169,110,0.2);">
    <tr><td style="padding:20px 28px;border-bottom:1px solid rgba(200,169,110,0.15);"><p style="margin:0;font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#c8a96e;font-family:Arial,sans-serif;">Resumen</p></td></tr>
    <tr><td style="padding:16px 28px;border-bottom:1px solid rgba(200,169,110,0.08);">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#555;font-family:Arial,sans-serif;width:100px;vertical-align:top;padding-top:2px;">Nivel</td>
        <td style="font-size:14px;color:#e8e8e8;font-family:Arial,sans-serif;">${nivel}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 28px;border-bottom:1px solid rgba(200,169,110,0.08);">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#555;font-family:Arial,sans-serif;width:100px;vertical-align:top;padding-top:2px;">Meses</td>
        <td style="font-size:14px;color:#e8e8e8;font-family:Arial,sans-serif;">${meses}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#555;font-family:Arial,sans-serif;width:100px;vertical-align:top;padding-top:6px;">Estado</td>
        <td><span style="display:inline-block;background:rgba(200,169,110,0.1);border:1px solid rgba(200,169,110,0.4);color:#c8a96e;font-size:9px;letter-spacing:2px;text-transform:uppercase;padding:5px 14px;font-family:Arial,sans-serif;">En proceso</span></td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>

<tr><td style="padding:0 56px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:rgba(200,169,110,0.15);height:1px;font-size:0;">&nbsp;</td></tr></table></td></tr>

<tr><td style="padding:48px 56px;">
  <p style="margin:0 0 32px;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#c8a96e;font-family:Arial,sans-serif;">Pr&oacute;ximos pasos</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding-bottom:24px;"><table cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="padding-right:20px;"><p style="margin:0;font-size:9px;letter-spacing:2px;color:#c8a96e;font-family:Arial,sans-serif;border:1px solid #c8a96e;width:24px;height:24px;text-align:center;line-height:24px;">01</p></td>
      <td><p style="margin:0 0 4px;font-size:13px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">Confirmaci&oacute;n de plaza</p><p style="margin:0;font-size:13px;color:#666;font-family:Arial,sans-serif;line-height:1.7;">Te contactamos en 24&ndash;48&nbsp;h con horarios y ubicaci&oacute;n.</p></td>
    </tr></table></td></tr>
    <tr><td style="padding-bottom:24px;"><table cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="padding-right:20px;"><p style="margin:0;font-size:9px;letter-spacing:2px;color:#c8a96e;font-family:Arial,sans-serif;border:1px solid #c8a96e;width:24px;height:24px;text-align:center;line-height:24px;">02</p></td>
      <td><p style="margin:0 0 4px;font-size:13px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">Informaci&oacute;n del programa</p><p style="margin:0;font-size:13px;color:#666;font-family:Arial,sans-serif;line-height:1.7;">Sesiones, material y todo lo que necesitas para el primer d&iacute;a.</p></td>
    </tr></table></td></tr>
    <tr><td><table cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="padding-right:20px;"><p style="margin:0;font-size:9px;letter-spacing:2px;color:#c8a96e;font-family:Arial,sans-serif;border:1px solid #c8a96e;width:24px;height:24px;text-align:center;line-height:24px;">03</p></td>
      <td><p style="margin:0 0 4px;font-size:13px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">Bienvenido/a a la guarida</p><p style="margin:0;font-size:13px;color:#666;font-family:Arial,sans-serif;line-height:1.7;">Nos vemos en la pista.</p></td>
    </tr></table></td></tr>
  </table>
</td></tr>

<tr><td style="background:#111111;padding:40px 56px;">
  <p style="margin:0 0 2px;font-size:12px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">Yefangyi Hu Garcia</p>
  <p style="margin:0;font-size:11px;color:#555;font-family:Arial,sans-serif;letter-spacing:1px;">Director &mdash; Dragons Den Basketball Academy</p>
</td></tr>

<tr><td style="background:#0a0a0a;padding:24px 56px;">
  <p style="margin:0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#333;font-family:Arial,sans-serif;">Dragons Den &mdash; dragonsden.es</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const d = req.body || {};
  if (!d.nombre || !d.email) {
    return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(d.email)) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }

  try {
    await Promise.all([
      resend.emails.send({
        from: FROM, to: OWNER, reply_to: d.email,
        subject: `Nueva inscripción — ${d.nombre} · ${d.meses || 'Campus Verano'}`,
        html: ownerHTML(d)
      }),
      resend.emails.send({
        from: FROM, to: d.email,
        subject: 'Tu plaza está reservada — Dragons Den Basketball Academy',
        html: userHTML({ nombre: d.nombre, nivel: d.nivel, meses: d.meses })
      })
    ]);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ success: false, error: 'Error al enviar' });
  }
};
