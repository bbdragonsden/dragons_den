const https = require('https');

const SUPABASE_HOST = 'oyuhyrzjhaqzawwnmwcv.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY      = 'sb_publishable_W4UBtORpWtWnKGzw-x9VbA_gPsDQfzQ';

const VALID_PACKS = ['tiro', 'footwork', 'defensa', 'fisico', 'mental', 'completo', 'all'];
const ONE_YEAR_MS  = 365 * 24 * 60 * 60 * 1000;

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Acceso denegado' });

  const { action, userId, pack, id, estado, notas_admin } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Falta action' });

  // ── ASSIGN / REVOKE require userId ───────────────────────────────────────
  if ((action === 'assign' || action === 'revoke') && !userId)
    return res.status(400).json({ error: 'Falta userId' });

  // ── ASSIGN ────────────────────────────────────────────────────────────────
  if (action === 'assign') {
    if (!pack || !VALID_PACKS.includes(pack))
      return res.status(400).json({ error: `Pack inválido. Opciones: ${VALID_PACKS.join(', ')}` });

    const expiresAt = new Date(Date.now() + ONE_YEAR_MS).toISOString();

    const r = await supabaseService(
      '/rest/v1/user_packs',
      'POST',
      { user_id: userId, pack_id: pack, expires_at: expiresAt },
      { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
    );

    if (r.status === 201 || r.status === 204 || r.status === 200)
      return res.status(200).json({ success: true, message: `Pack "${pack}" asignado hasta ${expiresAt.split('T')[0]}` });

    return res.status(500).json({ error: 'Error al asignar pack', details: r.body });
  }

  // ── REVOKE ────────────────────────────────────────────────────────────────
  if (action === 'revoke') {
    if (!pack) return res.status(400).json({ error: 'Falta pack' });

    const r = await supabaseService(
      `/rest/v1/user_packs?user_id=eq.${userId}&pack_id=eq.${encodeURIComponent(pack)}`,
      'DELETE', null,
      { 'Prefer': 'return=minimal' }
    );

    if (r.status === 204 || r.status === 200)
      return res.status(200).json({ success: true });

    return res.status(500).json({ error: 'Error al revocar pack', details: r.body });
  }

  // ── UPDATE CAMPUS ─────────────────────────────────────────────────────────
  if (action === 'update_campus') {
    if (!id) return res.status(400).json({ error: 'Falta id' });
    const VALID = ['pendiente', 'confirmado', 'cancelado'];
    if (estado !== undefined && !VALID.includes(estado))
      return res.status(400).json({ error: 'Estado inválido' });
    const patch = {};
    if (estado      !== undefined) patch.estado      = estado;
    if (notas_admin !== undefined) patch.notas_admin = notas_admin;
    const r = await supabaseService(
      `/rest/v1/campus_inscripciones?id=eq.${encodeURIComponent(id)}`,
      'PATCH', patch, { 'Prefer': 'return=minimal' }
    );
    if (r.status === 204 || r.status === 200) return res.status(200).json({ success: true });
    return res.status(500).json({ error: 'Error al actualizar', details: r.body });
  }

  // ── UPDATE WAITLIST ───────────────────────────────────────────────────────
  if (action === 'update_waitlist') {
    if (!id) return res.status(400).json({ error: 'Falta id' });
    const VALID = ['en_lista', 'convertido', 'descartado'];
    if (estado !== undefined && !VALID.includes(estado))
      return res.status(400).json({ error: 'Estado inválido' });
    const patch = {};
    if (estado      !== undefined) patch.estado      = estado;
    if (notas_admin !== undefined) patch.notas_admin = notas_admin;
    const r = await supabaseService(
      `/rest/v1/academia_waitlist?id=eq.${encodeURIComponent(id)}`,
      'PATCH', patch, { 'Prefer': 'return=minimal' }
    );
    if (r.status === 204 || r.status === 200) return res.status(200).json({ success: true });
    return res.status(500).json({ error: 'Error al actualizar', details: r.body });
  }

  return res.status(400).json({ error: 'Acción no válida. Usa: assign, revoke, update_campus, update_waitlist' });
};
