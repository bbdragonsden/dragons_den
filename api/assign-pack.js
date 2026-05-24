const https = require('https');

const SUPABASE_HOST = 'oyuhyrzjhaqzawwnmwcv.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY      = 'sb_publishable_W4UBtORpWtWnKGzw-x9VbA_gPsDQfzQ';

const VALID_PACKS = ['tiro', 'footwork', 'defensa', 'fisico', 'mental', 'completo', 'all'];

const ALLOWED_ORIGINS = ['https://dragonsden.es', 'https://www.dragonsden.es'];

function supabase(path, method, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: SUPABASE_HOST,
      path,
      method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...extraHeaders
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

async function verifyAdmin(authHeader) {
  const token = (authHeader || '').replace('Bearer ', '');
  if (!token) return null;
  const res = await supabase('/auth/v1/user', 'GET', null, {
    'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`
  });
  if (res.status !== 200) return null;
  if (!res.body.user_metadata?.is_admin) return null;
  return res.body;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'No autorizado' });

  const { email, pack } = req.body || {};
  if (!email || !pack)
    return res.status(400).json({ error: 'Faltan campos: email y pack' });
  if (!VALID_PACKS.includes(pack))
    return res.status(400).json({ error: `Pack inválido. Opciones: ${VALID_PACKS.join(', ')}` });

  const usersRes = await supabase('/auth/v1/admin/users?per_page=1000', 'GET');
  if (usersRes.status !== 200)
    return res.status(500).json({ error: 'Error al consultar usuarios', details: usersRes.body });

  const users = usersRes.body.users || [];
  const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
  if (!user)
    return res.status(404).json({ error: `No existe ningún usuario con el email "${email}". Pídele que se registre primero.` });

  const insertRes = await supabase('/rest/v1/user_packs', 'POST',
    { user_id: user.id, pack_id: pack },
    { 'Prefer': 'resolution=ignore-duplicates,return=minimal' }
  );

  if (insertRes.status === 201 || insertRes.status === 204 || insertRes.status === 200) {
    return res.status(200).json({
      success: true,
      message: `Pack "${pack}" asignado a ${email} (${user.user_metadata?.name || 'sin nombre'})`
    });
  }

  return res.status(500).json({ error: 'Error al asignar pack', details: insertRes.body });
};
