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

async function verifyAdmin(authHeader) {
  const token = (authHeader || '').replace('Bearer ', '');
  if (!token) return null;
  const res = await supabaseService('/auth/v1/user', 'GET', null, {
    'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`
  });
  if (res.status !== 200) return null;
  if (!res.body.user_metadata?.is_admin) return null;
  return res.body;
}

const ALLOWED_ORIGINS = ['https://dragonsden.es', 'https://www.dragonsden.es'];

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Acceso denegado' });

  const [usersRes, packsRes] = await Promise.all([
    supabaseService('/auth/v1/admin/users?per_page=1000', 'GET'),
    supabaseService('/rest/v1/user_packs?select=*&order=created_at.desc', 'GET', null, { 'Prefer': '' })
  ]);

  const users = (usersRes.body.users || []).filter(u => u.email);
  const allPacks = Array.isArray(packsRes.body) ? packsRes.body : [];

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.name || u.user_metadata?.full_name || '',
    confirmed: !!u.email_confirmed_at,
    is_admin: !!u.user_metadata?.is_admin,
    created_at: u.created_at,
    packs: allPacks
      .filter(p => p.user_id === u.id)
      .map(p => ({ id: p.id, pack: p.pack_id, expires_at: p.expires_at }))
  })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return res.status(200).json({ users: result });
};
