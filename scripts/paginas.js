// Monta las páginas públicas de Dragons Den.
//
//   node scripts/paginas.js
//
// Cada página tiene su contenido en _paginas/<nombre>.html. Este script le pone
// alrededor lo que es igual en todas (cabecera, menú móvil, barra inferior, pie,
// aviso de cookies y scripts) y escribe <nombre>.html en la raíz, que es lo que
// se publica. Cambia el menú aquí y cambia en todas las páginas a la vez.
//
// La primera línea de cada archivo de _paginas/ es un comentario con sus datos:
//   <!--pagina {"titulo": "...", "descripcion": "...", "scripts": ["/js/squad.js"]} -->
// Dentro del contenido se puede escribir:
//   <!--incluye _bruto/planes.html-->   pega otro archivo de _paginas/
//   <!--gamificacion niveles-->         tabla generada desde data/gamificacion.json
//                                       (niveles, fuentes, logros)
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, '_paginas');
const DOMINIO = 'https://dragons-den-eight.vercel.app';
const WA = 'https://wa.me/34646794962?text=' + encodeURIComponent('Hola Coach! Quiero información sobre Dragons Den.');

const SECCIONES = [
  { id: 'metodo', corto: 'Método', largo: 'El método', nota: 'Por qué el entreno del club no basta' },
  { id: 'planes', corto: 'Planes', largo: 'Planes de temporada', nota: 'Tracker, Élite Híbrido y PRO VIP' },
  { id: 'servicios', corto: 'Servicios', largo: 'Servicios y equipación', nota: '1v1, Campus vacacional y merchandising' },
  { id: 'ficha', corto: 'Ficha', largo: 'Ficha de jugador', nota: 'Seguimiento, niveles y recompensas' },
  { id: 'embajadores', corto: 'Embajadores', largo: 'Dragons Squad', nota: 'Las cartas de nuestros embajadores' },
  { id: 'preguntas', corto: 'Preguntas', largo: 'Preguntas frecuentes', nota: 'Horas, ausencias, calzado y pagos' },
  { id: 'familias', corto: 'Familias', largo: 'Guía para familias', nota: 'Categoría, horas, sueño, estirón y presión', enNav: false },
  { id: 'blog', corto: 'Blog', largo: 'Blog', nota: 'Metodología y novedades' },
];

const ICONO = {
  wa: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  usuario: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  flecha: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  cerrar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ruta = (id) => (id === 'index' ? '/' : `/${id}.html`);
const href = (id) => (id === 'index' ? 'index.html' : `${id}.html`);
const actual = (id, pagina) => (id === pagina ? ' aria-current="page"' : '');

function cabecera(pagina) {
  return `<nav class="dd-nav" aria-label="Principal">
    <a href="index.html" class="nav-logo"${actual('index', pagina)} aria-label="Dragons Den, inicio">Dragons Den</a>
    <ul class="nav-links">
${SECCIONES.filter((s) => s.id !== 'blog' && s.enNav !== false).map((s) => `        <li><a href="${href(s.id)}"${actual(s.id, pagina)}>${esc(s.corto)}</a></li>`).join('\n')}
    </ul>
    <div class="dd-nav-acciones">
        <a href="login.html" class="dd-nav-acceso">${ICONO.usuario}<span>Acceso jugadores</span></a>
        <a href="reservar.html" class="btn-primary dd-nav-cta"${actual('reservar', pagina)}>Reservar plaza</a>
    </div>
</nav>

<div class="dd-menu" id="dd-menu" hidden>
    <div class="dd-menu-fondo" data-menu-cerrar></div>
    <div class="dd-menu-hoja" role="dialog" aria-modal="true" aria-labelledby="dd-menu-titulo">
        <div class="dd-menu-cab">
            <p class="dd-menu-titulo" id="dd-menu-titulo">Men&uacute;</p>
            <button type="button" class="dd-menu-cerrar" data-menu-cerrar aria-label="Cerrar men&uacute;">${ICONO.cerrar}</button>
        </div>
        <div role="navigation" aria-label="Secciones">
            <ul class="dd-menu-lista">
                <li><a href="index.html"${actual('index', pagina)}><span><b>Inicio</b><small>Qu&eacute; es Dragons Den</small></span>${ICONO.flecha}</a></li>
${SECCIONES.map((s) => `                <li><a href="${href(s.id)}"${actual(s.id, pagina)}><span><b>${esc(s.largo)}</b><small>${esc(s.nota)}</small></span>${ICONO.flecha}</a></li>`).join('\n')}
            </ul>
        </div>
        <div class="dd-menu-acciones">
            <a href="reservar.html" class="btn-primary">Reservar plaza</a>
            <a href="${WA}" target="_blank" rel="noopener noreferrer" class="btn-secondary dd-btn-wa">${ICONO.wa}WhatsApp</a>
        </div>
        <ul class="dd-menu-extra">
            <li><a href="login.html">${ICONO.usuario}Acceso jugadores</a></li>
            <li><a href="legal.html">Legal</a></li>
        </ul>
    </div>
</div>`;
}

function pie() {
  return `<footer class="dd-pie">
    <div class="dd-pie-marca">
        <div class="footer-logo">Dragons Den</div>
        <p>Tecnificaci&oacute;n y seguimiento de baloncesto en Madrid (Carabanchel), juegues en el club que juegues.</p>
        <p class="dd-pie-contacto"><a href="${WA}" target="_blank" rel="noopener noreferrer" class="dd-btn-wa">${ICONO.wa}WhatsApp</a><a href="mailto:bbdragonsden@gmail.com">bbdragonsden@gmail.com</a></p>
    </div>
    <div role="navigation" class="dd-pie-nav" aria-label="Secciones del pie">
${SECCIONES.map((s) => `        <a href="${href(s.id)}">${esc(s.largo)}</a>`).join('\n')}
        <a href="reservar.html">Reservar plaza</a>
        <a href="login.html">Acceso jugadores</a>
    </div>
    <p class="dd-pie-legal">&copy; 2026 Dragons Den Basketball Academy <span aria-hidden="true">&middot;</span> <a href="legal.html">Legal</a></p>
</footer>

<div id="aviso-cookies" class="aviso-cookies" role="region" aria-label="Aviso sobre cookies" hidden>
    <p>Esta web no usa cookies de an&aacute;lisis ni de publicidad. Solo guarda en tu navegador lo imprescindible para funcionar. <a href="cookies.html">M&aacute;s informaci&oacute;n</a>.</p>
    <button type="button" id="aviso-cookies-ok">Entendido</button>
</div>`;
}

function barraInferior(pagina) {
  const tab = (id, icono, txt, extra = '') =>
    `    <a href="${href(id)}" class="tab-item${extra}${id === pagina ? ' active' : ''}"${actual(id, pagina)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icono}</svg>
        <span>${txt}</span>
    </a>`;
  return `<div role="navigation" class="tab-bar" id="tab-bar" aria-label="Navegaci&oacute;n m&oacute;vil">
${tab('index', '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>', 'Inicio')}
${tab('planes', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10"/><path d="M7 13h6"/>', 'Planes')}
${tab('reservar', '<path d="M12 5v14"/><path d="M5 12h14"/>', 'Reservar', ' tab-item--cta')}
${tab('ficha', '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>', 'Ficha')}
    <button type="button" class="tab-item" id="dd-menu-abrir" aria-controls="dd-menu" aria-expanded="false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
        <span>Men&uacute;</span>
    </button>
</div>`;
}

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='46' fill='%23c8a96e'/%3E%3Cg fill='none' stroke='%230a0a0a' stroke-width='5'%3E%3Cpath d='M4 50h92M50 4v92'/%3E%3Cpath d='M18 18c14 14 14 50 0 64M82 18c-14 14-14 50 0 64'/%3E%3C/g%3E%3C/svg%3E";

function cabezaHtml(id, meta) {
  const url = DOMINIO + ruta(id);
  const og = DOMINIO + '/og/' + (meta.og || 'temporada.png');
  const ld = meta.ld ? `\n    <script type="application/ld+json">\n${meta.ld}\n    </script>` : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(meta.titulo)}</title>
    <meta name="description" content="${esc(meta.descripcion)}">
    <meta name="robots" content="${meta.robots || 'index, follow, max-image-preview:large'}">
    <meta name="theme-color" content="#0a0a0a">
    <link rel="canonical" href="${url}">
    <link rel="icon" href="${FAVICON}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Dragons Den Basketball Academy">
    <meta property="og:title" content="${esc(meta.titulo)}">
    <meta property="og:description" content="${esc(meta.descripcion)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${og}">
    <meta property="og:locale" content="es_ES">
    <meta name="twitter:card" content="summary_large_image">${ld}
    <link rel="preload" href="/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/bebas-neue-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>${(meta.precarga || []).map((p) => `\n    <link rel="preload" href="${p.href}" as="${p.as}"${p.type ? ` type="${p.type}"` : ''}>`).join('')}
    <link rel="stylesheet" href="/css/comun.css">
    <link rel="stylesheet" href="/css/sitio.css">
    <link rel="stylesheet" href="/css/detalles.css">
    <link rel="stylesheet" href="/css/temporada.css">
    <link rel="stylesheet" href="/css/paginas.css">
</head>`;
}

// ── Bloques generados desde datos ───────────────────────────────────────
const gam = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/gamificacion.json'), 'utf8'));
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const BLOQUES = {
  niveles: () => `<ol class="dd-escalera" role="list">
${gam.niveles.map((n) => `    <li class="dd-escalon${n.nivel >= 7 ? ' es-alto' : ''}">
        <span class="dd-escalon-num" aria-hidden="true">${n.nivel}</span>
        <span class="dd-escalon-nombre">${esc(n.nombre)}</span>
        <span class="dd-escalon-xp">${n.xp_desde ? 'desde ' + num(n.xp_desde) + ' XP' : 'Punto de partida'}</span>
        <span class="dd-escalon-premio">${n.recompensa ? esc(n.recompensa.titulo) : 'Tu carta de jugador'}</span>
    </li>`).join('\n')}
</ol>`,
  fuentes: () => `<div class="dd-fuentes">
${gam.fuentes_xp.filter((f) => f.activo !== false).map((f) => {
    const xp = f.xp_victoria ? `${f.xp_victoria} / ${f.xp_derrota}` : (typeof f.xp === 'number' ? '+' + f.xp : 'Seg&uacute;n reto');
    const nota = f.xp_victoria ? 'victoria / derrota' : (f.tope_semanal_veces ? `hasta ${f.tope_semanal_veces} por semana` : '');
    return `    <div class="dd-fuente"><span class="dd-fuente-xp">${xp}<small>XP</small></span><span class="dd-fuente-txt">${esc(f.nombre)}${nota ? `<small>${nota}</small>` : ''}</span></div>`;
  }).join('\n')}
</div>`,
  temporada: () => {
    const t = gam.temporadas[0], r = gam.reglas;
    const f = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const ley = gam.niveles.find((n) => n.no_antes_de);
    return `<ul class="dd-ciencia" role="list">
    <li><b>${r.tope_semanal_constancia} XP</b><p>Tope semanal de constancia. Se llega con unas 4 sesiones y su check-in: entrenar más no da más puntos.</p><small>Disciplina, no volumen</small></li>
    <li><b>${r.tope_temporada_aceleradores} XP</b><p>Tope de aceleradores por temporada: hitos técnicos, métricas que suben y compañeros traídos. Adelantan unas 3 semanas, no más.</p><small>Lo da el entrenador</small></li>
    <li><b>${esc(ley.nombre)}</b><p>Solo se corona desde el ${f(ley.no_antes_de)}. Hace falta una temporada casi perfecta.</p><small>${esc(t.nombre)}: del ${f(t.inicio)} al ${f(t.fin)}</small></li>
</ul>`;
  },
  tienda: () => `<ul class="dd-escalera" role="list">
${(gam.tienda || []).filter((i) => i.activo !== false).map((i) => `    <li class="dd-escalon">
        <span class="dd-escalon-num" aria-hidden="true">${i.escamas}</span>
        <span class="dd-escalon-nombre">${esc(i.nombre)}</span>
        <span class="dd-escalon-xp">${i.escamas} Escamas</span>
        <span class="dd-escalon-premio">${esc(i.detalle || '')}</span>
    </li>`).join('\n')}
</ul>`,
  logros: () => `<ul class="dd-logros" role="list">
${gam.logros.filter((l) => l.activo !== false).map((l) => `    <li>${esc(l.nombre)}</li>`).join('\n')}
</ul>`,
};

// ── Montaje ─────────────────────────────────────────────────────────────
function montar(id) {
  let src = fs.readFileSync(path.join(DIR, id + '.html'), 'utf8');
  const m = /^<!--pagina\s+([\s\S]*?)-->\s*/.exec(src);
  if (!m) throw new Error(`_paginas/${id}.html: falta la cabecera <!--pagina {...} -->`);
  const meta = JSON.parse(m[1]);
  src = src.slice(m[0].length);
  src = src.replace(/<!--incluye\s+([^\s]+)\s*-->/g, (_, f) => fs.readFileSync(path.join(DIR, f), 'utf8'));
  src = src.replace(/<!--gamificacion\s+(\w+)\s*-->/g, (_, b) => {
    if (!BLOQUES[b]) throw new Error('bloque desconocido: ' + b);
    return BLOQUES[b]();
  });
  if (meta.ld_archivo) meta.ld = fs.readFileSync(path.join(DIR, meta.ld_archivo), 'utf8').trim();

  const scripts = ['/js/sitio.js', '/js/dd-oferta.js', ...(meta.scripts || []), '/js/nsd-spring.js', '/js/nsd-arriba.js'];
  const html = `${cabezaHtml(id, meta)}
<body class="dd-pag dd-pag--${id}">
<a class="skip-link" href="#contenido">Saltar al contenido</a>

${cabecera(id)}

<main id="contenido">
${src.trim()}
</main>

${pie()}

${barraInferior(id)}

${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, href(id)), html);
  return { id, meta };
}

const paginas = fs.readdirSync(DIR).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''));
const hechas = paginas.map(montar);

// Sitemap: páginas montadas + blog
const blog = fs.existsSync(path.join(RAIZ, 'blog')) ? fs.readdirSync(path.join(RAIZ, 'blog')).filter((f) => f.endsWith('.html')).map((f) => '/blog/' + f) : [];
const hoy = new Date().toISOString().slice(0, 10);
const urls = [...hechas.filter((p) => !/noindex/.test(p.meta.robots || '')).map((p) => ruta(p.id)), ...blog];
fs.writeFileSync(path.join(RAIZ, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${DOMINIO}${u}</loc><lastmod>${hoy}</lastmod></url>`).join('\n')}\n</urlset>\n`);

console.log('montadas:', hechas.map((p) => href(p.id)).join(', '));
