// Cliente mínimo de Supabase con service_role para las funciones de /api.
'use strict';
const https = require('https');
const { SUPABASE_HOST } = require('./util');

const ANON_KEY = 'sb_publishable_W4UBtORpWtWnKGzw-x9VbA_gPsDQfzQ';

function peticion(path, opts) {
  const o = opts || {};
  const key = process.env.SUPABASE_SERVICE_KEY;
  return new Promise((resolve, reject) => {
    const payload = o.body == null ? null : (Buffer.isBuffer(o.body) ? o.body : JSON.stringify(o.body));
    const headers = Object.assign({
      apikey: key,
      Authorization: 'Bearer ' + key,
    }, payload && !Buffer.isBuffer(o.body) ? { 'Content-Type': 'application/json' } : {},
       payload ? { 'Content-Length': Buffer.byteLength(payload) } : {},
       o.headers || {});
    const req = https.request({ hostname: SUPABASE_HOST, path, method: o.method || 'GET', headers }, (res) => {
      const trozos = [];
      res.on('data', (d) => trozos.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(trozos);
        if (o.binario) return resolve({ status: res.statusCode, body: buf });
        const txt = buf.toString('utf8');
        let body = txt;
        try { body = txt ? JSON.parse(txt) : null; } catch (e) { /* texto */ }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(o.timeout || 9000, () => req.destroy(new Error('timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

const rest = {
  get: (tabla, query) => peticion('/rest/v1/' + tabla + '?' + query),
  insert: (tabla, fila, devolver) => peticion('/rest/v1/' + tabla, {
    method: 'POST', body: fila, headers: { Prefer: devolver ? 'return=representation' : 'return=minimal' },
  }),
  update: (tabla, query, cambios) => peticion('/rest/v1/' + tabla + '?' + query, {
    method: 'PATCH', body: cambios, headers: { Prefer: 'return=representation' },
  }),
  rpc: (fn, args) => peticion('/rest/v1/rpc/' + fn, { method: 'POST', body: args || {} }),
};

const storage = {
  firmarSubida: (bucket, ruta) => peticion('/storage/v1/object/upload/sign/' + bucket + '/' + ruta, { method: 'POST', body: {} }),
  firmarLectura: (bucket, ruta, seg) => peticion('/storage/v1/object/sign/' + bucket + '/' + ruta, { method: 'POST', body: { expiresIn: seg || 600 } }),
  descargar: (bucket, ruta) => peticion('/storage/v1/object/' + bucket + '/' + ruta, { binario: true, timeout: 12000 }),
  borrar: (bucket, rutas) => peticion('/storage/v1/object/' + bucket, { method: 'DELETE', body: { prefixes: rutas } }),
};

// Usuario a partir del token del navegador.
async function usuario(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await peticion('/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token } });
  return r.status === 200 ? r.body : null;
}

// app_metadata solo lo escribe el servidor: es la fuente fiable de "admin".
function esAdmin(u) {
  return !!(u && u.app_metadata && u.app_metadata.is_admin === true);
}

async function usuariosPorId() {
  const r = await peticion('/auth/v1/admin/users?per_page=1000');
  const lista = (r.body && r.body.users) || [];
  const m = {};
  for (const u of lista) {
    const md = u.user_metadata || {};
    m[u.id] = { email: u.email, nombre: md.name || md.full_name || (u.email || '').split('@')[0] };
  }
  return m;
}

module.exports = { peticion, rest, storage, usuario, esAdmin, usuariosPorId, SUPABASE_HOST };
