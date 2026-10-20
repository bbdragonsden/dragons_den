#!/usr/bin/env node
// Prueba de punta a punta de /api/checkin con una base de datos simulada en memoria.
// No toca Supabase. Uso: node scripts/probar-checkin.js
'use strict';
const path = require('path'), crypto = require('crypto');
// ── Falso PostgREST en memoria ──
const T = { checkins: [], revisiones: [], equipos_jugador: [], xp_movimientos: [], consentimiento_bienestar: [], consentimientos_tutor: [], mediciones: [], recompensas_entregadas: [], canjes: [] };
const STORE = {};
let uid = 0; const nid = () => '00000000-0000-4000-8000-' + String(++uid).padStart(12, '0');
function filtrar(tabla, q) {
  const p = new URLSearchParams(q); let rows = T[tabla].slice();
  for (const [k, v] of p) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
    const [op, ...r] = v.split('.'); const val = r.join('.');
    rows = rows.filter((x) => {
      const c = x[k];
      if (op === 'eq') return String(c) === val;
      if (op === 'gte') return String(c) >= val;
      if (op === 'like') return String(c || '').startsWith(val.replace(/\*$/, ''));
      if (op === 'lt') return String(c) < val;
      if (op === 'in') return val.replace(/[()]/g, '').split(',').includes(String(c));
      if (op === 'is' && val === 'null') return c == null;
      if (op === 'not' && val === 'is.null') return c != null;
      throw new Error('op ' + op);
    });
  }
  const ord = p.get('order');
  if (ord) { const [col, dir] = ord.split(',')[0].split('.'); rows.sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === 'desc' ? -1 : 1)); }
  if (p.get('limit')) rows = rows.slice(0, +p.get('limit'));
  return rows;
}
const rest = {
  get: async (t, q) => ({ status: 200, body: filtrar(t, q) }),
  insert: async (t, fila) => {
    const f = Object.assign({ id: nid(), created_at: new Date().toISOString() }, fila);
    if (t === 'checkins') { f.carga = f.rpe * f.duracion_min; f.validado_por = f.validado_por || 'sin_validar'; }
    if (t === 'revisiones') f.estado = f.estado || 'pendiente';
    if (t === 'xp_movimientos' && f.referencia && T.xp_movimientos.some((x) => x.user_id === f.user_id && x.motivo === f.motivo && x.referencia === f.referencia)) return { status: 409, body: { code: '23505' } };
    T[t].push(f); return { status: 201, body: [f] };
  },
  update: async (t, q, cambios) => { const rows = filtrar(t, q); rows.forEach((r) => Object.assign(r, cambios)); return { status: 200, body: rows }; },
  rpc: async (fn, a) => {
    if (fn === 'puede_registrar_bienestar') return { status: 200, body: T.consentimiento_bienestar.some((c) => c.user_id === a.p_user && !c.revocado_en) };
    if (fn === 'puede_subir_video') return { status: 200, body: true };
  },
};
const storage = {
  firmarSubida: async (b, ruta) => ({ status: 200, body: { url: '/object/upload/sign/' + b + '/' + ruta + '?token=TOK' } }),
  firmarLectura: async (b, ruta) => ({ status: 200, body: { signedURL: '/object/sign/' + b + '/' + ruta + '?token=V' } }),
  descargar: async (b, ruta) => STORE[ruta] ? { status: 200, body: STORE[ruta] } : { status: 404, body: Buffer.alloc(0) },
  borrar: async () => ({ status: 200 }),
};
const JUG = { id: '11111111-1111-4111-8111-111111111111', email: 'j@x.es', app_metadata: {}, user_metadata: { name: 'Jugador' } };
const ADM = { id: 'u-admin', email: 'a@x.es', app_metadata: { is_admin: true } };
const fake = { rest, storage, peticion: async (p, o) => {
    if (p.startsWith('/rest/v1/consentimiento_bienestar')) { T.consentimiento_bienestar = T.consentimiento_bienestar.filter((c) => c.user_id !== o.body.user_id); T.consentimiento_bienestar.push(o.body); return { status: 201 }; }
    if (p.startsWith('/rest/v1/mediciones')) { T.mediciones = T.mediciones.filter((m) => !(m.user_id === o.body.user_id && m.fecha === o.body.fecha)); T.mediciones.push(o.body); return { status: 201 }; }
    if (p.startsWith('/rest/v1/recompensas_entregadas')) { if (!T.recompensas_entregadas.some((r) => r.user_id === o.body.user_id && r.nivel === o.body.nivel && r.temporada === o.body.temporada)) T.recompensas_entregadas.push(Object.assign({ id: nid(), estado: 'pendiente', created_at: new Date().toISOString() }, o.body)); return { status: 201 }; }
    throw new Error('peticion ' + p); },
  usuario: async (req) => (req.headers.authorization === 'Bearer admin' ? ADM : req.headers.authorization === 'Bearer jug' ? JUG : null),
  esAdmin: (u) => !!(u && u.app_metadata && u.app_metadata.is_admin), usuariosPorId: async () => ({ '11111111-1111-4111-8111-111111111111': { email: 'j@x.es', nombre: 'Jugador' } }), SUPABASE_HOST: 'x.supabase.co' };
require.cache[require.resolve('../api/_lib/supa')] = { id: 'supa', filename: 'supa', loaded: true, exports: fake };
const handler = require('../api/checkin.js');
async function call(who, method, body, query) {
  return new Promise((ok) => {
    const res = { code: 200, headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { ok({ code: this.code, body: b }); }, end() { ok({ code: this.code }); } };
    handler({ method, headers: { authorization: 'Bearer ' + who, origin: '' }, body, query: query || {} }, res);
  });
}
const ok = (c, m) => { if (!c) { console.log('FALLO:', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  let r = await call('nadie', 'GET'); ok(r.code === 401, 'sin sesión → 401');
  r = await call('jug', 'GET'); ok(r.code === 200 && r.body.bienestar === false, 'estado inicial sin bienestar');
  r = await call('jug', 'POST', { accion: 'equipo', nombre: 'Infantil A', tipo: 'club', duracion: 90 }); ok(r.code === 200, 'equipo club creado'); const club = r.body.equipo.id;
  r = await call('jug', 'POST', { accion: 'equipo', nombre: 'Dragons Den', tipo: 'dragons_den', duracion: 60 }); const dd = r.body.equipo.id;
  r = await call('jug', 'POST', { accion: 'bienestar', fecha_nacimiento: '2012-05-01', acepto: true }); ok(r.code === 200, 'bienestar con 14 años, lo da el jugador');
  r = await call('jug', 'POST', { accion: 'bienestar', fecha_nacimiento: '2015-05-01', acepto: true }); ok(r.code === 403, 'menor de 14 sin tutor → 403');
  r = await call('jug', 'POST', { accion: 'bienestar', fecha_nacimiento: '2012-05-01', acepto: true }); ok(r.code === 200, 'vuelve a dar permiso');
  const base = { tipo: 'partido', equipo_id: club, fecha: 'hoy', duracion_min: 90, minutos_jugados: 15, resultado: 'derrota', rpe: 8, calentamiento: 0, energia: 2, disfrute: 2, sueno: 'menos7', dolor: 2, dolor_zona: ['tobillo'], animo: 3, concentracion: 3, nervios: 'bloquearon', mejor: 'defensa', mejorar: 'tiro', causa: 'externo', proximo: 'Pies preparados antes de recibir', comentario: 'Hoy he fallado muchos tiros abiertos porque llegaba cansado, pero en defensa hablé en cada bloqueo' };
  r = await call('jug', 'POST', { accion: 'guardar', respuestas: Object.assign({}, base, { rpe: 15 }) }); ok(r.code === 400 && r.body.campos.includes('rpe'), 'esfuerzo fuera de rango → 400');
  r = await call('jug', 'POST', { accion: 'guardar', respuestas: base });
  ok(r.code === 200 && r.body.necesita_prueba && r.body.consejo.principal.id === 'dolor', 'check-in de partido guardado, consejo de molestia primero');
  ok(r.body.consejo.alertas.some((a) => a.tipo === 'dolor' && a.nivel === 'alta'), 'alerta de molestia para el entrenador');
  ok(r.body.revision_comentario && r.body.revision_comentario.estado === 'pendiente', 'comentario en revisión, sin XP aún');
  const ck1 = r.body.checkin;
  ok(T.xp_movimientos.length === 0, 'ningún XP antes de revisar');
  // segundo check-in: debe pedir foco_cumplido
  r = await call('jug', 'POST', { accion: 'guardar', respuestas: Object.assign({}, base, { tipo: 'entreno', equipo_id: dd, comentario: '' }) });
  ok(r.code === 400 && r.body.campos.includes('foco_cumplido'), 'con foco anterior, exige foco_cumplido');
  r = await call('jug', 'POST', { accion: 'guardar', respuestas: Object.assign({}, base, { tipo: 'entreno', equipo_id: dd, comentario: '', foco_cumplido: 1 }) });
  ok(r.code === 200 && !r.body.necesita_prueba && r.body.checkin.foco === 'Pies preparados antes de recibir', 'entreno de Dragons Den sin prueba y con foco');
  const ck2 = r.body.checkin;
  r = await call('jug', 'POST', { accion: 'guardar', respuestas: Object.assign({}, base, { comentario: '', foco_cumplido: 2 }) }); ok(r.code === 200, 'tercera sesión del día');
  r = await call('jug', 'POST', { accion: 'guardar', respuestas: Object.assign({}, base, { comentario: '', foco_cumplido: 2 }) }); ok(r.code === 429, 'cuarta sesión del día → 429');
  // prueba en vídeo
  r = await call('jug', 'POST', { accion: 'codigo', checkin_id: ck1.id }); ok(r.code === 200 && /^\d\d$/.test(r.body.codigo), 'código de prueba ' + r.body.codigo + ' · ' + r.body.gesto);
  const rid = r.body.revision_id;
  const video = crypto.randomBytes(40000); const sha = crypto.createHash('sha256').update(video).digest('hex');
  const meta = { accion: 'subida', revision_id: rid, sha256: sha, firma: 'a'.repeat(64), duracion_seg: 5, bytes: video.length, mime: 'video/mp4', grabado_en: new Date().toISOString() };
  r = await call('jug', 'POST', Object.assign({}, meta, { duracion_seg: 30 })); ok(r.code === 400, 'vídeo de 30 s → 400');
  r = await call('jug', 'POST', meta); ok(r.code === 200 && r.body.token === 'TOK', 'URL de subida firmada');
  STORE[r.body.ruta] = video;
  r = await call('jug', 'POST', { accion: 'confirmar', revision_id: rid }); ok(r.body.estado === 'pendiente', 'subida confirmada, en revisión');
  // otro check-in reutilizando el mismo vídeo
  const otro = T.checkins.find((c) => c.id !== ck1.id && c.equipo_tipo === 'club');
  r = await call('jug', 'POST', { accion: 'codigo', checkin_id: otro.id }); const rid2 = r.body.revision_id;
  r = await call('jug', 'POST', Object.assign({}, meta, { revision_id: rid2 })); ok(r.code === 200 && r.body.aviso, 'mismo vídeo: aviso de repetido');
  STORE[r.body.ruta] = video;
  r = await call('jug', 'POST', { accion: 'confirmar', revision_id: rid2 }); ok(r.body.estado === 'repetido', 'mismo vídeo → marcado repetido');
  // archivo distinto del declarado
  const ck3 = T.checkins.find((c) => c.id !== ck1.id && c.id !== otro.id && c.equipo_tipo === 'club');
  if (ck3) {
    r = await call('jug', 'POST', { accion: 'codigo', checkin_id: ck3.id }); const rid3 = r.body.revision_id;
    const meta3 = Object.assign({}, meta, { revision_id: rid3, sha256: 'b'.repeat(64), firma: 'f'.repeat(64) });
    r = await call('jug', 'POST', meta3); STORE[r.body.ruta] = crypto.randomBytes(40000);
    r = await call('jug', 'POST', { accion: 'confirmar', revision_id: rid3 });
    const rv3 = T.revisiones.find((x) => x.id === rid3); ok(rv3.prefiltro.sugerencia === 'rechazar', 'huella falseada → sugerencia rechazar');
  }
  // panel del entrenador
  r = await call('jug', 'GET', null, { vista: 'revision' }); ok(r.code === 403, 'jugador no ve el panel');
  r = await call('admin', 'GET', null, { vista: 'revision' });
  ok(r.code === 200 && r.body.pendientes.length >= 2 && r.body.sin_validar.length === 1 && r.body.alertas.length >= 1, 'panel: pendientes, sesión DD sin validar y alertas');
  const com = T.revisiones.find((x) => x.tipo === 'comentario_checkin');
  r = await call('admin', 'POST', { accion: 'revisar', id: com.id, decision: 'aprobar' }); ok(r.body.xp === 5, 'comentario aprobado +5');
  r = await call('admin', 'POST', { accion: 'revisar', id: rid, decision: 'aprobar' }); ok(r.body.xp === 20, 'prueba aprobada: +5 prueba +15 check-in');
  r = await call('admin', 'POST', { accion: 'revisar', id: rid, decision: 'aprobar' }); ok(r.body.xp === 0, 'aprobar dos veces no duplica XP');
  r = await call('admin', 'POST', { accion: 'validar', ids: [ck2.id] }); ok(r.body.xp === 40, 'sesión Dragons Den validada: +15 check-in +25 sesión en pista');
  r = await call('admin', 'POST', { accion: 'revisar', id: rid2, decision: 'repetido' }); 
  const total = T.xp_movimientos.reduce((s, x) => s + x.cantidad, 0);
  ok(T.xp_movimientos.some((x) => x.motivo === 'penalizacion'), 'prueba repetida → penalización registrada');
  console.log('XP total tras sanción:', total, T.xp_movimientos.map((x) => x.motivo + ':' + x.cantidad).join(' '));
  // ── Nuevas piezas ──
  r = await call('jug', 'POST', { accion: 'medicion', estatura_cm: 150 }); ok(r.code === 200 && r.body.cm_anio === null, 'primera medición guardada');
  T.mediciones[0].fecha = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10);
  r = await call('jug', 'POST', { accion: 'medicion', estatura_cm: 155 }); ok(r.body.cm_anio > 7, 'estirón detectado: ' + r.body.cm_anio + ' cm/año');
  r = await call('jug', 'POST', { accion: 'medicion', estatura_cm: 20 }); ok(r.code === 400, 'estatura absurda → 400');
  r = await call('jug', 'POST', { accion: 'guardar', respuestas: Object.assign({}, base, { fecha: 'ayer', comentario: '', foco_cumplido: 2 }) });
  ok(r.code === 200 && r.body.consejo.alertas.some((a) => a.tipo === 'crecimiento'), 'el consejo ya tiene en cuenta el estirón');
  ok([r.body.consejo.principal].concat(r.body.consejo.otros).some((x) => x && (x.id === 'calentamiento' || x.id === 'estiron' || x.id === 'horas' || x.id === 'disfrute')) || r.body.consejo.principal.id === 'dolor', 'consejos nuevos en la lista');
  r = await call('admin', 'POST', { accion: 'dar_xp', user_id: JUG.id, fuente: 'hito_tecnico', nota: 'Entrada con mano izquierda' }); ok(r.body.xp === 150, 'hito técnico dado a mano +150');
  r = await call('admin', 'POST', { accion: 'dar_xp', user_id: JUG.id, fuente: 'iq_clash' }); ok(r.code === 400, 'IQ Clash no se puede dar (no existe aún)');
  r = await call('admin', 'POST', { accion: 'dar_xp', user_id: JUG.id, fuente: 'checkin' }); ok(r.code === 400, 'el check-in no se da a mano');
  r = await call('admin', 'POST', { accion: 'validar', ids: [] }); ok(r.code === 200, 'validar vacío no rompe');
  r = await call('jug', 'GET'); ok(r.code === 200 && r.body.progreso && typeof r.body.progreso.xp === 'number' && r.body.progreso.nivel.nombre, 'progreso: ' + (r.body.progreso && r.body.progreso.xp) + ' XP, nivel ' + (r.body.progreso && r.body.progreso.nivel.nombre));
  ok(r.body.edad === 14, 'edad calculada desde el consentimiento');
  r = await call('admin', 'GET', null, { vista: 'revision' }); ok(Array.isArray(r.body.recompensas) && r.body.fuentes_manuales.some((f) => f.id === 'hito_tecnico') && !r.body.fuentes_manuales.some((f) => f.id === 'iq_clash'), 'panel con recompensas y fuentes manuales');
  r = await call('jug', 'GET'); ok(r.body.historial.length >= 3 && r.body.semana.sesiones_semana >= 3 && r.body.foco_actual, 'estado del jugador con historial, semana y foco');

  // ── Tienda y semanas protegidas ──
  r = await call('jug', 'POST', { accion: 'canjear', item: 'sudadera' }); ok(r.code === 400 && /Te faltan/.test(r.body.error), 'sin Escamas no se canjea: ' + r.body.error);
  r = await call('jug', 'POST', { accion: 'canjear', item: 'iphone' }); ok(r.code === 400, 'artículo inexistente → 400');
  r = await call('jug', 'POST', { accion: 'proteger', user_id: JUG.id, fecha: '2026-11-10' }); ok(r.code === 403, 'el jugador no protege semanas');
  r = await call('admin', 'POST', { accion: 'proteger', user_id: JUG.id, fecha: '2026-11-11' }); ok(r.code === 200 && r.body.semana === '2026-11-09', 'semana protegida por lesión: ' + r.body.semana);
  r = await call('jug', 'GET'); ok(Array.isArray(r.body.tienda) && r.body.tienda.length >= 5 && r.body.progreso.escamas && r.body.progreso.temporada.id === '2026-27', 'estado con tienda, Escamas y temporada');
  r = await call('admin', 'GET', null, { vista: 'revision' }); ok(Array.isArray(r.body.canjes) && r.body.temporada.tope_aceleradores === 600, 'panel con canjes y tope de aceleradores');

  // ── Calibración de la temporada (motor puro, fechas simuladas) ──
  const P = require(path.join(__dirname, '../api/_lib/progreso.js'));
  const G = require(path.join(__dirname, '../data/gamificacion.json'));
  const T0 = G.temporadas[0];
  function temporada(adh, acel, protegerSemana, saltar) {
    const ck = [], mv = []; let d = new Date(T0.inicio + 'T12:00:00Z'); const prot = new Set(T0.semanas_protegidas.map((x) => x.lunes));
    let wk = 0, dado = 0; const alcanzado = {};
    while (d <= new Date('2027-06-02T12:00:00Z')) {
      const k = d.toISOString().slice(0, 10);
      const ya = new Set(mv.filter((m) => m.motivo === 'racha').map((m) => m.referencia));
      for (const x of P.rachasPorAnotar(G, ck, mv, d)) if (!ya.has(x.referencia)) mv.push({ cantidad: x.cantidad, motivo: 'racha', referencia: x.referencia, nota: x.nota, created_at: d.toISOString() });
      const pr = P.calcular(G, ck, mv, d);
      if (!alcanzado[pr.nivel.numero]) alcanzado[pr.nivel.numero] = k;
      if (k <= T0.fin && !prot.has(k)) {
        wk++;
        if (protegerSemana === k) mv.push({ cantidad: 0, motivo: 'ajuste_manual', referencia: 'protegida:' + k, created_at: d.toISOString() });
        else if (saltar !== k && Math.floor(wk * adh) > Math.floor((wk - 1) * adh)) {
          const sem = 'semana:' + k;
          for (let i = 0; i < 6; i++) { ck.push({ fecha: new Date(d.getTime() + i * 864e5).toISOString().slice(0, 10), tipo: 'entreno', validado_por: 'entrenador' }); mv.push({ cantidad: 15, motivo: 'checkin', nota: sem, created_at: d.toISOString() }); }
          mv.push({ cantidad: 25, motivo: 'sesion_pista', nota: sem, created_at: d.toISOString() }, { cantidad: 40, motivo: 'clip_partido', nota: sem, created_at: d.toISOString() });
        }
        if (acel && wk % 2 === 0 && dado < acel) { mv.push({ cantidad: 150, motivo: 'hito_tecnico', nota: 'semana:' + k, created_at: d.toISOString() }); dado += 150; }
      }
      d = new Date(d.getTime() + 7 * 864e5);
    }
    return { p: P.calcular(G, ck, mv, new Date('2027-06-01T12:00:00Z')), alcanzado };
  }
  let t = temporada(1, 0);
  ok(t.p.nivel.numero === 9 && t.alcanzado[9] >= '2027-05-17', 'temporada perfecta sin aceleradores: Leyenda solo al final (' + t.alcanzado[9] + ')');
  ok(t.p.desglose.recortado > 0, 'entrenar 6 veces por semana no da más XP: ' + t.p.desglose.recortado + ' XP recortados por el tope');
  ok(t.p.escamas.ganadas <= 124 && t.p.escamas.ganadas >= 120, 'Escamas de una temporada perfecta: ' + t.p.escamas.ganadas);
  t = temporada(1, 3000);
  ok(t.alcanzado[9] >= '2027-05-03', 'con todos los aceleradores, Leyenda no antes del 3 de mayo (' + t.alcanzado[9] + ')');
  ok(t.p.desglose.aceleradores === 600, 'aceleradores topados en 600 por temporada');
  t = temporada(0.5, 150);
  ok(t.p.nivel.numero >= 4 && t.p.nivel.numero <= 6, 'mitad de semanas acaba en nivel medio: ' + t.p.nivel.nombre);
  t = temporada(1, 0, '2027-01-11');
  ok(t.p.racha >= 25 && t.p.semanas.find((w) => w.lunes === '2027-01-11').estado === 'protegida', 'semana de lesión protegida no rompe la racha (' + t.p.racha + ')');
  t = temporada(1, 0, null, '2027-01-11');
  ok(t.p.semanas.find((w) => w.lunes === '2027-01-11').estado === 'comodin' && t.p.racha >= 25, 'una semana fallada gasta un comodín y la racha sigue');
  const conCanje = P.calcular(G, [], [], new Date('2027-06-01T12:00:00Z'), { canjes: [{ temporada: '2026-27', escamas: 30, estado: 'pendiente' }, { temporada: '2026-27', escamas: 50, estado: 'rechazado' }] });
  ok(conCanje.escamas.gastadas === 30, 'los canjes rechazados no gastan Escamas');
  const pre = P.calcular(G, [], [{ cantidad: 15, motivo: 'checkin', nota: 'semana:2026-10-19', created_at: '2026-10-21T10:00:00Z' }], new Date('2026-10-21T12:00:00Z'));
  ok(pre.xp === 0 && !pre.temporada.en_curso, 'antes del inicio de temporada no se acumula XP');
})();
