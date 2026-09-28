const { sendMail, esc, str, insertWithFallback } = require('./_lib/util');

// Version del texto de consentimiento que se muestra en el formulario.
// Si cambia el texto de las casillas, sube esta version.
const CONSENT_VERSION = 'inscripcion-2026-09';

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
      <td style="padding-left:10px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c8a96e;vertical-align:middle;font-weight:700;">Nueva solicitud &mdash; Dragons Den</td>
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
      ${row('Fecha de nacimiento', d.fecha_nacimiento)}
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
      ${section('Programa solicitado')}
      ${row('Programa', d.meses)}
      ${row('Alumni', d.anterior)}
      ${section('Objetivo y salud')}
      ${row('Objetivo', d.objetivo)}
      ${row('Salud (con consentimiento expl&iacute;cito)', d.lesiones)}
      ${section('Consentimientos')}
      ${row('Gesti&oacute;n de la solicitud', d.c_privacidad)}
      ${row('Datos de salud', d.c_salud)}
      ${row('Comunicaciones / WhatsApp', d.c_comunicaciones)}
      ${section('Marketing')}
      ${row('C&oacute;mo nos conoci&oacute;', d.origen)}
      ${d.comentarios && d.comentarios !== '—' ? section('Comentarios') + row('', d.comentarios) : ''}
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #141414;padding-top:20px;margin-top:32px;">
    <p style="margin:0;font-size:10px;color:#2a2a2a;letter-spacing:1px;text-transform:uppercase;">Dragons Den Basketball Academy</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

function userHTML({ nombre, nivel, meses }) {
  // Llega ya escapado desde el handler.
  const firstName = (nombre || '').split(' ')[0];
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#0a0a0a;">Hemos recibido tu solicitud en Dragons Den Basketball Academy. Te escribimos en 24&ndash;48 h.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:48px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0a0a0a;">

<tr><td><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#c8a96e;height:1px;font-size:0;">&nbsp;</td></tr></table></td></tr>

<tr><td style="padding:52px 56px 40px;">
  <p style="margin:0;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#c8a96e;font-family:Arial,sans-serif;">Basketball Academy &mdash; Torrevieja</p>
  <h1 style="margin:28px 0 0;font-size:64px;line-height:0.9;letter-spacing:6px;color:#ffffff;font-family:Arial Black,Arial,sans-serif;text-transform:uppercase;font-weight:900;">DRAGONS<br><span style="color:#c8a96e;">DEN</span></h1>
</td></tr>

<tr><td style="padding:0 56px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#c8a96e;height:1px;font-size:0;">&nbsp;</td></tr></table></td></tr>

<tr><td style="padding:56px 56px 48px;">
  <p style="margin:0 0 32px;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#c8a96e;font-family:Arial,sans-serif;">Solicitud recibida</p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-left:2px solid #c8a96e;padding-left:24px;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#666;font-family:Arial,sans-serif;">Bienvenido/a</p>
    <h2 style="margin:0;font-size:38px;letter-spacing:3px;color:#ffffff;font-family:Arial Black,Arial,sans-serif;text-transform:uppercase;line-height:1.1;">${firstName}</h2>
  </td></tr></table>
  <p style="margin:32px 0 0;font-size:15px;color:#999;line-height:1.9;font-family:Arial,sans-serif;">Hemos recibido tu solicitud. Todav&iacute;a no es una plaza confirmada: en las pr&oacute;ximas <span style="color:#ffffff;font-weight:600;">24&ndash;48 horas</span> te escribiremos por WhatsApp o email para confirmar disponibilidad, horario, lugar y precio final. El pago (Bizum o efectivo) solo se hace despu&eacute;s de esa confirmaci&oacute;n.</p>
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
        <td style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#555;font-family:Arial,sans-serif;width:100px;vertical-align:top;padding-top:2px;">Programa</td>
        <td style="font-size:14px;color:#e8e8e8;font-family:Arial,sans-serif;">${meses}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#555;font-family:Arial,sans-serif;width:100px;vertical-align:top;padding-top:6px;">Estado</td>
        <td><span style="display:inline-block;background:rgba(200,169,110,0.1);border:1px solid rgba(200,169,110,0.4);color:#c8a96e;font-size:9px;letter-spacing:2px;text-transform:uppercase;padding:5px 14px;font-family:Arial,sans-serif;">Pendiente de confirmar</span></td>
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
      <td><p style="margin:0 0 4px;font-size:13px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">Confirmaci&oacute;n por el entrenador</p><p style="margin:0;font-size:13px;color:#666;font-family:Arial,sans-serif;line-height:1.7;">Te contactamos en 24&ndash;48&nbsp;h por WhatsApp o email con disponibilidad, horario, lugar y precio.</p></td>
    </tr></table></td></tr>
    <tr><td style="padding-bottom:24px;"><table cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="padding-right:20px;"><p style="margin:0;font-size:9px;letter-spacing:2px;color:#c8a96e;font-family:Arial,sans-serif;border:1px solid #c8a96e;width:24px;height:24px;text-align:center;line-height:24px;">02</p></td>
      <td><p style="margin:0 0 4px;font-size:13px;color:#ffffff;font-family:Arial,sans-serif;font-weight:600;">Pago y comienzo</p><p style="margin:0;font-size:13px;color:#666;font-family:Arial,sans-serif;line-height:1.7;">Si decides seguir adelante, pagas por Bizum o en efectivo y te enviamos la confirmaci&oacute;n por escrito. Condiciones: dragons-den-eight.vercel.app/condiciones.html</p></td>
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
  <p style="margin:0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#333;font-family:Arial,sans-serif;">Dragons Den</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function edadDesde(fechaISO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaISO || '');
  if (!m) return null;
  const nac = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (isNaN(nac)) return null;
  const hoy = new Date();
  let e = hoy.getUTCFullYear() - nac.getUTCFullYear();
  const mm = hoy.getUTCMonth() - nac.getUTCMonth();
  if (mm < 0 || (mm === 0 && hoy.getUTCDate() < nac.getUTCDate())) e--;
  return e;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const d = (req.body && typeof req.body === 'object') ? req.body : {};

  // Trampa para bots: el campo _honey esta oculto a las personas. Si viene
  // relleno se responde como si todo hubiera ido bien y no se guarda nada.
  if (str(d._honey)) return res.status(200).json({ success: true });

  const nombre = str(d.nombre, 120);
  const email  = str(d.email, 254);
  if (!nombre || !email) {
    return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }
  // La casilla obligatoria solo cubre gestionar la solicitud.
  if (d.acepta_privacidad !== true) {
    return res.status(400).json({ success: false, error: 'Falta aceptar el tratamiento de datos para gestionar la solicitud' });
  }

  const fechaNac = str(d.fecha_nacimiento, 10);
  const edadNum  = edadDesde(fechaNac) ?? (parseInt(d.edad, 10) || null);
  if (edadNum == null || edadNum < 3 || edadNum > 99) {
    return res.status(400).json({ success: false, error: 'Fecha de nacimiento no válida' });
  }
  const tutorNombre = str(d.tutor_nombre, 120);
  const esMenor = edadNum < 18;
  // Menores: la solicitud la hace el padre, la madre o el tutor legal
  // (por debajo de 14 el consentimiento solo lo puede dar el tutor; art. 7 LOPDGDD).
  if (esMenor && (!tutorNombre || tutorNombre === '—')) {
    return res.status(400).json({ success: false, error: 'Para menores de 18 años la solicitud la hace el padre, la madre o el tutor legal' });
  }
  if (esMenor && d.tutor_declara !== true) {
    return res.status(400).json({ success: false, error: 'Falta la declaración del padre, la madre o el tutor legal' });
  }

  // Salud: solo con consentimiento explicito (art. 9.2.a RGPD). Sin el, el
  // texto se descarta aqui y no llega ni al email ni a la base de datos.
  const consienteSalud = d.consiente_salud === true;
  const lesionesTxt = str(d.lesiones, 1000);
  const lesiones = consienteSalud && lesionesTxt && lesionesTxt !== '—' ? lesionesTxt : null;
  const aceptaComunicaciones = d.acepta_comunicaciones === true;

  const clean = {
    para_quien:     esMenor ? 'Para su hijo/a' : (str(d.para_quien, 40) || 'Para sí mismo/a'),
    nombre,
    fecha_nacimiento: fechaNac || null,
    edad:           String(edadNum),
    posicion:       str(d.posicion, 40) || null,
    nivel:          str(d.nivel, 60) || null,
    club:           str(d.club, 120) || null,
    tutor_nombre:   esMenor ? tutorNombre : (tutorNombre && tutorNombre !== '—' ? tutorNombre : null),
    tutor_relacion: str(d.tutor_relacion, 40) || null,
    email,
    telefono:       str(d.telefono, 30) || null,
    anterior:       str(d.anterior, 80) || null,
    meses:          str(d.programa || d.meses, 200) || null,
    lesiones,
    objetivo:       str(d.objetivo, 80) || null,
    origen:         str(d.origen, 80) || null,
    comentarios:    str(d.comentarios, 2000) || null
  };

  // Todo lo que va al HTML del email, escapado.
  const e = {};
  Object.keys(clean).forEach(k => { e[k] = clean[k] == null ? '' : esc(clean[k]); });
  e.telefono = e.telefono || '';
  e.c_privacidad     = 'S&iacute;';
  e.c_salud          = consienteSalud ? 'S&iacute;' : 'No (no se guarda informaci&oacute;n de salud)';
  e.c_comunicaciones = aceptaComunicaciones ? 'S&iacute;' : 'No';

  const ahora = new Date().toISOString();
  const tareas = await Promise.allSettled([
    insertWithFallback('campus_inscripciones', clean, {
      acepta_privacidad:     true,
      consiente_salud:       consienteSalud,
      acepta_comunicaciones: aceptaComunicaciones,
      consentimiento_version: CONSENT_VERSION,
      consentimiento_at:     ahora
    }),
    sendMail({
      from: FROM, to: OWNER, reply_to: email,
      subject: `Nueva solicitud — ${clean.nombre} · ${clean.meses || 'Dragons Den'}`,
      html: ownerHTML(e)
    }),
    sendMail({
      from: FROM, to: email,
      subject: 'Hemos recibido tu solicitud — Dragons Den Basketball Academy',
      html: userHTML({ nombre: e.nombre, nivel: e.nivel, meses: e.meses })
    })
  ]);

  const [db, avisoDueno, avisoUsuario] = tareas;
  const dbOk = db.status === 'fulfilled' && db.value.status >= 200 && db.value.status < 300;
  const duenoOk = avisoDueno.status === 'fulfilled';
  if (!dbOk) console.error('Inscripcion: fallo al guardar', db.status === 'fulfilled' ? db.value : db.reason);
  if (!duenoOk) console.error('Inscripcion: fallo email al responsable', avisoDueno.reason);
  if (avisoUsuario.status !== 'fulfilled') console.error('Inscripcion: fallo email al usuario', avisoUsuario.reason);

  // La solicitud cuenta como recibida si quedo guardada o si el responsable
  // recibio el aviso. Si fallan las dos cosas, el usuario debe saberlo.
  if (dbOk || duenoOk) return res.status(200).json({ success: true });
  return res.status(500).json({ success: false, error: 'Error al enviar' });
};
