// Uso único (20/10/2026): parte la portada monolítica en piezas reutilizables.
//   - css/sitio.css        estilos que vivían en <style> dentro de index.html
//   - js/sitio.js          menú, animaciones de aparición, aviso de cookies, tacto
//   - js/reservar.js       asistente de inscripción (paso a paso + mensaje final)
//   - _paginas/_bruto/*    el contenido de cada sección, ya con enlaces a páginas
// La portada original se guarda en _retirado/ antes de tocar nada.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const leer = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const escribir = (p, s) => {
  fs.mkdirSync(path.dirname(path.join(raiz, p)), { recursive: true });
  fs.writeFileSync(path.join(raiz, p), s);
};

const html = leer('index.html');
escribir('_retirado/index-portada-unica-2026-10-20.html', html);

function entre(texto, ini, fin, desde = 0) {
  const a = texto.indexOf(ini, desde);
  const b = texto.indexOf(fin, a + ini.length);
  if (a < 0 || b < 0) throw new Error('marcador no encontrado: ' + ini.slice(0, 50) + ' / ' + fin.slice(0, 50));
  return texto.slice(a, b);
}

// ── CSS ─────────────────────────────────────────────────────────────────
const estilo = entre(html, '<style>', '</style>').slice('<style>'.length);
escribir('css/sitio.css',
  '/*\n * Estilos base de Dragons Den: tokens, cabecera, botones, secciones, formulario,\n' +
  ' * barra inferior y pie. Venían dentro de index.html; ahora los comparten todas las páginas.\n */\n' +
  estilo.replace(/^\n+/, '').replace(/\n {8}/g, '\n').trim() + '\n');

// ── JS ──────────────────────────────────────────────────────────────────
const ini = html.indexOf('<script>\n    // ── WIZARD');
const fin = html.indexOf('</script>', ini);
const js = html.slice(ini + '<script>'.length, fin);
const corte = (a, b) => entre(js, a, b);
const asistente = corte('    // ── WIZARD', '    // Navegaci');
const navegacion = corte('    // Navegaci', '    // Men');
const menu = corte('    // Men', '    // ── Animaciones de aparicion');
const aparicion = corte('    // ── Animaciones de aparicion', '    // Aviso informativo de cookies');
const cookies = corte('    // Aviso informativo de cookies', '    // Formulario de inscripcion: se abre como ventana modal');

escribir('js/reservar.js',
  '// Asistente de inscripción de reservar.html: 6 pasos, resumen y mensaje final\n' +
  '// por WhatsApp o correo compuesto con las respuestas. Copia en /api/inscripcion.\n' +
  asistente
    .replace("var form = document.getElementById('inscripcion-form');", "var form = document.getElementById('inscripcion-form');\n        if (!form) return;")
    .replace(/^ {4}/gm, '') +
  `
// Los enlaces "reservar.html?plan=hibrido" llegan con el plan ya marcado.
(function () {
    var plan = new URLSearchParams(location.search).get('plan');
    if (!plan) return;
    var r = document.querySelector('input[name="programa"][value="' + plan.replace(/[^a-z-]/g, '') + '"]');
    if (r) r.checked = true;
})();
`);

escribir('js/sitio.js',
  '// Comportamiento común de todas las páginas de Dragons Den.\n' +
  (navegacion + menu + aparicion + cookies).replace(/^ {4}/gm, '') +
  `
// Respuesta táctil de botones y tarjetas (solo transform; respeta movimiento reducido).
document.addEventListener('DOMContentLoaded', function () {
    if (!window.NSDSpring) return;
    document.querySelectorAll('.btn-primary, .btn-secondary, .dd-tier, .dd-enlace-grande').forEach(function (el) {
        window.NSDSpring.tacto(el, { escala: el.matches('.dd-tier, .dd-enlace-grande') ? 0.985 : 0.96 });
    });
});
`);

// ── Secciones → _paginas/_bruto/ (material para montar cada página) ──────
const enlaces = [
  [/href="#programa"/g, 'href="metodo.html"'], [/href="#precios"/g, 'href="planes.html"'],
  [/href="#servicios"/g, 'href="servicios.html"'], [/href="#tracker"/g, 'href="ficha.html"'],
  [/href="#embajadores"/g, 'href="embajadores.html"'], [/href="#preguntas"/g, 'href="preguntas.html"'],
  [/href="#blog"/g, 'href="blog.html"'], [/href="#inscripcion"/g, 'href="reservar.html"'],
  [/href="#inicio-section"/g, 'href="index.html"'],
];
const arregla = (s) => enlaces.reduce((t, [re, r]) => t.replace(re, r), s).trim() + '\n';
const trozos = {
  metodo: ['<!-- PROGRAMA', '<!-- PRECIOS'],
  planes: ['<!-- PRECIOS', '<!-- SERVICIOS'],
  servicios: ['<!-- SERVICIOS', '<!-- FICHA DE JUGADOR'],
  ficha: ['<!-- FICHA DE JUGADOR', '<!-- OPINIONES'],
  blog: ['<!-- BLOG', '<!-- PREGUNTAS'],
  preguntas: ['<!-- PREGUNTAS', '<!-- INSCRIPCION'],
  reservar: ['<div class="form-section" id="inscripcion"', '<!-- FOOTER -->'],
};
for (const [nombre, [a, b]] of Object.entries(trozos)) escribir(`_paginas/_bruto/${nombre}.html`, arregla(entre(html, a, b)));

// JSON-LD de la portada (organización + preguntas)
escribir('_paginas/_bruto/ld.json', entre(html, '<script type="application/ld+json">', '</script>').replace('<script type="application/ld+json">', '').trim() + '\n');

// ── gamificacion.json: tildes en los textos que se publican ─────────────
const palabras = {
  Sesion: 'Sesión', sesion: 'sesión', Rotacion: 'Rotación', Munequera: 'Muñequera', analisis: 'análisis',
  estadisticas: 'estadísticas', util: 'útil', Metrica: 'Métrica', metrica: 'métrica', metricas: 'métricas',
  tecnico: 'técnico', Mecanica: 'Mecánica', mecanica: 'mecánica', Biomecanica: 'Biomecánica', Dragon: 'Dragón',
  companero: 'compañero', Companero: 'Compañero', mas: 'más', dia: 'día',
  ultimos: 'últimos', energia: 'energía', balon: 'balón', unico: 'único', Unico: 'Único', tambien: 'también',
  numero: 'número', video: 'vídeo', anos: 'años', minimo: 'mínimo', ningun: 'ningún', segun: 'según',
  traido: 'traído', Leyenda: 'Leyenda',
};
let g = leer('data/gamificacion.json');
for (const [mal, bien] of Object.entries(palabras)) {
  if (mal === bien) continue;
  g = g.replace(new RegExp(`(?<![\\w-])${mal}(?![\\w-])`, 'g'), bien);
}
JSON.parse(g); // que siga siendo JSON válido
escribir('data/gamificacion.json', g);

console.log('ok: css/sitio.css, js/sitio.js, js/reservar.js, _paginas/_bruto/*');
