const https = require('https');

const SUPABASE_HOST = 'oyuhyrzjhaqzawwnmwcv.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET  = process.env.ADMIN_SECRET;

const VALID_PACKS = ['tiro', 'footwork', 'defensa', 'fisico', 'mental', 'completo', 'all'];

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, pack, secret } = req.body || {};

  if (!secret || secret !== ADMIN_SECRET)
    return res.status(401).json({ error: 'No autorizado' });
  if (!email || !pack)
    return res.status(400).json({ error: 'Faltan campos: email y pack' });
  if (!VALID_PACKS.includes(pack))
    return res.status(400).json({ error: `Pack inválido. Opciones: ${VALID_PACKS.join(', ')}` });

  // Find user by email via admin API
  const usersRes = await supabase('/auth/v1/admin/users?per_page=1000', 'GET');

  if (usersRes.status !== 200)
    return res.status(500).json({ error: 'Error al consultar usuarios', details: usersRes.body });

  const users = usersRes.body.users || [];
  const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

  if (!user)
    return res.status(404).json({ error: `No existe ningún usuario con el email "${email}". Pídele que se registre primero.` });

  // Assign pack (ignore if already exists)
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
