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

const ALLOWED_ORIGINS = ['https://dragonsden.es', 'https://www.dragonsden.es'];

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
      `/rest/v1/user_profiles?user_id=eq.${user.id}&select=*`,
      'GET', null, { 'Prefer': '' }
    );
    const profile = Array.isArray(r.body) ? (r.body[0] || null) : null;
    return res.status(200).json({ profile });
  }

  if (req.method === 'POST') {
    const { nombre, edad, posicion, nivel, club, telefono, bio } = req.body || {};

    if (nombre && nombre.length > 100) return res.status(400).json({ error: 'Nombre demasiado largo' });
    if (telefono && telefono.length > 30) return res.status(400).json({ error: 'Teléfono inválido' });

    const record = {
      user_id:    user.id,
      updated_at: new Date().toISOString(),
      nombre:     nombre   != null ? nombre   : undefined,
      edad:       edad     != null ? edad     : undefined,
      posicion:   posicion != null ? posicion : undefined,
      nivel:      nivel    != null ? nivel    : undefined,
      club:       club     != null ? club     : undefined,
      telefono:   telefono != null ? telefono : undefined,
      bio:        bio      != null ? bio      : undefined,
    };
    Object.keys(record).forEach(k => record[k] === undefined && delete record[k]);

    const r = await supabaseService(
      '/rest/v1/user_profiles',
      'POST', record,
      { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
    );

    if (r.status === 201 || r.status === 204 || r.status === 200)
      return res.status(200).json({ success: true });

    return res.status(500).json({ error: 'Error al guardar perfil', details: r.body });
  }

  return res.status(405).end();
};
