#!/usr/bin/env node
/*
 * Compone _paginas/<id>.html a partir de _paginas/_plantillas/<id>.html.
 * Se ejecuta antes de scripts/paginas.js.
 *
 *   <!--bruto nombre-->         pega _paginas/_bruto/nombre.html sin el
 *                               rótulo, el h2 ni el separador duplicados.
 *   <!--bruto ficha-tarjeta-->  solo la tarjeta #dd-ficha de la ficha.
 *   <!--gamificacion niveles_cinta-->  cinta horizontal de niveles (portada).
 *   <!--incluye-cierre-->       bloque final común con la sesión sin coste.
 *
 * Escribe además _paginas/_ld-organizacion.json y _paginas/_ld-preguntas.json
 * a partir de _paginas/_bruto/ld.json.
 *
 *   node scripts/componer-paginas.js            compone
 *   node scripts/componer-paginas.js --seco     solo informa
 */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const DIR = path.join(RAIZ, '_paginas');
const BRUTO = path.join(DIR, '_bruto');
const PLANT = path.join(DIR, '_plantillas');
const SECO = process.argv.includes('--seco');
const log = (...a) => console.log(...a);

const leer = (f) => fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Devuelve [inicio, fin) del elemento que abre en `desde` (posición de '<'). */
function elemento(html, desde) {
    const m = /^<([a-zA-Z0-9-]+)/.exec(html.slice(desde));
    if (!m) return null;
    const tag = m[1].toLowerCase();
    const vacios = ['img', 'br', 'hr', 'input', 'meta', 'link', 'source'];
    const cierreApertura = html.indexOf('>', desde);
    if (vacios.includes(tag) || html[cierreApertura - 1] === '/') return [desde, cierreApertura + 1];
    const re = new RegExp('<(/?)' + tag + '(?=[\\s>/])[^>]*>', 'gi');
    re.lastIndex = desde;
    let prof = 0, t;
    while ((t = re.exec(html))) {
        if (t[1]) prof--; else if (!t[0].endsWith('/>')) prof++;
        if (prof === 0) return [desde, re.lastIndex];
    }
    return null;
}

/* Elimina el primer elemento cuya etiqueta de apertura cumpla `test`. */
function quitarPrimero(html, reApertura, nombre, quitados) {
    const m = reApertura.exec(html);
    if (!m) return html;
    const r = elemento(html, m.index);
    if (!r) return html;
    quitados.push(nombre + ': ' + html.slice(r[0], r[1]).replace(/\s+/g, ' ').slice(0, 90));
    return html.slice(0, r[0]) + html.slice(r[1]);
}

function limpiarBruto(nombre, html) {
    const quitados = [];
    html = html.replace(/<!--[\s\S]*?-->/g, (c) => (/^<!--\s*(gamificacion|incluye)/.test(c) ? c : '')).trim();

    /* Quita el <section> envolvente: la plantilla pone el suyo. */
    const sec = /^<section\b[^>]*>/i.exec(html);
    if (sec) {
        const r = elemento(html, 0);
        if (r && r[1] >= html.length - 2) {
            html = html.slice(sec[0].length, r[1] - '</section>'.length).trim();
            quitados.push('section envolvente');
        }
    }
    /* Contenedor único (.container) sin más hermanos: se desenvuelve. */
    const cont = /^<div\b[^>]*class="[^"]*\b(container|contenedor|wrap)\b[^"]*"[^>]*>/i.exec(html);
    if (cont) {
        const r = elemento(html, 0);
        if (r && r[1] >= html.length - 2) {
            html = html.slice(cont[0].length, r[1] - '</div>'.length).trim();
            quitados.push('contenedor envolvente');
        }
    }

    if (nombre !== 'reservar') {
        html = quitarPrimero(html, /<(p|span|div)\b[^>]*class="[^"]*\b(section-label|section-eyebrow|eyebrow|kicker|dd-eyebrow|label)\b[^"]*"[^>]*>/i, 'rótulo', quitados);
        html = quitarPrimero(html, /<h2\b[^>]*>/i, 'h2', quitados);
        html = quitarPrimero(html, /<(div|hr|span)\b[^>]*class="[^"]*\b(divider|separador|section-divider)\b[^"]*"[^>]*>/i, 'separador', quitados);
        /* Subtítulo de sección que repetía la entradilla. */
        html = quitarPrimero(html, /<p\b[^>]*class="[^"]*\b(section-subtitle|section-sub|subtitulo)\b[^"]*"[^>]*>/i, 'subtítulo', quitados);
    } else {
        /* El formulario deja de ser un modal. */
        html = html
            .replace(/\s+role="dialog"/gi, '')
            .replace(/\s+aria-modal="true"/gi, '')
            .replace(/\s+aria-labelledby="inscripcion-titulo"/gi, ' aria-label="Formulario de reserva"')
            .replace(/(<[^>]+id="inscripcion"[^>]*?)\s+hidden(?=[\s>])/i, '$1')
            .replace(/(<[^>]+id="inscripcion"[^>]*?)\s+aria-hidden="true"/i, '$1');
        html = quitarPrimero(html, /<button\b[^>]*(class="[^"]*\b(cerrar|close|modal-close|dd-cerrar)\b[^"]*"|aria-label="Cerrar[^"]*")[^>]*>/i, 'botón cerrar', quitados);
        html = quitarPrimero(html, /<div\b[^>]*class="[^"]*\b(modal-overlay|overlay|dd-velo|backdrop)\b[^"]*"[^>]*>\s*<\/div>/i, 'velo', quitados);
        html = quitarPrimero(html, /<h2\b[^>]*>/i, 'h2 del modal', quitados);
    }
    log('  bruto ' + nombre + (quitados.length ? ' → quitado ' + quitados.join(' | ') : ' → sin cambios'));
    return html.trim();
}

function fichaTarjeta() {
    const html = leer(path.join(BRUTO, 'ficha.html'));
    const i = html.search(/<[a-z]+\b[^>]*\bid="dd-ficha"/i);
    if (i < 0) throw new Error('No encuentro #dd-ficha en _bruto/ficha.html');
    const r = elemento(html, i);
    log('  bruto ficha-tarjeta → ' + (r[1] - r[0]) + ' caracteres');
    return html.slice(r[0], r[1]);
}

function nivelesCinta() {
    const g = JSON.parse(leer(path.join(RAIZ, 'data', 'gamificacion.json')));
    const niveles = g.niveles || (g.ladder && g.ladder.niveles) || [];
    if (!niveles.length) throw new Error('gamificacion.json no tiene niveles');
    const xp = (n) => n.xp_min ?? n.xp_desde ?? n.desde ?? n.xp ?? n.min_xp;
    const premio = (n) => n.recompensa ?? n.premio ?? n.desbloquea ?? n.descripcion ?? '';
    const items = niveles.map((n, i) => {
        const x = xp(n);
        const p = typeof premio(n) === 'object' ? (premio(n).texto || premio(n).nombre || '') : premio(n);
        return '            <li><small>Nivel ' + (n.nivel ?? i + 1) + (x != null ? ' &middot; ' + Number(x).toLocaleString('es-ES') + ' XP' : '') + '</small><b>' + esc(n.nombre) + '</b>' + (p ? '<span>' + esc(p) + '</span>' : '') + '</li>';
    });
    log('  niveles_cinta → ' + niveles.length + ' niveles');
    return '<ol class="h-niveles" tabindex="0" aria-label="Niveles de la Dragons Ladder">\n' + items.join('\n') + '\n        </ol>';
}

const CIERRE = `<section class="dd-cierre" aria-labelledby="cierre-titulo">
    <h2 class="dd-h2" id="cierre-titulo" data-reveal>La primera sesi&oacute;n es sin coste.</h2>
    <div data-reveal>
        <p>Vemos tu nivel, te contamos c&oacute;mo trabajamos y eliges plan despu&eacute;s. Sin compromiso.</p>
        <div class="dd-cierre-acciones">
            <a class="btn-primary" href="reservar.html?plan=informacion">Reservar plaza</a>
            <a class="btn-secondary dd-btn-wa" href="https://wa.me/34646794962?text=Hola%20Coach!%20Quiero%20pedir%20la%20sesi%C3%B3n%20de%20evaluaci%C3%B3n%20sin%20coste." target="_blank" rel="noopener noreferrer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>WhatsApp</a>
        </div>
    </div>
</section>`;

function accesoJugadores() {
    try {
        const js = leer(path.join(__dirname, 'paginas.js'));
        const m = /href=\\?"([^"\\]+)\\?"[^>]*>[^<]*Acceso jugadores/.exec(js);
        if (m) return m[1];
    } catch (e) { /* sin generador: se deja el enlace por defecto */ }
    return null;
}

function separarLd() {
    const f = path.join(BRUTO, 'ld.json');
    if (!fs.existsSync(f)) { log('  ld.json no existe, se omite'); return; }
    const crudo = JSON.parse(leer(f));
    let nodos = Array.isArray(crudo) ? crudo : (crudo['@graph'] || [crudo]);
    nodos = nodos.flatMap((n) => (n && n['@graph'] ? n['@graph'] : [n]));
    const tipo = (n) => [].concat(n['@type'] || []);
    const faq = nodos.filter((n) => tipo(n).includes('FAQPage'));
    const org = nodos.filter((n) => !tipo(n).includes('FAQPage'));
    const ctx = (lista) => lista.length === 1
        ? Object.assign({ '@context': 'https://schema.org' }, lista[0])
        : { '@context': 'https://schema.org', '@graph': lista };
    if (!SECO) {
        if (org.length) fs.writeFileSync(path.join(DIR, '_ld-organizacion.json'), JSON.stringify(ctx(org), null, 2) + '\n');
        if (faq.length) fs.writeFileSync(path.join(DIR, '_ld-preguntas.json'), JSON.stringify(ctx(faq), null, 2) + '\n');
    }
    log('  ld → ' + org.length + ' nodo(s) de organización, ' + faq.length + ' FAQPage');
}

function main() {
    const plantillas = fs.readdirSync(PLANT).filter((f) => f.endsWith('.html'));
    const acceso = accesoJugadores();
    const cache = {};
    const bruto = (n) => {
        if (n === 'ficha-tarjeta') return (cache[n] = cache[n] || fichaTarjeta());
        if (!cache[n]) cache[n] = limpiarBruto(n, leer(path.join(BRUTO, n + '.html')));
        return cache[n];
    };
    let cinta = null;
    for (const f of plantillas) {
        log(f);
        let html = leer(path.join(PLANT, f));
        html = html.replace(/<!--bruto ([a-z0-9-]+)-->/g, (_, n) => bruto(n));
        html = html.replace(/<!--gamificacion niveles_cinta-->/g, () => (cinta = cinta || nivelesCinta()));
        html = html.replace(/<!--incluye-cierre-->/g, CIERRE);
        if (acceso) html = html.replace(/href="\/plataforma\/"/g, 'href="' + acceso + '"');
        const restos = html.match(/<!--(bruto|incluye-cierre)[^>]*-->/g);
        if (restos) throw new Error(f + ': marcadores sin resolver ' + restos.join(', '));
        if (!SECO) fs.writeFileSync(path.join(DIR, f), html);
    }
    separarLd();
    log(SECO ? 'Modo seco: no se ha escrito nada.' : 'Listo: ' + plantillas.length + ' páginas en _paginas/. Ahora: node scripts/paginas.js');
}

main();
