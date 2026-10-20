// Progreso del jugador a partir del libro de XP y de los check-ins:
// XP total, nivel, siguiente recompensa, Semanas Dragón, racha y logros.
// Todo sale de data/gamificacion.json para que la web y la plataforma digan lo mismo.
'use strict';
const { lunes } = require('./consejos');

const DIA = 86400000;
const clave = (d) => lunes(d).toISOString().slice(0, 10);

function nivelDe(xp, niveles) {
  let actual = niveles[0];
  for (const n of niveles) if (xp >= n.xp_desde) actual = n;
  const siguiente = niveles.find((n) => n.xp_desde > xp) || null;
  const base = actual.xp_desde;
  const pct = siguiente ? Math.round(((xp - base) / (siguiente.xp_desde - base)) * 100) : 100;
  return { actual, siguiente, pct };
}

// Semanas Dragón: al menos 1 check-in y otra actividad (sesión validada o clip).
function semanas(checkins, movimientos) {
  const s = {};
  for (const c of checkins) {
    const k = clave(new Date(c.fecha + 'T12:00:00Z'));
    s[k] = s[k] || { checkins: 0, otras: 0 };
    s[k].checkins++;
    if (c.validado_por && c.validado_por !== 'sin_validar') s[k].otras++;
  }
  for (const m of movimientos) {
    if (m.motivo !== 'clip_partido') continue;
    const k = clave(new Date(m.created_at));
    s[k] = s[k] || { checkins: 0, otras: 0 };
    s[k].otras++;
  }
  const cumplidas = Object.keys(s).filter((k) => s[k].checkins >= 1 && s[k].otras >= 1).sort();
  return { porSemana: s, cumplidas };
}

function racha(cumplidas, ahora) {
  const set = new Set(cumplidas);
  let k = clave(ahora || new Date());
  // La semana en curso aún puede cumplirse: si no está, la racha cuenta desde la anterior.
  if (!set.has(k)) k = new Date(new Date(k + 'T12:00:00Z').getTime() - 7 * DIA).toISOString().slice(0, 10);
  let n = 0;
  while (set.has(k)) { n++; k = new Date(new Date(k + 'T12:00:00Z').getTime() - 7 * DIA).toISOString().slice(0, 10); }
  return n;
}

function logros(gam, datos) {
  const ok = [];
  for (const l of gam.logros) {
    if (l.activo === false) continue;
    const r = l.regla;
    const minimo = r['mínimo'] ?? r.minimo;
    let valor = 0;
    if (r.tipo === 'contador' && r.de === 'checkins') valor = datos.checkins.length;
    else if (r.tipo === 'contador' && r.de === 'partidos') valor = datos.checkins.filter((c) => c.tipo === 'partido').length;
    else if (r.tipo === 'racha') valor = datos.mejorRacha;
    else if (r.tipo === 'contador_xp') valor = datos.movimientos.filter((m) => m.motivo === r.de).length;
    ok.push({ id: l.id, nombre: l.nombre, conseguido: valor >= minimo, valor, minimo });
  }
  return ok;
}

function mejorRacha(cumplidas) {
  let mejor = 0, act = 0, prev = null;
  for (const k of cumplidas) {
    const t = new Date(k + 'T12:00:00Z').getTime();
    act = prev != null && t - prev === 7 * DIA ? act + 1 : 1;
    mejor = Math.max(mejor, act);
    prev = t;
  }
  return mejor;
}

function calcular(gam, checkins, movimientos, ahora) {
  const xp = Math.max(0, movimientos.reduce((s, m) => s + m.cantidad, 0));
  const niv = nivelDe(xp, gam.niveles);
  const sem = semanas(checkins, movimientos);
  const r = racha(sem.cumplidas, ahora);
  const mr = mejorRacha(sem.cumplidas);
  return {
    xp,
    nivel: { numero: niv.actual.nivel, nombre: niv.actual.nombre },
    siguiente: niv.siguiente ? { numero: niv.siguiente.nivel, nombre: niv.siguiente.nombre, xp_desde: niv.siguiente.xp_desde, faltan: niv.siguiente.xp_desde - xp, recompensa: niv.siguiente.recompensa ? niv.siguiente.recompensa.titulo : null } : null,
    pct: niv.pct,
    racha: r,
    mejor_racha: mr,
    semana_actual: sem.porSemana[clave(ahora || new Date())] || { checkins: 0, otras: 0 },
    logros: logros(gam, { checkins, movimientos, mejorRacha: mr }),
    semanas_cumplidas: sem.cumplidas,
  };
}

// XP de rachas pendiente de anotar: solo semanas ya cerradas. Idempotente por referencia.
function rachasPorAnotar(gam, cumplidas, ahora) {
  const actual = clave(ahora || new Date());
  const cerradas = cumplidas.filter((k) => k < actual);
  const xpSemana = (gam.fuentes_xp.find((f) => f.id === 'racha_semana') || {}).xp || 0;
  const xpBloque = (gam.fuentes_xp.find((f) => f.id === 'racha_bloque') || {}).xp || 0;
  const out = cerradas.map((k) => ({ referencia: 'semana:' + k, cantidad: xpSemana, nota: 'Semana Dragón' }));
  let seguidas = 0, prev = null;
  for (const k of cerradas) {
    const t = new Date(k + 'T12:00:00Z').getTime();
    seguidas = prev != null && t - prev === 7 * DIA ? seguidas + 1 : 1;
    prev = t;
    if (seguidas % 4 === 0) out.push({ referencia: 'bloque:' + k, cantidad: xpBloque, nota: '4 Semanas Dragón seguidas' });
  }
  return out;
}

// Edad en años cumplidos a una fecha.
function edad(fechaNacimiento, ahora) {
  if (!fechaNacimiento) return null;
  const n = new Date(fechaNacimiento + 'T12:00:00Z');
  const h = ahora || new Date();
  let e = h.getUTCFullYear() - n.getUTCFullYear();
  if (h.getUTCMonth() < n.getUTCMonth() || (h.getUTCMonth() === n.getUTCMonth() && h.getUTCDate() < n.getUTCDate())) e--;
  return e;
}

// Velocidad de crecimiento en cm/año entre la primera y la última medición de los
// últimos 6 a 12 meses. Hace falta al menos 2 meses entre medidas.
function crecimiento(mediciones) {
  const m = mediciones.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (m.length < 2) return null;
  const ult = m[m.length - 1];
  const limite = new Date(new Date(ult.fecha + 'T12:00:00Z').getTime() - 365 * DIA).toISOString().slice(0, 10);
  const prim = m.find((x) => x.fecha >= limite) || m[0];
  const dias = (new Date(ult.fecha) - new Date(prim.fecha)) / DIA;
  if (dias < 60) return null;
  return Math.round(((ult.estatura_cm - prim.estatura_cm) / dias) * 365 * 10) / 10;
}

module.exports = { calcular, rachasPorAnotar, nivelDe, edad, crecimiento, clave };
