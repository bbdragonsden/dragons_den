// Progreso del jugador en la temporada: XP efectivo, nivel, Semanas Dragón,
// racha con comodines, Escamas, aspecto de la carta y logros.
// Todo sale de data/gamificacion.json para que la web y la plataforma digan lo mismo.
//
// Reglas (gamificacion.reglas):
// - El XP de constancia cuenta como máximo tope_semanal_constancia por semana:
//   entrenar más no da más XP.
// - Los aceleradores (hitos, métricas, referidos) cuentan como máximo
//   tope_temporada_aceleradores por temporada.
// - Un nivel con no_antes_de no se alcanza antes de esa fecha.
// - Cada temporada empieza de cero; el mejor nivel de las anteriores queda como insignia.
'use strict';
const { lunes } = require('./consejos');

const DIA = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const clave = (d) => iso(lunes(d));
const masDias = (k, n) => iso(new Date(new Date(k + 'T12:00:00Z').getTime() + n * DIA));
const hoyIso = (ahora) => iso(ahora || new Date());

function grupoDe(gam, motivo) {
  if (motivo === 'racha') return 'racha';
  if (motivo === 'penalizacion' || motivo === 'ajuste_manual') return 'ajuste';
  const f = gam.fuentes_xp.find((x) => x.id === motivo);
  return f && f.grupo ? f.grupo : 'constancia';
}

// Temporada vigente: la que contiene hoy (hasta el cierre de canjes); si no hay,
// la última que ya empezó; si ninguna empezó, la primera.
function temporadaActual(gam, ahora) {
  const h = hoyIso(ahora);
  const ts = gam.temporadas || [];
  return ts.find((t) => t.inicio <= h && h <= (t.cierre_canjes || t.fin))
    || ts.filter((t) => t.inicio <= h).sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0]
    || ts[0];
}

// Semana a la que pertenece un movimiento: la de la sesión si la nota la lleva
// ("semana:AAAA-MM-DD ..."), si no la de su fecha de alta.
function semanaMov(m) {
  const k = /^semana:(\d{4}-\d{2}-\d{2})/.exec(m.nota || '');
  return k ? k[1] : clave(new Date(m.created_at || Date.now()));
}

function dentro(T, k) { return k >= clave(new Date(T.inicio + 'T12:00:00Z')) && k <= T.fin; }

function nivelDe(xp, niveles, ahora) {
  const h = hoyIso(ahora);
  let actual = niveles[0], bloqueado = null;
  for (const n of niveles) {
    if (xp < n.xp_desde) break;
    if (n.no_antes_de && h < n.no_antes_de) { bloqueado = n; break; }
    actual = n;
  }
  const siguiente = niveles.find((n) => n.nivel === actual.nivel + 1) || null;
  const base = actual.xp_desde;
  const pct = siguiente ? Math.max(0, Math.min(100, Math.round(((xp - base) / (siguiente.xp_desde - base)) * 100))) : 100;
  return { actual, siguiente, pct, bloqueado };
}

// Línea de semanas de la temporada hasta hoy: cumplida | protegida | comodin | fallada | en_curso.
function lineaSemanas(gam, T, checkins, movimientos, ahora) {
  const hoyK = clave(ahora || new Date());
  const s = {};
  for (const c of checkins) {
    const k = clave(new Date(c.fecha + 'T12:00:00Z'));
    if (!dentro(T, k)) continue;
    s[k] = s[k] || { checkins: 0, otras: 0 };
    s[k].checkins++;
    if (c.validado_por && c.validado_por !== 'sin_validar') s[k].otras++;
  }
  for (const m of movimientos) {
    if (m.motivo !== 'clip_partido') continue;
    const k = semanaMov(m);
    if (!dentro(T, k)) continue;
    s[k] = s[k] || { checkins: 0, otras: 0 };
    s[k].otras++;
  }
  const protegidas = new Set((T.semanas_protegidas || []).map((x) => x.lunes));
  for (const m of movimientos) {
    const p = /^protegida:(\d{4}-\d{2}-\d{2})$/.exec(m.referencia || '');
    if (m.motivo === 'ajuste_manual' && p) protegidas.add(p[1]);
  }
  const reg = gam.semana_dragon;
  const out = [];
  let comodines = 0, seguidasParaComodin = 0, cadena = 0;
  for (let k = clave(new Date(T.inicio + 'T12:00:00Z')); k <= hoyK && k <= T.fin; k = masDias(k, 7)) {
    const d = s[k] || { checkins: 0, otras: 0 };
    const ok = d.checkins >= (reg.minimo_checkins || 1) && d.otras >= (reg.minimo_otras_actividades || 1);
    let estado;
    if (ok) estado = 'cumplida';
    else if (protegidas.has(k)) estado = 'protegida';
    else if (k === hoyK) estado = 'en_curso';
    else if (comodines > 0) { estado = 'comodin'; comodines--; }
    else estado = 'fallada';
    if (estado === 'cumplida') {
      cadena++;
      seguidasParaComodin++;
      if (seguidasParaComodin === 4) { comodines = Math.min(2, comodines + 1); seguidasParaComodin = 0; }
    } else if (estado === 'fallada') { cadena = 0; seguidasParaComodin = 0; }
    out.push({ lunes: k, estado, cadena, checkins: d.checkins, otras: d.otras });
  }
  return { semanas: out, comodines };
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

// XP efectivo de una temporada a partir del libro.
function xpTemporada(gam, T, movimientos) {
  const R = gam.reglas || {};
  const tope = R.tope_semanal_constancia || Infinity;
  const porSemana = {};
  let racha = 0, acel = 0, ajuste = 0, crudo = 0, recortado = 0;
  for (const m of movimientos) {
    const k = semanaMov(m);
    if (!dentro(T, k) && !(m.motivo === 'racha' && dentro(T, (/(\d{4}-\d{2}-\d{2})$/.exec(m.referencia || '') || [])[1] || ''))) continue;
    const g = grupoDe(gam, m.motivo);
    crudo += m.cantidad;
    if (g === 'constancia') porSemana[k] = (porSemana[k] || 0) + m.cantidad;
    else if (g === 'racha') racha += m.cantidad;
    else if (g === 'acelerador') acel += m.cantidad;
    else ajuste += m.cantidad;
  }
  let constancia = 0;
  for (const k of Object.keys(porSemana)) { const v = Math.min(porSemana[k], tope); recortado += porSemana[k] - v; constancia += v; }
  const topeA = R.tope_temporada_aceleradores || Infinity;
  const acelEf = Math.min(acel, topeA);
  return { xp: Math.max(0, constancia + racha + acelEf + ajuste), constancia, racha, aceleradores: acelEf, aceleradores_brutos: acel, recortado, porSemana };
}

function calcular(gam, checkins, movimientos, ahora, opts) {
  opts = opts || {};
  const T = temporadaActual(gam, ahora);
  const hoy = hoyIso(ahora);
  const X = xpTemporada(gam, T, movimientos);
  const niv = nivelDe(X.xp, gam.niveles, ahora);
  const L = lineaSemanas(gam, T, checkins, movimientos, ahora);
  const cumplidas = L.semanas.filter((w) => w.estado === 'cumplida');
  const cerradas = L.semanas.filter((w) => w.estado !== 'en_curso');
  const ult = L.semanas[L.semanas.length - 1];
  const racha = ult ? (ult.estado === 'en_curso' && L.semanas.length > 1 ? L.semanas[L.semanas.length - 2].cadena : ult.cadena) : 0;
  const mejorRacha = L.semanas.reduce((a, w) => Math.max(a, w.cadena), 0);

  // Escamas
  const E = gam.escamas || {};
  const bloques = rachasPorAnotarDesde(gam, L.semanas, ahora).filter((r) => r.tipo === 'bloque').length;
  const nivelesAlcanzados = gam.niveles.filter((n) => n.nivel > 1 && n.nivel <= niv.actual.nivel).length;
  const ganadas = cumplidas.filter((w) => w.lunes < clave(ahora || new Date())).length * (E.por_semana_dragon || 0) + bloques * (E.por_bloque || 0) + nivelesAlcanzados * (E.por_nivel || 0);
  const gastadas = (opts.canjes || []).filter((c) => c.temporada === T.id && c.estado !== 'rechazado').reduce((a, c) => a + c.escamas, 0);

  // Semanas que quedan y proyección al ritmo de las últimas 4 semanas cerradas
  let quedan = 0;
  const prot = new Set((T.semanas_protegidas || []).map((x) => x.lunes));
  for (let k = clave(ahora || new Date()); k <= T.fin; k = masDias(k, 7)) if (!prot.has(k)) quedan++;
  const ultimas = cerradas.slice(-4);
  const ritmo = ultimas.length ? ultimas.reduce((a, w) => a + Math.min(X.porSemana[w.lunes] || 0, gam.reglas.tope_semanal_constancia) + (w.estado === 'cumplida' ? 55 : 0), 0) / ultimas.length : 0;
  const proy = X.xp + Math.round(ritmo * quedan);
  const finFecha = new Date(T.fin + 'T12:00:00Z');
  const nivelFinal = nivelDe(proy, gam.niveles, finFecha).actual;

  const asp = (gam.carta.aspectos || []).filter((a) => a.desde_nivel <= niv.actual.nivel).pop() || null;

  // Temporadas anteriores: mejor nivel alcanzado
  const anteriores = (gam.temporadas || []).filter((t) => t.fin < hoy && t.id !== T.id).map((t) => {
    const x = xpTemporada(gam, t, movimientos).xp;
    const n = nivelDe(x, gam.niveles, new Date(t.fin + 'T12:00:00Z')).actual;
    return { temporada: t.id, nivel: n.nivel, nombre: n.nombre, xp: x };
  }).filter((t) => t.xp > 0);

  return {
    temporada: { id: T.id, nombre: T.nombre, inicio: T.inicio, fin: T.fin, cierre_canjes: T.cierre_canjes, semanas_quedan: quedan, en_curso: hoy >= T.inicio && hoy <= T.fin },
    xp: X.xp,
    desglose: { constancia: X.constancia, racha: X.racha, aceleradores: X.aceleradores, tope_aceleradores: gam.reglas.tope_temporada_aceleradores, recortado: X.recortado },
    nivel: { numero: niv.actual.nivel, nombre: niv.actual.nombre },
    siguiente: niv.siguiente ? { numero: niv.siguiente.nivel, nombre: niv.siguiente.nombre, xp_desde: niv.siguiente.xp_desde, faltan: Math.max(0, niv.siguiente.xp_desde - X.xp), recompensa: niv.siguiente.recompensa ? niv.siguiente.recompensa.titulo : null, no_antes_de: niv.siguiente.no_antes_de || null } : null,
    pct: niv.pct,
    bloqueado_hasta: niv.bloqueado ? niv.bloqueado.no_antes_de : null,
    aspecto: asp ? { id: asp.id, nombre: asp.nombre } : null,
    racha,
    mejor_racha: mejorRacha,
    comodines: L.comodines,
    semana_actual: ult && ult.estado === 'en_curso' ? { checkins: ult.checkins, otras: ult.otras } : (ult ? { checkins: ult.checkins, otras: ult.otras } : { checkins: 0, otras: 0 }),
    semanas: L.semanas.map((w) => ({ lunes: w.lunes, estado: w.estado })),
    escamas: { ganadas, gastadas, saldo: Math.max(0, ganadas - gastadas) },
    proyeccion: { xp: proy, nivel: nivelFinal.nivel, nombre: nivelFinal.nombre },
    logros: logros(gam, { checkins, movimientos, mejorRacha }),
    temporadas_anteriores: anteriores,
    semanas_cumplidas: cumplidas.map((w) => w.lunes),
  };
}

// XP de racha por anotar a partir de una línea de semanas: solo semanas cerradas.
function rachasPorAnotarDesde(gam, semanas, ahora) {
  const actual = clave(ahora || new Date());
  const xpSemana = (gam.fuentes_xp.find((f) => f.id === 'racha_semana') || {}).xp || 0;
  const xpBloque = (gam.fuentes_xp.find((f) => f.id === 'racha_bloque') || {}).xp || 0;
  const out = [];
  for (const w of semanas) {
    if (w.estado !== 'cumplida' || w.lunes >= actual) continue;
    out.push({ tipo: 'semana', referencia: 'semana:' + w.lunes, cantidad: xpSemana, nota: 'semana:' + w.lunes + ' · Semana Dragón' });
    if (w.cadena > 0 && w.cadena % 4 === 0) out.push({ tipo: 'bloque', referencia: 'bloque:' + w.lunes, cantidad: xpBloque, nota: 'semana:' + w.lunes + ' · 4 Semanas Dragón seguidas' });
  }
  return out;
}

function rachasPorAnotar(gam, checkins, movimientos, ahora) {
  const T = temporadaActual(gam, ahora);
  return rachasPorAnotarDesde(gam, lineaSemanas(gam, T, checkins, movimientos, ahora).semanas, ahora);
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

// Velocidad de crecimiento en cm/año entre la primera y la última medición del
// último año. Hace falta al menos 2 meses entre medidas.
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

module.exports = { calcular, rachasPorAnotar, nivelDe, edad, crecimiento, clave, temporadaActual, xpTemporada, grupoDe };
