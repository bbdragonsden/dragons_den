/**
 * Validación del catálogo de datos de Dragons Den.
 *
 * Comprueba lo que un error tipográfico rompe en silencio: pesos que no suman
 * 100, niveles desordenados, retos que apuntan a un plan inexistente, ids
 * repetidos o respuestas del trivial que no están entre las opciones.
 *
 * Uso: node data/validar.js
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const leer = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

const fallos = [];
const avisos = [];
const mal = (m) => fallos.push(m);

let quests, niveles, planes, iq;
for (const [nombre, destino] of [
  ['quests.json', (d) => (quests = d)],
  ['niveles.json', (d) => (niveles = d)],
  ['planes.json', (d) => (planes = d)],
  ['../api/_lib/iq-clash.solucionario.json', (d) => (iq = d)],
]) {
  try {
    destino(leer(nombre));
  } catch (e) {
    mal(`${nombre} no se puede leer: ${e.message}`);
  }
}
if (fallos.length) {
  console.log(fallos.join('\n'));
  process.exit(1);
}

// ── planes ───────────────────────────────────────────────────────────────────
const idsPlan = new Set(planes.planes.map((p) => p.id));

// ── retos ────────────────────────────────────────────────────────────────────
const vistos = new Set();
for (const r of quests.retos) {
  if (vistos.has(r.id)) mal(`reto duplicado: ${r.id}`);
  vistos.add(r.id);

  const suma = r.criterios.reduce((a, c) => a + c.peso, 0);
  if (suma !== 100) mal(`${r.id}: los pesos suman ${suma}, deberían sumar 100`);

  if (!r.criterios.some((c) => c.obligatorio))
    avisos.push(`${r.id}: ningún criterio obligatorio, todo se aprueba siempre`);

  const idsCrit = new Set();
  for (const c of r.criterios) {
    if (idsCrit.has(c.id)) mal(`${r.id}: criterio repetido ${c.id}`);
    idsCrit.add(c.id);
    if (!/^[a-z]?\d+$/.test(c.id)) avisos.push(`${r.id}: id de criterio raro "${c.id}"`);
  }

  for (const p of r.planes) if (!idsPlan.has(p)) mal(`${r.id}: plan desconocido "${p}"`);

  if (new Date(r.cierra) <= new Date(r.abre)) mal(`${r.id}: cierra antes de abrir`);
  if (r.edad_min > r.edad_max) mal(`${r.id}: edad_min mayor que edad_max`);
  if (r.requiere_clip && !r.clip) mal(`${r.id}: pide clip pero no dice cómo grabarlo`);
  if (r.xp_base <= 0) mal(`${r.id}: xp_base no positivo`);
}

// Una semana sin reto es un hueco en la retención: se avisa.
const semanas = quests.retos.map((r) => r.semana).sort();
for (let i = 1; i < semanas.length; i++) {
  const a = +semanas[i - 1].slice(-2);
  const b = +semanas[i].slice(-2);
  if (b - a > 1) avisos.push(`hueco de semanas entre ${semanas[i - 1]} y ${semanas[i]}`);
}

// ── niveles ──────────────────────────────────────────────────────────────────
let anterior = -1;
for (const n of niveles.niveles) {
  if (n.xp_desde <= anterior) mal(`nivel ${n.nivel}: xp_desde no es creciente`);
  anterior = n.xp_desde;
}

// Ritmo real: retos del mes + racha + tope del trivial. Es el techo que permite
// tope_semanal, y es el que hay que usar para calcular coste de recompensas:
// el que llega antes al premio es siempre el que más juega.
const xpRetosMes = 4 * (quests.retos.reduce((a, r) => a + r.xp_base, 0) / quests.retos.length);
const xpNormal = xpRetosMes;
const xpRapido = xpRetosMes + 100 + 4 * niveles.reglas_xp.iq_clash.match(/(\d+) XP semanales/)?.[1];

for (const n of niveles.niveles) {
  if (!n.xp_desde) continue;
  for (const [campo, ritmo] of [
    ['meses_ritmo_normal', xpNormal],
    ['meses_ritmo_rapido', xpRapido],
  ]) {
    const real = n.xp_desde / ritmo;
    if (Math.abs(real - n[campo]) > Math.max(0.5, real * 0.15))
      avisos.push(
        `nivel ${n.nivel}: ${campo} dice ${n[campo]}, el cálculo con ` +
          `${Math.round(ritmo)} XP/mes da ${real.toFixed(1)}`,
      );
  }
}

// ── regla de margen ──────────────────────────────────────────────────────────
// Una recompensa que cuesta más del 25 % de lo facturado hasta ese nivel
// convierte la gamificación en un agujero. Se mide contra el ritmo rápido.
const precioDe = Object.fromEntries(planes.planes.filter((p) => p.precio_mes).map((p) => [p.id, p.precio_mes]));
const valorHora = niveles.valor_hora_coach_eur;
for (const n of niveles.niveles) {
  if (!n.recompensa) continue;
  const coste = (n.coste_recompensa_eur || 0) + ((n.coste_tiempo_min || 0) / 60) * valorHora;
  if (coste === 0) continue;
  const plan = n.plan_minimo || 'rookie';
  const ingreso = n.meses_ritmo_rapido * precioDe[plan];
  const pct = coste / ingreso;
  const linea =
    `nivel ${n.nivel}: la recompensa cuesta ${coste.toFixed(0)} € contra ` +
    `${ingreso.toFixed(0)} € facturados (${(pct * 100).toFixed(0)} %), plan ${plan}`;
  if (pct > 0.25) {
    if (n.excepcion_margen) avisos.push(linea + ' — excepción declarada');
    else mal(linea + ' — supera el 25 % sin excepción declarada');
  }
}

// Las recompensas que cuestan tiempo de pista no pueden estar abiertas al plan
// más barato sin una alternativa para quien no llega a ese plan.
for (const n of niveles.niveles) {
  if ((n.coste_tiempo_min || 0) >= 60 && !n.plan_minimo)
    mal(`nivel ${n.nivel}: regala una hora de pista sin exigir plan mínimo`);
  if (n.plan_minimo && !n.recompensa_si_no_llega_al_plan)
    mal(`nivel ${n.nivel}: exige plan ${n.plan_minimo} y no ofrece alternativa a quien no lo tiene`);
}

// El tope semanal no puede dejar retos inalcanzables.
const tope = niveles.reglas_xp.tope_semanal;
for (const r of quests.retos)
  if (r.xp_base > tope) mal(`${r.id}: xp_base ${r.xp_base} supera el tope semanal ${tope}`);

// ── trivial ──────────────────────────────────────────────────────────────────
const temas = new Set(iq.temas.map((t) => t.id));
const idsPreg = new Set();
for (const p of iq.preguntas) {
  if (idsPreg.has(p.id)) mal(`pregunta duplicada: ${p.id}`);
  idsPreg.add(p.id);
  if (!temas.has(p.tema)) mal(`${p.id}: tema desconocido "${p.tema}"`);
  const ops = p.opciones.map((o) => o.id);
  if (!ops.includes(p.correcta)) mal(`${p.id}: la respuesta "${p.correcta}" no está entre las opciones`);
  if (new Set(ops).size !== ops.length) mal(`${p.id}: opciones con id repetido`);
  if (!p.explicacion) mal(`${p.id}: sin explicación, que es lo único que enseña`);
}
if (iq.preguntas.length < iq.config.preguntas_por_duelo * 3)
  avisos.push(
    `solo hay ${iq.preguntas.length} preguntas para duelos de ${iq.config.preguntas_por_duelo}: ` +
      `se repetirán enseguida y se memorizarán`,
  );

// ── salida ───────────────────────────────────────────────────────────────────
console.log(
  `retos ${quests.retos.length} · niveles ${niveles.niveles.length} · ` +
    `planes ${planes.planes.length} · preguntas ${iq.preguntas.length}`,
);
if (avisos.length) {
  console.log('\nAVISOS');
  for (const a of avisos) console.log('  ~ ' + a);
}
if (fallos.length) {
  console.log('\nFALLOS');
  for (const f of fallos) console.log('  X ' + f);
  process.exit(1);
}
console.log('\nsin fallos');
