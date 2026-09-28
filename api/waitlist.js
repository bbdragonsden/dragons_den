const { sendMail, esc, str, insertWithFallback } = require('./_lib/util');

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
      <p style="margin:0;font-size:10px;color:#2a2a2a;letter-spacing:1px;text-transform:uppercase;">Dragons Den Basketball Academy</p>
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
      <p style="margin:0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#c8a96e;">Lista de espera</p>
    </td></tr>

    <!-- Big headline -->
    <tr><td style="padding-bottom:40px;border-bottom:1px solid #1e1e1e;">
      <h1 style="margin:0;font-size:60px;font-weight:900;color:#ffffff;letter-spacing:-2px;line-height:0.95;text-transform:uppercase;">Te<br>avisaremos.</h1>
    </td></tr>

    <!-- Body copy -->
    <tr><td style="padding:36px 0 28px;">
      <p style="margin:0 0 18px;font-size:15px;color:#888888;line-height:1.8;">Hola ${firstName},</p>
      <p style="margin:0 0 18px;font-size:15px;color:#888888;line-height:1.8;">
        Te hemos apuntado a la lista de espera de la Academia Online. Apuntarte no te compromete
        a nada ni supone ning&uacute;n pago: cuando el contenido est&eacute; publicado
        <span style="color:#ffffff;font-weight:700;">te escribiremos con la fecha y el precio final</span>.
      </p>
      <p style="margin:0;font-size:15px;color:#888888;line-height:1.8;">
        Si en alg&uacute;n momento quieres salir de la lista, responde a este email y te borramos.
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
      <p style="margin:0;font-size:10px;color:#2a2a2a;letter-spacing:1px;">@dragonsdenbasketball</p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// El formulario de academia.html envia el valor del <select> (slug).
// Antes el servidor solo aceptaba la etiqueta ("Pack Tiro") y rechazaba
// todas las altas con 400.
const INTERES = {
  'pack-tiro':       'Pack Tiro',
  'pack-footwork':   'Pack Footwork',
  'pack-defensa':    'Pack Defensa',
  'pack-fisico':     'Pack Físico',
  'pack-mentalidad': 'Pack Mental',
  'pack-completo':   'Pack Completo',
  'todavia-no-se':   'Aún no lo sé'
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  if (str(b._honey)) return res.status(200).json({ success: true });

  const nombre = str(b.nombre, 100);
  const email  = str(b.email, 254);
  const rawInteres = str(b.interes, 60);
  const interes = INTERES[rawInteres] || (Object.values(INTERES).includes(rawInteres) ? rawInteres : null);

  if (!nombre || !email || !rawInteres) {
    return res.status(400).json({ success: false, error: 'Faltan campos' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }
  if (!interes) {
    return res.status(400).json({ success: false, error: 'Pack inválido' });
  }
  if (b.acepta_privacidad !== true) {
    return res.status(400).json({ success: false, error: 'Falta aceptar la política de privacidad' });
  }

  const e = { nombre: esc(nombre), email: esc(email), interes: esc(interes) };
  const [db, dueno, usuario] = await Promise.allSettled([
    insertWithFallback('academia_waitlist', { nombre, email, interes }, {
      acepta_privacidad: true,
      consentimiento_at: new Date().toISOString()
    }),
    sendMail({
      from: FROM, to: OWNER_EMAIL, reply_to: email,
      subject: `Lista de espera — ${nombre} · ${interes}`,
      html: ownerEmailHTML(e)
    }),
    sendMail({
      from: FROM, to: email,
      subject: 'Estás en la lista de espera — Dragons Den Academy',
      html: userEmailHTML({ nombre: e.nombre, interes: e.interes })
    })
  ]);

  const dbOk = db.status === 'fulfilled' && db.value.status >= 200 && db.value.status < 300;
  if (!dbOk) console.error('Waitlist: fallo al guardar', db.status === 'fulfilled' ? db.value : db.reason);
  if (dueno.status !== 'fulfilled') console.error('Waitlist: fallo email responsable', dueno.reason);
  if (usuario.status !== 'fulfilled') console.error('Waitlist: fallo email usuario', usuario.reason);

  if (dbOk || dueno.status === 'fulfilled') return res.status(200).json({ success: true });
  return res.status(500).json({ success: false, error: 'Error al enviar' });
};
