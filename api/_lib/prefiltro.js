// Prefiltro automático de textos y pruebas en vídeo.
// Propone una decisión y explica por qué; la última palabra es del entrenador.
'use strict';

const INSULTOS = [
  'gilipollas', 'imbecil', 'idiota', 'subnormal', 'tonto', 'puta', 'puto', 'mierda',
  'cabron', 'joder', 'coño', 'maricon', 'zorra', 'capullo', 'retrasado', 'mongolo',
];
const BALONCESTO = [
  'tiro', 'tirar', 'bote', 'botar', 'pase', 'pasar', 'defensa', 'defender', 'rebote', 'bloqueo',
  'pies', 'entreno', 'partido', 'entrenador', 'canasta', 'aro', 'triple', 'balon', 'pista',
  'equipo', 'contraataque', 'zona', 'falta', 'ataque', 'minutos', 'cansado', 'cansancio',
  'mano', 'izquierda', 'derecha', 'salto', 'velocidad', 'mejorar', 'fallo', 'falle', 'meti',
  'nervios', 'concentr', 'jugada', 'rival', 'marcar', 'presion', 'carrera', 'fisico',
];

function normalizar(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Parecido entre dos textos por bigramas de letras (0 a 1).
function parecido(a, b) {
  const big = (s) => {
    const t = normalizar(s).replace(/\s+/g, ' ');
    const m = new Map();
    for (let i = 0; i < t.length - 1; i++) { const k = t.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); }
    return m;
  };
  const A = big(a), B = big(b);
  let comun = 0, total = 0;
  for (const [k, v] of A) { comun += Math.min(v, B.get(k) || 0); total += v; }
  for (const v of B.values()) total += v;
  return total ? (2 * comun) / total : 0;
}

function texto(t, previos, minimo) {
  const motivos = [];
  let puntos = 60;
  const raw = String(t || '').trim();
  const n = normalizar(raw);
  const palabras = n.split(/[^a-zñ0-9]+/).filter(Boolean);

  if (raw.length < (minimo || 20)) { motivos.push('Muy corto'); puntos -= 40; }
  if (/(.)\1{4,}/.test(n)) { motivos.push('Letras repetidas'); puntos -= 30; }
  if (palabras.length && new Set(palabras).size / palabras.length < 0.5 && palabras.length > 4) { motivos.push('Palabras repetidas'); puntos -= 25; }
  if (raw.length > 12 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) { motivos.push('Todo en mayúsculas'); puntos -= 10; }
  if (INSULTOS.some((p) => palabras.includes(p))) { motivos.push('Lenguaje ofensivo'); puntos -= 60; }
  if (/(https?:\/\/|www\.|@[a-z0-9_]{3,}|\b\d{9}\b|[a-z0-9._-]+@[a-z0-9-]+\.)/i.test(raw)) { motivos.push('Contiene enlace, usuario, teléfono o correo'); puntos -= 50; }

  const tecnicos = BALONCESTO.filter((p) => n.includes(p)).length;
  if (tecnicos >= 2) { puntos += 25; } else if (tecnicos === 1) { puntos += 10; } else { motivos.push('No habla de la sesión'); puntos -= 15; }
  if (palabras.length >= 12) puntos += 10;

  let maxParecido = 0;
  for (const p of previos || []) maxParecido = Math.max(maxParecido, parecido(raw, p));
  if (maxParecido >= 0.85) { motivos.push('Casi igual que un comentario anterior'); puntos -= 45; }

  puntos = Math.max(0, Math.min(100, puntos));
  const sugerencia = puntos >= 80 ? 'aprobar' : puntos < 35 ? 'rechazar' : 'revisar';
  return { puntos, sugerencia, motivos, parecido_max: Math.round(maxParecido * 100) / 100 };
}

// Distancia de Hamming entre dos huellas en hexadecimal.
function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

// La huella es la concatenación de 4 dHash de 64 bits (16 hex cada uno), uno
// por fotograma. Dos vídeos se parecen si la mayoría de fotogramas se parecen.
function distanciaVideo(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  const trozos = a.length / 16;
  const ds = [];
  for (let i = 0; i < trozos; i++) ds.push(hamming(a.slice(i * 16, i * 16 + 16), b.slice(i * 16, i * 16 + 16)));
  ds.sort((x, y) => x - y);
  return ds[Math.floor(ds.length / 2)];
}

function video(meta, anteriores, cfg) {
  const motivos = [];
  let puntos = 70;
  const dur = Number(meta.duracion_seg) || 0;
  if (dur < cfg.duracion_min_seg || dur > cfg.duracion_max_seg) { motivos.push('Duración fuera de lo pedido (' + dur.toFixed(1) + ' s)'); puntos -= 30; }
  if (meta.grabado_en) {
    const horas = (Date.now() - new Date(meta.grabado_en).getTime()) / 3600000;
    if (horas > cfg.horas_max_desde_grabacion) { motivos.push('Grabado hace ' + Math.round(horas) + ' h'); puntos -= 40; }
  } else {
    motivos.push('El archivo no indica cuándo se grabó');
    puntos -= 5;
  }
  const iguales = [];
  const parecidos = [];
  for (const p of anteriores || []) {
    if (meta.sha256 && p.video_sha256 === meta.sha256) iguales.push(p.id);
    else if (meta.firma && distanciaVideo(meta.firma, p.video_firma) <= cfg.umbral_parecido_bits) parecidos.push(p.id);
  }
  if (iguales.length) { motivos.push('Archivo idéntico a una prueba anterior'); puntos = 0; }
  if (parecidos.length) { motivos.push('Muy parecido a ' + parecidos.length + ' prueba(s) anterior(es)'); puntos -= 45; }
  puntos = Math.max(0, Math.min(100, puntos));
  return {
    puntos,
    sugerencia: iguales.length ? 'rechazar' : puntos >= 60 ? 'revisar' : 'rechazar',
    motivos,
    iguales,
    parecidos,
    nota: 'Comprueba que se ve una pista o canasta y el gesto pedido.',
  };
}

module.exports = { texto, video, parecido, hamming, distanciaVideo, normalizar };
