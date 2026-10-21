// /api/checkin — check-in tras entrenar o jugar, equipos, consentimiento de
// bienestar, pruebas en vídeo y cola de revisión del entrenador.
//
//   GET                       estado del jugador (historial, consejos, revisiones)
//   GET  ?vista=revision      panel del entrenador (solo admin)
//   POST {accion: ...}        ver ACCIONES más abajo
//
// Una sola función para no pasar del límite de funciones de Vercel.
'use strict';
const crypto = require('crypto');
const catalogo = require('../data/checkin.json');
const { rest, storage, usuario, esAdmin, usuariosPorId, peticion, SUPABASE_HOST } = require('./_lib/supa');
const consejos = require('./_lib/consejos');
const prefiltro = require('./_lib/prefiltro');
const progreso = require('./_lib/progreso');
const gam = require('../data/gamificacion.json');

const ORIGENES = ['https://dragonsden.es', 'https://www.dragonsden.es', 'https://dragons-den-eight.vercel.app'];
const BUCKET = 'pruebas';
const PV = catalogo.prueba_video;
const XP = catalogo.revision.xp;

// ── Utilidades ───────────────────────────────────────────────────────────────
function fechaMadrid(offsetDias) {
  const d = new Date(Date.now() - (offsetDias || 0) * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
}
function semanaClave(fecha) {
  const lun = consejos.lunes(new Date(fecha + 'T12:00:00Z'));
  return 'semana:' + lun.toISOString().slice(0, 10);
}
function uuidOk(s) { return /^[0-9a-f-]{36}$/i.test(String(s || '')); }
function opciones(pregId) {
  for (const p of catalogo.pasos) for (const q of p.preguntas) if (q.id === pregId) return q;
  return null;
}
function valorDe(pregId, v) {
  const q = opciones(pregId);
  if (v == null || v === '') return null;
  if (q.tipo === 'escala') {
    const n = Number(v);
    return Number.isInteger(n) && n >= q.min && n <= q.max ? n : undefined;
  }
  if (q.tipo === 'elige') {
    const o = q.opciones.find((x) => String(x.v) === String(v));
    return o ? o.v : undefined;
  }
  if (q.tipo === 'varias') {
    if (!Array.isArray(v)) return undefined;
    const ok = v.filter((x) => q.opciones.some((o) => o.v === x));
    return ok.length ? Array.from(new Set(ok)) : null;
  }
  return v;
}
const ASPECTOS = new Set(catalogo.aspectos.map((a) => a.id));

async function puedeBienestar(uid) {
  const r = await rest.rpc('puede_registrar_bienestar', { p_user: uid });
  return r.status === 200 && r.body === true;
}

async function historial(uid, n) {
  const r = await rest.get('checkins', 'user_id=eq.' + uid + '&select=*&order=fecha.desc,created_at.desc&limit=' + (n || 40));
  return Array.isArray(r.body) ? r.body : [];
}

// Concede el XP del check-in respetando el tope semanal. Devuelve los puntos.
async function concederCheckin(c) {
  const clave = semanaClave(c.fecha);
  const r = await rest.get('xp_movimientos', 'user_id=eq.' + c.user_id + '&motivo=eq.checkin&nota=eq.' + encodeURIComponent(clave) + '&select=id');
  const ya = Array.isArray(r.body) ? r.body.length : 0;
  if (ya >= catalogo.limites.xp_checkin_tope_semanal) return 0;
  const ins = await rest.insert('xp_movimientos', { user_id: c.user_id, cantidad: XP.checkin, motivo: 'checkin', referencia: c.id, nota: clave });
  return ins.status < 300 ? XP.checkin : 0;
}

// XP de una fuente del catálogo de gamificación, con su tope semanal si lo tiene.
async function concederFuente(userId, fuenteId, referencia, fecha, nota) {
  const f = gam.fuentes_xp.find((x) => x.id === fuenteId);
  if (!f || f.activo === false || typeof f.xp !== 'number') return 0;
  const sem = semanaClave(fecha || fechaMadrid(0));
  if (f.grupo === 'acelerador') {
    const r = await rest.get('xp_movimientos', 'user_id=eq.' + userId + '&select=cantidad,motivo,referencia,nota,created_at&limit=5000');
    const T = progreso.temporadaActual(gam);
    const x = progreso.xpTemporada(gam, T, Array.isArray(r.body) ? r.body : []);
    if (x.aceleradores_brutos + f.xp > gam.reglas.tope_temporada_aceleradores) return 0;
  }
  if (f.tope_semanal_veces) {
    const r = await rest.get('xp_movimientos', 'user_id=eq.' + userId + '&motivo=eq.' + fuenteId + '&nota=like.' + encodeURIComponent(sem + '*') + '&select=id');
    if (Array.isArray(r.body) && r.body.length >= f.tope_semanal_veces) return 0;
  }
  const ins = await rest.insert('xp_movimientos', { user_id: userId, cantidad: f.xp, motivo: fuenteId, referencia: referencia || crypto.randomUUID(), nota: sem + (nota ? ' · ' + String(nota).slice(0, 200) : '') });
  return ins.status < 300 ? f.xp : 0;
}

async function datosProgreso(uid) {
  const [mov, hist, med, can] = await Promise.all([
    rest.get('xp_movimientos', 'user_id=eq.' + uid + '&select=cantidad,motivo,referencia,nota,created_at&order=created_at.desc&limit=5000'),
    historial(uid, 400),
    rest.get('mediciones', 'user_id=eq.' + uid + '&select=fecha,estatura_cm&order=fecha.desc&limit=24'),
    rest.get('canjes', 'user_id=eq.' + uid + '&select=id,temporada,item,escamas,estado,created_at&order=created_at.desc&limit=200'),
  ]);
  return { movimientos: Array.isArray(mov.body) ? mov.body : [], historial: hist, mediciones: Array.isArray(med.body) ? med.body : [], canjes: Array.isArray(can.body) ? can.body : [] };
}

// Anota el XP de rachas cerradas y las recompensas de nivel alcanzadas (idempotente).
async function sincronizarProgreso(uid, d) {
  const yaRef = new Set(d.movimientos.filter((m) => m.motivo === 'racha').map((m) => m.referencia));
  for (const r of progreso.rachasPorAnotar(gam, d.historial, d.movimientos)) {
    if (yaRef.has(r.referencia)) continue;
    const ins = await rest.insert('xp_movimientos', { user_id: uid, cantidad: r.cantidad, motivo: 'racha', referencia: r.referencia, nota: r.nota });
    if (ins.status < 300) d.movimientos.push({ cantidad: r.cantidad, motivo: 'racha', referencia: r.referencia, nota: r.nota, created_at: new Date().toISOString() });
  }
  const p = progreso.calcular(gam, d.historial, d.movimientos, null, { canjes: d.canjes });
  for (const n of gam.niveles) {
    if (n.recompensa && n.nivel <= p.nivel.numero) {
      await peticion('/rest/v1/recompensas_entregadas?on_conflict=user_id,temporada,nivel', { method: 'POST', body: { user_id: uid, temporada: p.temporada.id, nivel: n.nivel }, headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' } });
    }
  }
  return p;
}

// ── Jugador ──────────────────────────────────────────────────────────────────
async function estadoJugador(u) {
  const [eq, hist, rev, bien, cons, vid] = await Promise.all([
    rest.get('equipos_jugador', 'user_id=eq.' + u.id + '&activo=eq.true&select=id,nombre,tipo,duracion_habitual_min&order=created_at'),
    historial(u.id, 40),
    rest.get('revisiones', 'user_id=eq.' + u.id + '&select=id,tipo,estado,checkin_id,nota_revisor,xp_si_aprueba,created_at,revisado_en&order=created_at.desc&limit=30'),
    puedeBienestar(u.id),
    rest.get('consentimiento_bienestar', 'user_id=eq.' + u.id + '&select=fecha_nacimiento,otorgado_por,revocado_en,acepta_bienestar,acepta_video'),
    rest.rpc('puede_subir_video', { p_user: u.id }),
  ]);
  const ultimo = hist[0];
  const d = await datosProgreso(u.id);
  const prog = await sincronizarProgreso(u.id, d);
  const fn = Array.isArray(cons.body) && cons.body[0] ? cons.body[0].fecha_nacimiento : null;
  return {
    catalogo_version: catalogo.version,
    equipos: Array.isArray(eq.body) ? eq.body : [],
    bienestar: bien,
    video: vid.status === 200 && vid.body === true,
    autorizaciones_registro: (u.user_metadata || {}).autorizaciones || null,
    consentimiento: Array.isArray(cons.body) && cons.body[0] ? cons.body[0] : null,
    historial: hist.slice(0, 20),
    revisiones: Array.isArray(rev.body) ? rev.body : [],
    foco_actual: ultimo && ultimo.proximo ? ultimo.proximo : null,
    semana: consejos.resumenSemana(hist),
    forma: consejos.forma(hist, 5),
    hoy: fechaMadrid(0),
    progreso: prog,
    tienda: (gam.tienda || []).filter((t) => t.activo !== false).map((t) => ({ id: t.id, nombre: t.nombre, detalle: t.detalle || '', escamas: t.escamas })),
    canjes: d.canjes.filter((c) => c.temporada === prog.temporada.id),
    crecimiento: bien ? { ultima: d.mediciones[0] || null, cm_anio: progreso.crecimiento(d.mediciones) } : null,
    edad: progreso.edad(fn),
  };
}

async function guardar(u, body) {
  const r = body.respuestas || {};
  const errores = [];
  const fila = { user_id: u.id, catalogo_version: catalogo.version };

  fila.tipo = valorDe('tipo', r.tipo);
  if (!fila.tipo) errores.push('tipo');
  const dias = { hoy: 0, ayer: 1, anteayer: 2 };
  if (!(r.fecha in dias)) errores.push('fecha'); else fila.fecha = fechaMadrid(dias[r.fecha]);
  fila.duracion_min = valorDe('duracion_min', r.duracion_min);
  if (!fila.duracion_min) errores.push('duracion_min');
  fila.rpe = valorDe('rpe', r.rpe);
  if (fila.rpe == null) errores.push('rpe');
  fila.calentamiento = valorDe('calentamiento', r.calentamiento);
  if (fila.calentamiento == null) errores.push('calentamiento');

  if (r.equipo_id) {
    if (!uuidOk(r.equipo_id)) errores.push('equipo_id');
    else {
      const e = await rest.get('equipos_jugador', 'id=eq.' + r.equipo_id + '&user_id=eq.' + u.id + '&select=id,tipo');
      if (!Array.isArray(e.body) || !e.body[0]) errores.push('equipo_id');
      else { fila.equipo_id = e.body[0].id; fila.equipo_tipo = e.body[0].tipo; }
    }
  }
  if (fila.tipo === 'partido') {
    fila.minutos_jugados = valorDe('minutos_jugados', r.minutos_jugados);
    fila.resultado = valorDe('resultado', r.resultado);
    if (fila.minutos_jugados == null) errores.push('minutos_jugados');
    if (fila.resultado === undefined) errores.push('resultado'); else fila.resultado = fila.resultado || null;
  }

  // Bienestar solo con consentimiento; si no, se descarta en silencio.
  if (await puedeBienestar(u.id)) {
    for (const k of ['energia', 'sueno', 'dolor', 'animo', 'disfrute', 'concentracion']) {
      const v = valorDe(k, r[k]);
      if (v == null) errores.push(k); else fila[k] = v;
    }
    if (fila.dolor >= 1) {
      const z = valorDe('dolor_zona', r.dolor_zona);
      if (z == null) errores.push('dolor_zona'); else fila.dolor_zona = z;
    }
    if (fila.tipo === 'partido') {
      const v = valorDe('nervios', r.nervios);
      if (v == null) errores.push('nervios'); else fila.nervios = v;
    }
  }

  // Reflexión
  const previo = await historial(u.id, 5);
  const focoActual = previo[0] && previo[0].proximo;
  if (focoActual) {
    fila.foco = focoActual;
    const v = valorDe('foco_cumplido', r.foco_cumplido);
    if (v == null) errores.push('foco_cumplido'); else fila.foco_cumplido = v;
  }
  for (const k of ['mejor', 'mejorar']) {
    if (!ASPECTOS.has(r[k])) errores.push(k); else fila[k] = r[k];
  }
  const causa = valorDe('causa', r.causa);
  if (causa == null) errores.push('causa'); else fila.causa = causa;
  fila.proximo = String(r.proximo || '').trim().slice(0, 120) || null;
  if (!fila.proximo) errores.push('proximo');

  if (errores.length) return { status: 400, body: { error: 'Respuestas no válidas', campos: errores } };

  // Límite diario
  const hoyN = await rest.get('checkins', 'user_id=eq.' + u.id + '&fecha=eq.' + fila.fecha + '&select=id');
  if (Array.isArray(hoyN.body) && hoyN.body.length >= catalogo.limites.checkins_por_dia) {
    return { status: 429, body: { error: 'Ya tienes ' + catalogo.limites.checkins_por_dia + ' sesiones registradas ese día.' } };
  }

  const extra = {};
  const cb = await rest.get('consentimiento_bienestar', 'user_id=eq.' + u.id + '&revocado_en=is.null&select=fecha_nacimiento');
  if (Array.isArray(cb.body) && cb.body[0]) {
    extra.edad = progreso.edad(cb.body[0].fecha_nacimiento);
    const med = await rest.get('mediciones', 'user_id=eq.' + u.id + '&select=fecha,estatura_cm&order=fecha.desc&limit=24');
    extra.crecimiento = progreso.crecimiento(Array.isArray(med.body) ? med.body : []);
  }
  const semanaPrev = await historial(u.id, 30);
  const resultado = consejos.generar(Object.assign({}, fila), semanaPrev.length > previo.length ? semanaPrev : previo, catalogo, null, extra);
  fila.consejo = { principal: resultado.principal, otros: resultado.otros, alertas: resultado.alertas };
  const ins = await rest.insert('checkins', fila, true);
  if (ins.status >= 300 || !Array.isArray(ins.body)) return { status: 500, body: { error: 'No se pudo guardar', detalle: ins.body } };
  const c = ins.body[0];

  // Comentario → revisión
  let revision = null;
  const comentario = String(r.comentario || '').trim().slice(0, 400);
  if (comentario) {
    const prev = await rest.get('revisiones', 'user_id=eq.' + u.id + '&tipo=eq.comentario_checkin&select=texto&order=created_at.desc&limit=20');
    const pf = prefiltro.texto(comentario, (prev.body || []).map((x) => x.texto), catalogo.revision.comentario_min_caracteres);
    const auto = catalogo.revision.aprobacion_automatica && pf.puntos >= 80;
    const rv = await rest.insert('revisiones', {
      user_id: u.id, tipo: 'comentario_checkin', checkin_id: c.id, texto: comentario, prefiltro: pf,
      estado: auto ? 'aprobado' : 'pendiente', xp_si_aprueba: XP.checkin_comentario,
      revisado_en: auto ? new Date().toISOString() : null, nota_revisor: auto ? 'Aprobado por el prefiltro' : null,
    }, true);
    revision = rv.body && rv.body[0] ? { id: rv.body[0].id, estado: rv.body[0].estado } : null;
    if (auto && revision) await rest.insert('xp_movimientos', { user_id: u.id, cantidad: XP.checkin_comentario, motivo: 'checkin_comentario', referencia: revision.id });
  }

  return {
    status: 200,
    body: {
      checkin: c,
      consejo: resultado,
      revision_comentario: revision,
      necesita_prueba: c.equipo_tipo !== 'dragons_den',
    },
  };
}

// Paso 1 de la prueba: código y gesto que deben salir en el vídeo.
async function pedirCodigo(u, body) {
  if (!uuidOk(body.checkin_id)) return { status: 400, body: { error: 'Check-in no válido' } };
  const c = await rest.get('checkins', 'id=eq.' + body.checkin_id + '&user_id=eq.' + u.id + '&select=id,equipo_tipo,created_at');
  if (!Array.isArray(c.body) || !c.body[0]) return { status: 404, body: { error: 'No encuentro ese check-in' } };
  const pv = await rest.rpc('puede_subir_video', { p_user: u.id });
  if (pv.status === 200 && pv.body === false) {
    return { status: 403, body: { error: 'Falta la autorización para subir vídeos. Con 14 años o más, márcala arriba en Autorizaciones; con menos, tu familia rellena el formulario de /autorizacion.html y se lo da a tu entrenador.' } };
  }
  const ya = await rest.get('revisiones', 'checkin_id=eq.' + body.checkin_id + '&tipo=eq.prueba_video&select=id,estado,codigo,gesto,codigo_creado_en');
  if (Array.isArray(ya.body) && ya.body[0]) {
    const x = ya.body[0];
    if (x.estado !== 'esperando_video') return { status: 409, body: { error: 'Este check-in ya tiene prueba.' } };
    const edadH = (Date.now() - new Date(x.codigo_creado_en).getTime()) / 3600000;
    if (edadH < PV.validez_codigo_horas) return { status: 200, body: { revision_id: x.id, codigo: x.codigo, gesto: x.gesto } };
  }
  const codigo = String(crypto.randomInt(10, 100));
  const gesto = PV.gestos[crypto.randomInt(0, PV.gestos.length)];
  const fila = {
    user_id: u.id, tipo: 'prueba_video', checkin_id: body.checkin_id, codigo, gesto,
    codigo_creado_en: new Date().toISOString(), estado: 'esperando_video', xp_si_aprueba: XP.prueba_video,
  };
  let r;
  if (Array.isArray(ya.body) && ya.body[0]) r = await rest.update('revisiones', 'id=eq.' + ya.body[0].id, { codigo, gesto, codigo_creado_en: fila.codigo_creado_en });
  else r = await rest.insert('revisiones', fila, true);
  const id = r.body && r.body[0] && r.body[0].id;
  if (!id) return { status: 500, body: { error: 'No se pudo preparar la prueba' } };
  return { status: 200, body: { revision_id: id, codigo, gesto } };
}

// Paso 2: metadatos del vídeo → comprobaciones → URL firmada de subida.
async function prepararSubida(u, body) {
  if (!uuidOk(body.revision_id)) return { status: 400, body: { error: 'Prueba no válida' } };
  const rv = await rest.get('revisiones', 'id=eq.' + body.revision_id + '&user_id=eq.' + u.id + '&tipo=eq.prueba_video&select=*');
  const x = Array.isArray(rv.body) && rv.body[0];
  if (!x) return { status: 404, body: { error: 'No encuentro la prueba' } };
  if (x.estado !== 'esperando_video') return { status: 409, body: { error: 'Esta prueba ya está enviada' } };
  if ((Date.now() - new Date(x.codigo_creado_en).getTime()) / 3600000 > PV.validez_codigo_horas) {
    return { status: 410, body: { error: 'El código ha caducado. Pide uno nuevo.' } };
  }
  const bytes = Number(body.bytes) || 0;
  const dur = Number(body.duracion_seg) || 0;
  const sha = /^[0-9a-f]{64}$/.test(body.sha256 || '') ? body.sha256 : null;
  const firma = /^[0-9a-f]{64}$/.test(body.firma || '') ? body.firma : null;
  const mime = String(body.mime || '');
  if (!sha) return { status: 400, body: { error: 'Falta la huella del vídeo' } };
  if (bytes <= 0 || bytes > PV.tamano_max_mb * 1048576) return { status: 400, body: { error: 'El vídeo pesa demasiado (máximo ' + PV.tamano_max_mb + ' MB). Graba solo 5 segundos.' } };
  if (dur < PV.duracion_min_seg - 0.5 || dur > PV.duracion_max_seg + 1) return { status: 400, body: { error: 'El vídeo tiene que durar entre ' + PV.duracion_min_seg + ' y ' + PV.duracion_max_seg + ' segundos.' } };
  if (!/^video\/(mp4|quicktime|webm|3gpp)$/.test(mime)) return { status: 400, body: { error: 'Formato de vídeo no admitido' } };

  // Huellas anteriores de TODOS los jugadores: una misma grabación no vale dos veces.
  const ant = await rest.get('revisiones', 'tipo=eq.prueba_video&video_sha256=not.is.null&select=id,user_id,video_sha256,video_firma&order=created_at.desc&limit=2000');
  const anteriores = Array.isArray(ant.body) ? ant.body : [];
  const grabado = body.grabado_en && !isNaN(Date.parse(body.grabado_en)) ? new Date(body.grabado_en).toISOString() : null;
  const pf = prefiltro.video({ duracion_seg: dur, grabado_en: grabado, sha256: sha, firma }, anteriores, PV);

  const ext = mime === 'video/quicktime' ? 'mov' : mime === 'video/webm' ? 'webm' : mime === 'video/3gpp' ? '3gp' : 'mp4';
  const ruta = u.id + '/' + x.id + '.' + ext;
  await rest.update('revisiones', 'id=eq.' + x.id, {
    video_path: ruta, video_sha256: sha, video_firma: firma, video_duracion: dur, video_bytes: bytes,
    video_grabado_en: grabado, prefiltro: pf,
  });
  const f = await storage.firmarSubida(BUCKET, ruta);
  const token = f.body && f.body.url && (/[?&]token=([^&]+)/.exec(f.body.url) || [])[1];
  if (!token) return { status: 500, body: { error: 'No se pudo preparar la subida' } };
  return { status: 200, body: { ruta, token, aviso: pf.iguales.length ? 'Este vídeo ya se ha usado como prueba.' : null } };
}

// Paso 3: comprobar en el servidor que el archivo subido es el que dice ser.
async function confirmarSubida(u, body) {
  if (!uuidOk(body.revision_id)) return { status: 400, body: { error: 'Prueba no válida' } };
  const rv = await rest.get('revisiones', 'id=eq.' + body.revision_id + '&user_id=eq.' + u.id + '&tipo=eq.prueba_video&select=*');
  const x = Array.isArray(rv.body) && rv.body[0];
  if (!x || !x.video_path) return { status: 404, body: { error: 'No encuentro la prueba' } };
  if (x.estado !== 'esperando_video') return { status: 200, body: { estado: x.estado } };
  const d = await storage.descargar(BUCKET, x.video_path);
  if (d.status !== 200) return { status: 400, body: { error: 'El vídeo no ha llegado. Vuelve a intentarlo.' } };
  const sha = crypto.createHash('sha256').update(d.body).digest('hex');
  const pf = Object.assign({}, x.prefiltro);
  pf.motivos = (pf.motivos || []).slice();
  if (sha !== x.video_sha256) { pf.motivos.push('La huella del archivo no coincide con la declarada'); pf.puntos = 0; pf.sugerencia = 'rechazar'; }
  if (d.body.length !== x.video_bytes) pf.motivos.push('El tamaño no coincide');
  const repetido = (pf.iguales || []).length > 0;
  await rest.update('revisiones', 'id=eq.' + x.id, { estado: repetido ? 'repetido' : 'pendiente', prefiltro: pf, video_sha256: sha });
  return { status: 200, body: { estado: repetido ? 'repetido' : 'pendiente' } };
}

async function guardarMedicion(u, body) {
  if (!(await puedeBienestar(u.id))) return { status: 403, body: { error: 'Primero da permiso para las preguntas de cuerpo y cabeza.' } };
  const cm = Math.round(Number(body.estatura_cm) * 10) / 10;
  if (!(cm >= 90 && cm <= 230)) return { status: 400, body: { error: 'Escribe tu estatura en centímetros (por ejemplo, 162).' } };
  const hoy = fechaMadrid(0);
  const r = await peticion('/rest/v1/mediciones?on_conflict=user_id,fecha', { method: 'POST', body: { user_id: u.id, fecha: hoy, estatura_cm: cm }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  if (r.status >= 300) return { status: 500, body: { error: 'No se pudo guardar' } };
  const med = await rest.get('mediciones', 'user_id=eq.' + u.id + '&select=fecha,estatura_cm&order=fecha.desc&limit=24');
  return { status: 200, body: { ok: true, cm_anio: progreso.crecimiento(Array.isArray(med.body) ? med.body : []) } };
}

async function guardarEquipo(u, body) {
  if (body.baja) {
    if (!uuidOk(body.id)) return { status: 400, body: { error: 'Equipo no válido' } };
    await rest.update('equipos_jugador', 'id=eq.' + body.id + '&user_id=eq.' + u.id, { activo: false });
    return { status: 200, body: { ok: true } };
  }
  const nombre = String(body.nombre || '').trim().slice(0, 60);
  const tipo = ['dragons_den', 'club', 'seleccion', 'otro'].includes(body.tipo) ? body.tipo : null;
  const dur = Math.min(240, Math.max(15, Number(body.duracion) || 90));
  if (nombre.length < 2 || !tipo) return { status: 400, body: { error: 'Pon el nombre y el tipo de equipo' } };
  const act = await rest.get('equipos_jugador', 'user_id=eq.' + u.id + '&activo=eq.true&select=id');
  if (Array.isArray(act.body) && act.body.length >= 4) return { status: 400, body: { error: 'Máximo 4 equipos activos' } };
  const r = await rest.insert('equipos_jugador', { user_id: u.id, nombre, tipo, duracion_habitual_min: dur }, true);
  return r.status < 300 ? { status: 200, body: { equipo: r.body[0] } } : { status: 500, body: { error: 'No se pudo guardar' } };
}

async function guardarBienestar(u, body, req) {
  const cfg = catalogo.consentimiento_bienestar;
  if (body.revocar) {
    await rest.update('consentimiento_bienestar', 'user_id=eq.' + u.id, { revocado_en: new Date().toISOString() });
    return { status: 200, body: { ok: true } };
  }
  if (body.acepto !== true && body.acepto_video !== true) return { status: 400, body: { error: 'Marca al menos una de las dos autorizaciones' } };
  const fn = String(body.fecha_nacimiento || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fn) || isNaN(Date.parse(fn))) return { status: 400, body: { error: 'Fecha de nacimiento no válida' } };
  const edad = (Date.now() - Date.parse(fn)) / (365.25 * 86400000);
  if (edad < 6 || edad > 80) return { status: 400, body: { error: 'Fecha de nacimiento no válida' } };
  let por = 'jugador';
  if (edad < cfg.edad_minima_propia) {
    const t = await rest.get('consentimientos_tutor', 'user_id=eq.' + u.id + '&revocado_en=is.null&select=id');
    if (!Array.isArray(t.body) || !t.body[0]) {
      return { status: 403, body: { error: 'Con menos de ' + cfg.edad_minima_propia + ' años esta parte la autoriza tu familia. Pide a tu entrenador el formulario de autorización.' } };
    }
    if (body.otorgado_por !== 'tutor') return { status: 400, body: { error: 'Tiene que aceptarlo tu madre, padre o tutor.' } };
    por = 'tutor';
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
  // Lo ya autorizado se conserva: marcar solo una casilla no retira la otra.
  const prev = await rest.get('consentimiento_bienestar', 'user_id=eq.' + u.id + '&revocado_en=is.null&select=acepta_bienestar,acepta_video');
  const p0 = Array.isArray(prev.body) && prev.body[0] ? prev.body[0] : { acepta_bienestar: false, acepta_video: false };
  // Con menos de 14 años, el vídeo solo lo autoriza la familia con el formulario.
  const video = body.acepto_video === true && por !== 'tutor' ? true : p0.acepta_video;
  const fila = { user_id: u.id, fecha_nacimiento: fn, otorgado_por: por, texto_version: cfg.texto_version, otorgado_en: new Date().toISOString(), ip_otorgamiento: ip, revocado_en: null,
    acepta_bienestar: body.acepto === true || p0.acepta_bienestar, acepta_video: video };
  const up = await peticion('/rest/v1/consentimiento_bienestar?on_conflict=user_id', {
    method: 'POST', body: fila, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  });
  return up.status < 300 ? { status: 200, body: { ok: true } } : { status: 500, body: { error: 'No se pudo guardar' } };
}

// Autorizaciones aceptadas al crear la cuenta (user_metadata.autorizaciones).
// Se pasan a la base de datos la primera vez; si ya hay una fila, no se tocan,
// así un cambio o una retirada posterior desde la app manda sobre el registro.
async function autorizacionesRegistro(u) {
  const a = (u.user_metadata || {}).autorizaciones;
  if (!a || typeof a !== 'object') return { status: 200, body: { ok: true, nada: true } };
  const fn = String(a.fecha_nacimiento || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fn) || isNaN(Date.parse(fn))) return { status: 200, body: { ok: false, motivo: 'fecha' } };
  const edad = (Date.now() - Date.parse(fn)) / 31557600000;
  const tutor = a.otorgado_por === 'tutor';
  if (edad < catalogo.consentimiento_bienestar.edad_minima_propia && !tutor) return { status: 200, body: { ok: false, motivo: 'menor_sin_tutor' } };
  const at = !isNaN(Date.parse(a.at)) ? new Date(a.at).toISOString() : new Date().toISOString();
  const version = String(a.version || 'registro-2026-10').slice(0, 40);
  const ign = { Prefer: 'resolution=ignore-duplicates,return=minimal' };
  if (tutor) {
    await peticion('/rest/v1/consentimientos_tutor?on_conflict=user_id', { method: 'POST', headers: ign, body: {
      user_id: u.id, fecha_nacimiento: fn, tutor_nombre: String(a.tutor_nombre || '').slice(0, 120) || 'Sin indicar', tutor_dni: null, tutor_email: u.email,
      tutor_relacion: ['madre', 'padre', 'tutor_legal'].includes(a.tutor_relacion) ? a.tutor_relacion : 'tutor_legal',
      acepta_tratamiento_video: a.video === true, acepta_uso_promocional: a.imagen === true, acepta_ranking_publico: false,
      otorgado_en: at, texto_version: version } });
  }
  if (a.bienestar === true || a.video === true) {
    await peticion('/rest/v1/consentimiento_bienestar?on_conflict=user_id', { method: 'POST', headers: ign, body: {
      user_id: u.id, fecha_nacimiento: fn, otorgado_por: tutor ? 'tutor' : 'jugador', texto_version: version, otorgado_en: at,
      acepta_bienestar: a.bienestar === true, acepta_video: a.video === true } });
  }
  return { status: 200, body: { ok: true } };
}

// ── Entrenador ───────────────────────────────────────────────────────────────
// Registra la autorización en papel de la familia (formulario /autorizacion.html).
async function registrarTutor(body) {
  if (!uuidOk(body.user_id)) return { status: 400, body: { error: 'Jugador no válido' } };
  const fn = String(body.fecha_nacimiento || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fn)) return { status: 400, body: { error: 'Fecha de nacimiento no válida' } };
  const nombre = String(body.tutor_nombre || '').trim().slice(0, 120);
  const dni = String(body.tutor_dni || '').trim().toUpperCase().slice(0, 12);
  const email = String(body.tutor_email || '').trim().slice(0, 160);
  if (!nombre || !/^[0-9XYZ][0-9]{7}[A-Z]$/.test(dni) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 400, body: { error: 'Revisa nombre, DNI o NIE y email de la familia' } };
  if (!['madre', 'padre', 'tutor_legal'].includes(body.tutor_relacion)) return { status: 400, body: { error: 'Relación no válida' } };
  const ahora = new Date().toISOString();
  const t = await peticion('/rest/v1/consentimientos_tutor?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: {
    user_id: body.user_id, fecha_nacimiento: fn, tutor_nombre: nombre, tutor_dni: dni, tutor_email: email, tutor_relacion: body.tutor_relacion,
    acepta_tratamiento_video: body.video === true, acepta_uso_promocional: body.imagen === true, acepta_ranking_publico: false,
    otorgado_en: ahora, texto_version: 'familia-2026-10', revocado_en: null } });
  if (t.status >= 300) return { status: 500, body: { error: 'No se pudo guardar' } };
  if (body.bienestar === true || body.video === true) {
    await peticion('/rest/v1/consentimiento_bienestar?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: {
      user_id: body.user_id, fecha_nacimiento: fn, otorgado_por: 'tutor', texto_version: 'familia-2026-10', otorgado_en: ahora, revocado_en: null,
      acepta_bienestar: body.bienestar === true, acepta_video: body.video === true } });
  }
  return { status: 200, body: { ok: true } };
}

async function panelRevision() {
  const hace14 = fechaMadrid(14);
  const [pend, sinVal, recientes, usuarios, recomp, movs, canj] = await Promise.all([
    rest.get('revisiones', 'estado=in.(pendiente,repetido)&select=*&order=created_at.asc&limit=200'),
    rest.get('checkins', 'validado_por=eq.sin_validar&equipo_tipo=eq.dragons_den&fecha=gte.' + hace14 + '&select=id,user_id,fecha,tipo,duracion_min,rpe&order=fecha.desc&limit=300'),
    rest.get('checkins', 'fecha=gte.' + hace14 + '&select=id,user_id,fecha,tipo,equipo_tipo,rpe,duracion_min,carga,energia,animo,dolor,dolor_zona,mejor,mejorar,causa,proximo,consejo,validado_por&order=fecha.desc&limit=600'),
    usuariosPorId(),
    rest.get('recompensas_entregadas', 'estado=in.(pendiente,preparada)&select=*&order=created_at.asc&limit=200'),
    rest.get('xp_movimientos', 'select=user_id,cantidad,motivo,referencia,nota,created_at&limit=20000'),
    rest.get('canjes', 'estado=eq.pendiente&select=*&order=created_at.asc&limit=200'),
  ]);
  const T = progreso.temporadaActual(gam);
  const movPor = {};
  for (const m of (Array.isArray(movs.body) ? movs.body : [])) (movPor[m.user_id] = movPor[m.user_id] || []).push(m);
  const xpPor = {};
  for (const id of Object.keys(movPor)) xpPor[id] = progreso.xpTemporada(gam, T, movPor[id]);
  const quien = (id) => usuarios[id] || { email: '', nombre: 'Jugador' };
  const pendientes = [];
  for (const x of (Array.isArray(pend.body) ? pend.body : [])) {
    let url = null;
    if (x.video_path && !x.video_borrado_en) {
      const f = await storage.firmarLectura(BUCKET, x.video_path, 900);
      if (f.body && f.body.signedURL) url = 'https://' + SUPABASE_HOST + '/storage/v1' + f.body.signedURL;
    }
    pendientes.push(Object.assign({}, x, { jugador: quien(x.user_id), video_url: url }));
  }
  const lista = Array.isArray(recientes.body) ? recientes.body : [];
  const alertas = [];
  const porJugador = {};
  for (const c of lista) {
    (porJugador[c.user_id] = porJugador[c.user_id] || []).push(c);
    for (const a of (c.consejo && c.consejo.alertas) || []) alertas.push(Object.assign({ fecha: c.fecha, user_id: c.user_id, jugador: quien(c.user_id) }, a));
  }
  const jugadores = Object.keys(porJugador).map((id) => {
    const h = porJugador[id];
    const x = xpPor[id] || { xp: 0, aceleradores_brutos: 0 };
    return { user_id: id, jugador: quien(id), sesiones: h.length, semana: consejos.resumenSemana(h), forma: consejos.forma(h, 5), ultimo: h[0], xp: x.xp, aceleradores: x.aceleradores_brutos, nivel: progreso.nivelDe(x.xp, gam.niveles).actual.nombre };
  }).sort((a, b) => (b.semana.relacion || 0) - (a.semana.relacion || 0));
  return {
    pendientes,
    sin_validar: (Array.isArray(sinVal.body) ? sinVal.body : []).map((c) => Object.assign({}, c, { jugador: quien(c.user_id) })),
    alertas,
    jugadores,
    recompensas: (Array.isArray(recomp.body) ? recomp.body : []).map((r) => {
      const n = gam.niveles.find((x) => x.nivel === r.nivel) || {};
      return Object.assign({}, r, { jugador: quien(r.user_id), nivel_nombre: n.nombre, titulo: n.recompensa ? n.recompensa.titulo : '' });
    }),
    temporada: { id: T.id, nombre: T.nombre, tope_aceleradores: gam.reglas.tope_temporada_aceleradores },
    todos: Object.keys(usuarios).map((id) => ({ user_id: id, nombre: usuarios[id].nombre, email: usuarios[id].email })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    canjes: (Array.isArray(canj.body) ? canj.body : []).map((c) => {
      const it = (gam.tienda || []).find((t) => t.id === c.item) || {};
      return Object.assign({}, c, { jugador: quien(c.user_id), nombre: it.nombre || c.item });
    }),
    fuentes_manuales: gam.fuentes_xp.filter((f) => f.concede === 'entrenador' && f.activo !== false).map((f) => ({ id: f.id, nombre: f.nombre, xp: f.xp })),
  };
}

async function revisar(admin, body) {
  if (!uuidOk(body.id)) return { status: 400, body: { error: 'Revisión no válida' } };
  const decision = body.decision;
  if (!['aprobar', 'rechazar', 'repetido'].includes(decision)) return { status: 400, body: { error: 'Decisión no válida' } };
  const rv = await rest.get('revisiones', 'id=eq.' + body.id + '&select=*');
  const x = Array.isArray(rv.body) && rv.body[0];
  if (!x) return { status: 404, body: { error: 'No existe' } };
  const estado = decision === 'aprobar' ? 'aprobado' : decision === 'repetido' ? 'repetido' : 'rechazado';
  await rest.update('revisiones', 'id=eq.' + x.id, {
    estado, revisado_por: admin.id, revisado_en: new Date().toISOString(),
    nota_revisor: String(body.nota || '').slice(0, 300) || null,
  });
  let xp = 0;
  if (decision === 'aprobar') {
    const motivo = x.tipo === 'prueba_video' ? 'prueba_video' : 'checkin_comentario';
    let notaSem = null;
    if (x.checkin_id) {
      const cf = await rest.get('checkins', 'id=eq.' + x.checkin_id + '&select=fecha');
      if (Array.isArray(cf.body) && cf.body[0]) notaSem = semanaClave(cf.body[0].fecha);
    }
    const ins = await rest.insert('xp_movimientos', { user_id: x.user_id, cantidad: x.xp_si_aprueba, motivo, referencia: x.id, nota: notaSem });
    if (ins.status < 300) xp += x.xp_si_aprueba;
    if (x.tipo === 'prueba_video' && x.checkin_id) {
      const c = await rest.update('checkins', 'id=eq.' + x.checkin_id, { validado_por: 'prueba' });
      if (Array.isArray(c.body) && c.body[0]) xp += await concederCheckin(c.body[0]);
    }
  }
  // Sanción por prueba falsa o repetida: se retira el XP de check-in de esa semana.
  if ((decision === 'repetido' || body.sancionar === true) && x.tipo === 'prueba_video' && x.checkin_id) {
    const c = await rest.get('checkins', 'id=eq.' + x.checkin_id + '&select=fecha');
    const fecha = c.body && c.body[0] && c.body[0].fecha;
    if (fecha) {
      const clave = semanaClave(fecha);
      const m = await rest.get('xp_movimientos', 'user_id=eq.' + x.user_id + '&motivo=eq.checkin&nota=eq.' + encodeURIComponent(clave) + '&select=cantidad');
      const total = (Array.isArray(m.body) ? m.body : []).reduce((s, y) => s + y.cantidad, 0);
      if (total > 0) await rest.insert('xp_movimientos', { user_id: x.user_id, cantidad: -total, motivo: 'penalizacion', referencia: 'prueba:' + x.id, nota: 'Prueba no válida (' + clave + ')' });
    }
  }
  return { status: 200, body: { ok: true, estado, xp } };
}

async function validarSesiones(body) {
  const ids = Array.isArray(body.ids) ? body.ids.filter(uuidOk).slice(0, 200) : [];
  let xp = 0;
  for (const id of ids) {
    const c = await rest.update('checkins', 'id=eq.' + id + '&validado_por=eq.sin_validar', { validado_por: 'entrenador' });
    if (Array.isArray(c.body) && c.body[0]) {
      xp += await concederCheckin(c.body[0]);
      xp += await concederFuente(c.body[0].user_id, 'sesion_pista', 'sesion:' + c.body[0].id, c.body[0].fecha, 'Sesión de Dragons Den validada');
    }
  }
  return { status: 200, body: { ok: true, validados: ids.length, xp } };
}

// XP que concede el entrenador a mano (clip analizado, hito, métrica, referido, sesión).
async function darXp(body) {
  if (!uuidOk(body.user_id)) return { status: 400, body: { error: 'Jugador no válido' } };
  const f = gam.fuentes_xp.find((x) => x.id === body.fuente);
  if (!f || f.concede !== 'entrenador' || f.activo === false) return { status: 400, body: { error: 'Esa fuente de XP no se concede a mano' } };
  const xp = await concederFuente(body.user_id, f.id, null, null, body.nota);
  const aviso = xp ? null : f.grupo === 'acelerador'
    ? 'No suma: ya ha llegado al tope de aceleradores de la temporada o al tope semanal de ese motivo.'
    : 'No suma: ya ha llegado al tope semanal de ese motivo.';
  return { status: 200, body: { ok: true, xp, aviso } };
}

// Protege una semana por lesión o enfermedad: no da XP pero no rompe la racha.
async function protegerSemana(body) {
  if (!uuidOk(body.user_id)) return { status: 400, body: { error: 'Jugador no válido' } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha || ''))) return { status: 400, body: { error: 'Fecha no válida' } };
  const k = semanaClave(body.fecha).slice(7);
  const ins = await rest.insert('xp_movimientos', { user_id: body.user_id, cantidad: 0, motivo: 'ajuste_manual', referencia: 'protegida:' + k, nota: 'semana:' + k + ' · Semana protegida' + (body.nota ? ': ' + String(body.nota).slice(0, 150) : '') });
  return ins.status < 300 ? { status: 200, body: { ok: true, semana: k } } : { status: 500, body: { error: 'No se pudo guardar' } };
}

// Canje de Escamas en la tienda. Queda pendiente hasta que el entrenador lo entrega.
async function canjear(u, body) {
  const item = (gam.tienda || []).find((t) => t.id === body.item && t.activo !== false);
  if (!item) return { status: 400, body: { error: 'Ese artículo no está en la tienda' } };
  const d = await datosProgreso(u.id);
  const p = progreso.calcular(gam, d.historial, d.movimientos, null, { canjes: d.canjes });
  const hoy = fechaMadrid(0);
  if (hoy > p.temporada.cierre_canjes) return { status: 400, body: { error: 'Los canjes de esta temporada ya están cerrados' } };
  if (p.escamas.saldo < item.escamas) return { status: 400, body: { error: 'Te faltan ' + (item.escamas - p.escamas.saldo) + ' Escamas' } };
  const ins = await rest.insert('canjes', { user_id: u.id, temporada: p.temporada.id, item: item.id, escamas: item.escamas });
  if (ins.status >= 300) return { status: 500, body: { error: 'No se pudo guardar' } };
  return { status: 200, body: { ok: true, saldo: p.escamas.saldo - item.escamas, canje: Array.isArray(ins.body) ? ins.body[0] : null } };
}

async function cambiarCanje(body) {
  if (!uuidOk(body.id)) return { status: 400, body: { error: 'Canje no válido' } };
  if (!['entregado', 'rechazado'].includes(body.estado)) return { status: 400, body: { error: 'Estado no válido' } };
  const cambios = { estado: body.estado, nota: String(body.nota || '').slice(0, 300) || null };
  if (body.estado === 'entregado') cambios.entregado_en = new Date().toISOString();
  await rest.update('canjes', 'id=eq.' + body.id + '&estado=eq.pendiente', cambios);
  return { status: 200, body: { ok: true } };
}

async function cambiarRecompensa(body) {
  if (!uuidOk(body.id)) return { status: 400, body: { error: 'Recompensa no válida' } };
  if (!['preparada', 'entregada', 'rechazada'].includes(body.estado)) return { status: 400, body: { error: 'Estado no válido' } };
  const cambios = { estado: body.estado, nota: String(body.nota || '').slice(0, 300) || null };
  if (body.estado === 'entregada') cambios.entregada_en = new Date().toISOString();
  await rest.update('recompensas_entregadas', 'id=eq.' + body.id, cambios);
  return { status: 200, body: { ok: true } };
}

// Borra los vídeos revisados hace más de N días (se conserva la huella).
async function limpiarVideos() {
  const limite = new Date(Date.now() - PV.borrar_dias_tras_revision * 86400000).toISOString();
  const r = await rest.get('revisiones', 'tipo=eq.prueba_video&video_borrado_en=is.null&video_path=not.is.null&revisado_en=lt.' + limite + '&select=id,video_path&limit=100');
  const lista = Array.isArray(r.body) ? r.body : [];
  if (!lista.length) return 0;
  await storage.borrar(BUCKET, lista.map((x) => x.video_path));
  for (const x of lista) await rest.update('revisiones', 'id=eq.' + x.id, { video_borrado_en: new Date().toISOString() });
  return lista.length;
}

// ── Manejador ────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ORIGENES.includes(origin) ? origin : ORIGENES[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const u = await usuario(req);
    if (!u) return res.status(401).json({ error: 'Inicia sesión' });
    const admin = esAdmin(u);

    if (req.method === 'GET') {
      if (req.query && req.query.vista === 'revision') {
        if (!admin) return res.status(403).json({ error: 'Solo el entrenador' });
        limpiarVideos().catch(() => {});
        return res.status(200).json(await panelRevision());
      }
      return res.status(200).json(await estadoJugador(u));
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const ACCIONES = {
        guardar: () => guardar(u, body),
        codigo: () => pedirCodigo(u, body),
        subida: () => prepararSubida(u, body),
        confirmar: () => confirmarSubida(u, body),
        equipo: () => guardarEquipo(u, body),
        bienestar: () => guardarBienestar(u, body, req),
        revisar: () => (admin ? revisar(u, body) : { status: 403, body: { error: 'Solo el entrenador' } }),
        validar: () => (admin ? validarSesiones(body) : { status: 403, body: { error: 'Solo el entrenador' } }),
        dar_xp: () => (admin ? darXp(body) : { status: 403, body: { error: 'Solo el entrenador' } }),
        recompensa: () => (admin ? cambiarRecompensa(body) : { status: 403, body: { error: 'Solo el entrenador' } }),
        medicion: () => guardarMedicion(u, body),
        autorizaciones: () => autorizacionesRegistro(u),
        canjear: () => canjear(u, body),
        canje: () => (admin ? cambiarCanje(body) : { status: 403, body: { error: 'Solo el entrenador' } }),
        tutor: () => (admin ? registrarTutor(body) : { status: 403, body: { error: 'Solo el entrenador' } }),
        proteger: () => (admin ? protegerSemana(body) : { status: 403, body: { error: 'Solo el entrenador' } }),
      };
      const fn = ACCIONES[body.accion];
      if (!fn) return res.status(400).json({ error: 'Acción desconocida' });
      const out = await fn();
      return res.status(out.status).json(out.body);
    }
    return res.status(405).end();
  } catch (e) {
    console.error('[checkin]', e);
    return res.status(500).json({ error: 'Error interno' });
  }
};
