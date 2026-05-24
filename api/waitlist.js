const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_EMAIL = 'bbdragonsden@gmail.com';
const FROM = 'Dragons Den <onboarding@resend.dev>';

function ownerEmailHTML({ nombre, email, interes }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:48px 24px;">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

    <!-- Header bar -->
    <tr><td style="padding-bottom:40px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:6px;height:6px;background:#c8a96e;border-radius:50%;vertical-align:middle;"></td>
        <td style="padding-left:10px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c8a96e;vertical-align:middle;font-weight:700;">Nueva plaza reservada</td>
      </tr></table>
    </td></tr>

    <!-- Name headline -->
    <tr><td style="padding-bottom:32px;border-bottom:1px solid #1e1e1e;">
      <h1 style="margin:0 0 6px;font-size:38px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1.05;">${nombre}</h1>
      <p style="margin:0;font-size:13px;color:#555555;">${email}</p>
    </td></tr>

    <!-- Pack row -->
    <tr><td style="padding:28px 0 32px;border-bottom:1px solid #1e1e1e;">
      <p style="margin:0 0 6px;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#444444;">Pack de interés</p>
      <p style="margin:0;font-size:17px;color:#c8a96e;font-weight:700;">${interes}</p>
    </td></tr>

    <!-- CTA note -->
    <tr><td style="padding-top:32px;padding-bottom:48px;">
      <p style="margin:0;font-size:13px;color:#444444;line-height:1.7;">Responde a este email directamente para contactar con este lead.</p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="border-top:1px solid #141414;padding-top:24px;">
      <p style="margin:0;font-size:10px;color:#2a2a2a;letter-spacing:1px;text-transform:uppercase;">Dragons Den Basketball Academy · dragonsden.es</p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

function userEmailHTML({ nombre, interes }) {
  const firstName = nombre.split(' ')[0];
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:48px 24px;">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

    <!-- Logo -->
    <tr><td style="padding-bottom:56px;">
      <p style="margin:0;font-size:14px;letter-spacing:5px;text-transform:uppercase;color:#c8a96e;font-weight:900;">Dragons Den</p>
    </td></tr>

    <!-- Eyebrow -->
    <tr><td style="padding-bottom:14px;">
      <p style="margin:0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#c8a96e;">Plaza reservada</p>
    </td></tr>

    <!-- Big headline -->
    <tr><td style="padding-bottom:40px;border-bottom:1px solid #1e1e1e;">
      <h1 style="margin:0;font-size:60px;font-weight:900;color:#ffffff;letter-spacing:-2px;line-height:0.95;text-transform:uppercase;">Est&aacute;s<br>dentro.</h1>
    </td></tr>

    <!-- Body copy -->
    <tr><td style="padding:36px 0 28px;">
      <p style="margin:0 0 18px;font-size:15px;color:#888888;line-height:1.8;">Hola ${firstName},</p>
      <p style="margin:0 0 18px;font-size:15px;color:#888888;line-height:1.8;">
        Tu plaza en la lista de espera est&aacute; confirmada. Eres de los primeros en apuntarte —
        cuando lancemos este verano <span style="color:#ffffff;font-weight:700;">ser&aacute;s el primero en saberlo
        y tendr&aacute;s el precio de lanzamiento bloqueado</span> antes de que suba.
      </p>
      <p style="margin:0;font-size:15px;color:#888888;line-height:1.8;">
        El contenido se graba en los entrenamientos del verano 2026.
        Los mismos ejercicios que usamos en pista, para que puedas entrenar
        cuando quieras y donde quieras.
      </p>
    </td></tr>

    <!-- Pack chip -->
    <tr><td style="padding-bottom:44px;">
      <table cellpadding="0" cellspacing="0" style="border:1px solid #1e1e1e;width:100%;">
        <tr><td style="padding:18px 24px;">
          <p style="margin:0 0 5px;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#444444;">Pack seleccionado</p>
          <p style="margin:0;font-size:16px;color:#c8a96e;font-weight:700;">${interes}</p>
        </td></tr>
      </table>
    </td></tr>

    <!-- Sign off -->
    <tr><td style="border-top:1px solid #141414;padding-top:32px;padding-bottom:48px;">
      <p style="margin:0 0 4px;font-size:14px;color:#cccccc;">Nos vemos en pista.</p>
      <p style="margin:0;font-size:14px;color:#444444;">&mdash; Yefangyi &middot; Dragons Den Basketball Academy</p>
    </td></tr>

    <!-- Footer -->
    <tr><td>
      <p style="margin:0;font-size:10px;color:#2a2a2a;letter-spacing:1px;">@dragonsdenbasketball &middot; dragonsden.es</p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nombre, email, interes } = req.body || {};

  if (!nombre || !email || !interes) {
    return res.status(400).json({ success: false, error: 'Faltan campos' });
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }
  if (nombre.length > 100 || email.length > 254) {
    return res.status(400).json({ success: false, error: 'Campo demasiado largo' });
  }
  const VALID_INTERES = [
    'Pack Tiro', 'Pack Footwork', 'Pack Defensa',
    'Pack Físico', 'Pack Mental', 'Pack Completo'
  ];
  if (!VALID_INTERES.includes(interes)) {
    return res.status(400).json({ success: false, error: 'Pack inválido' });
  }

  try {
    await Promise.all([
      resend.emails.send({
        from: FROM,
        to: OWNER_EMAIL,
        reply_to: email,
        subject: `Nueva plaza — ${nombre} · ${interes}`,
        html: ownerEmailHTML({ nombre, email, interes })
      }),
      resend.emails.send({
        from: FROM,
        to: email,
        subject: 'Tu plaza está reservada — Dragons Den Academy',
        html: userEmailHTML({ nombre, interes })
      })
    ]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ success: false, error: 'Error al enviar' });
  }
};
