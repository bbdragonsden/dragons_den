const https = require('https');

const SUPABASE_HOST = 'oyuhyrzjhaqzawwnmwcv.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY      = 'sb_publishable_W4UBtORpWtWnKGzw-x9VbA_gPsDQfzQ';

function supabaseService(path, method, body, extra = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: SUPABASE_HOST, path, method,
      headers: {
        'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...extra
      }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function verifyUser(authHeader) {
  const token = (authHeader || '').replace('Bearer ', '');
  if (!token) return null;
  const res = await supabaseService('/auth/v1/user', 'GET', null, {
    'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`
  });
  if (res.status !== 200) return null;
  return res.body;
}

const ALLOWED_ORIGINS = ['https://dragonsden.es', 'https://www.dragonsden.es', 'https://dragons-den-eight.vercel.app'];

// Solo enlaces https: un "javascript:..." guardado aqui se pintaria luego
// como enlace en el panel del entrenador.
function isValidUrl(str) {
  try { return new URL(String(str)).protocol === 'https:'; } catch { return false; }
}

const CONSENT_VERSION = 'video-2026-09';

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyUser(req.headers.authorization);
  if (!user) return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    const r = await supabaseService(
      `/rest/v1/analisis_videos?user_id=eq.${user.id}&select=*&order=created_at.desc`,
      'GET', null, { 'Prefer': '' }
    );
    return res.status(200).json({ videos: Array.isArray(r.body) ? r.body : [] });
  }

  if (req.method === 'POST') {
    const { titulo, url_video, descripcion, consentimiento_video, consentimiento_por } = req.body || {};

    if (!titulo || !url_video) return res.status(400).json({ error: 'Faltan campos obligatorios' });
    if (titulo.length > 200) return res.status(400).json({ error: 'Título demasiado largo' });
    if (typeof titulo !== 'string' || typeof url_video !== 'string') return res.status(400).json({ error: 'Datos no válidos' });
    if (url_video.length > 1000 || !isValidUrl(url_video)) return res.status(400).json({ error: 'La URL del vídeo debe empezar por https://' });
    // Consentimiento especifico para tratar la imagen del jugador en el video.
    if (consentimiento_video !== true) return res.status(400).json({ error: 'Falta el consentimiento para el análisis del vídeo' });
    const por = consentimiento_por === 'tutor' ? 'tutor' : 'jugador';
    if (descripcion && descripcion.length > 2000) return res.status(400).json({ error: 'Descripción demasiado larga' });

    const base = {
      user_id:     user.id,
      email:       user.email,
      titulo,
      url_video,
      descripcion: descripcion || null,
      estado:      'pendiente'
    };
    let r = await supabaseService('/rest/v1/analisis_videos', 'POST', Object.assign({}, base, {
      consentimiento_video:   true,
      consentimiento_por:     por,
      consentimiento_version: CONSENT_VERSION,
      consentimiento_at:      new Date().toISOString()
    }), { 'Prefer': 'return=minimal' });
    // Mientras no se aplique sql/propuestas/ (columnas de consentimiento),
    // se guarda sin ellas para no perder el envio.
    if (r.status === 400 && r.body && (r.body.code === 'PGRST204' || r.body.code === '42703')) {
      r = await supabaseService('/rest/v1/analisis_videos', 'POST', base, { 'Prefer': 'return=minimal' });
    }

    if (r.status === 201 || r.status === 200) return res.status(200).json({ success: true });
    return res.status(500).json({ error: 'Error al enviar', details: r.body });
  }

  return res.status(405).end();
};
