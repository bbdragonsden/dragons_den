// Utilidades compartidas por las funciones de /api.
// La carpeta _lib no se publica como funcion (Vercel ignora los nombres con _).
const https = require('https');

const SUPABASE_HOST = 'oyuhyrzjhaqzawwnmwcv.supabase.co';

// Resend se crea al usarlo, no al cargar el modulo: si falta RESEND_API_KEY,
// "new Resend(undefined)" lanzaba una excepcion al importar el archivo y la
// funcion entera respondia 500, incluso a un GET.
let _resend = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    const { Resend } = require('resend');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

async function sendMail(msg) {
  const r = getResend();
  if (!r) throw new Error('RESEND_API_KEY no configurada');
  const out = await r.emails.send(msg);
  if (out && out.error) throw new Error(out.error.message || 'Resend error');
  return out;
}

// Escapa texto del usuario antes de meterlo en el HTML de un email.
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function str(v, max) {
  if (v == null) return '';
  return String(v).trim().slice(0, max || 500);
}

function supabaseInsert(table, record) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(record);
    const req = https.request({
      hostname: SUPABASE_HOST,
      path: `/rest/v1/${table}`,
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        let body = data;
        try { body = data ? JSON.parse(data) : {}; } catch (e) { /* texto plano */ }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Inserta "base + extra". Si la tabla todavia no tiene las columnas nuevas
// (PostgREST responde 400 / PGRST204, columna desconocida), repite solo con
// "base" para no perder la solicitud mientras no se aplique la migracion de
// sql/propuestas/.
async function insertWithFallback(table, base, extra) {
  const r = await supabaseInsert(table, Object.assign({}, base, extra || {}));
  if (r.status >= 200 && r.status < 300) return r;
  const code = r.body && r.body.code;
  if (extra && Object.keys(extra).length && (code === 'PGRST204' || code === '42703')) {
    console.warn(`[${table}] columnas nuevas no disponibles, guardando sin ellas`);
    return supabaseInsert(table, base);
  }
  return r;
}

// Solo URLs https (evita javascript:, data:, http: en enlaces que luego se pintan).
function isHttpsUrl(s) {
  try { return new URL(String(s)).protocol === 'https:'; } catch (e) { return false; }
}

module.exports = { SUPABASE_HOST, getResend, sendMail, esc, str, supabaseInsert, insertWithFallback, isHttpsUrl };
