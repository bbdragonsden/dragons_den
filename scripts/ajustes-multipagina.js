#!/usr/bin/env node
/*
 * Ajustes de una sola vez para pasar a la web multipágina.
 *  1. data/embajadores.json: carta de Naomi con el póster, publicada (consentimiento confirmado).
 *  2. .vercelignore: no publicar _paginas/, scripts/ ni _retirado/.
 *  3. 404.html y blog/*.html: enlaces index.html#seccion → página nueva.
 *
 *   node scripts/ajustes-multipagina.js [--seco]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const SECO = process.argv.includes('--seco');
const leer = (f) => fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
const escribir = (f, s) => { if (!SECO) fs.writeFileSync(f, s); };

/* 1 ─ Naomi */
{
    const f = path.join(RAIZ, 'data', 'embajadores.json');
    const d = JSON.parse(leer(f));
    const lista = Array.isArray(d) ? d : (d.embajadores || d.squad || d.lista || []);
    const n = lista.find((e) => /^naomi/i.test(e.nombre || ''));
    if (!n) throw new Error('No encuentro a Naomi en embajadores.json');
    Object.assign(n, {
        nombre: 'Naomi C.',
        dorsal: 30,
        imagen: '/images/embajadores/naomi-800.webp',
        imagen_mini: '/images/embajadores/naomi-480.webp',
        imagen_jpg: '/images/embajadores/naomi-800.jpg',
        fondo: '/images/embajadores/naomi-fondo-800.webp',
        fondo_mini: '/images/embajadores/naomi-fondo-480.webp',
        fondo_jpg: '/images/embajadores/naomi-fondo-800.jpg',
        sale: '/images/embajadores/naomi-sale-800.webp',
        sale_mini: '/images/embajadores/naomi-sale-480.webp',
        sale_png: '/images/embajadores/naomi-sale-800.png',
        alt: 'Naomi, embajadora Franchise Player de Dragons Den, con el balón y el dorsal 30',
        club_actual: '',
        consentimiento: true,
    });
    escribir(f, JSON.stringify(d, null, 2) + '\n');
    console.log('embajadores.json → Naomi actualizada (consentimiento: ' + n.consentimiento + ')');
}

/* 2 ─ .vercelignore */
{
    const f = path.join(RAIZ, '.vercelignore');
    let s = fs.existsSync(f) ? leer(f) : '';
    const faltan = ['_paginas/', 'scripts/', '_retirado/'].filter((l) => !s.split(/\r?\n/).includes(l));
    if (faltan.length) {
        s = s.replace(/\s*$/, '\n') + '\n# Fuentes del generador multipágina\n' + faltan.join('\n') + '\n';
        escribir(f, s.replace(/^\n+/, ''));
    }
    console.log('.vercelignore → ' + (faltan.length ? 'añadido ' + faltan.join(' ') : 'ya estaba'));
}

/* 3 ─ Enlaces a secciones de la antigua portada única */
{
    const MAPA = {
        metodo: '/metodo.html', 'como-funciona': '/metodo.html',
        planes: '/planes.html', precios: '/planes.html', tarifas: '/planes.html',
        servicios: '/servicios.html', catalogo: '/servicios.html',
        ficha: '/ficha.html', tracker: '/ficha.html',
        embajadores: '/embajadores.html', squad: '/embajadores.html',
        preguntas: '/preguntas.html', faq: '/preguntas.html',
        blog: '/blog.html',
        inscripcion: '/reservar.html', reservar: '/reservar.html', contacto: '/reservar.html',
    };
    const archivos = ['404.html'];
    const dirBlog = path.join(RAIZ, 'blog');
    if (fs.existsSync(dirBlog)) for (const a of fs.readdirSync(dirBlog)) if (a.endsWith('.html')) archivos.push(path.join('blog', a));
    for (const a of archivos) {
        const f = path.join(RAIZ, a);
        if (!fs.existsSync(f)) continue;
        let cambios = 0;
        const s = leer(f).replace(/href="((?:\.\.\/|\/)?(?:index\.html)?)#([a-z-]+)"/gi, (todo, pre, id) => {
            if (!MAPA[id.toLowerCase()]) return todo;
            /* "#id" a secas en blog/ apunta a la propia página: solo se cambia si iba a la portada. */
            if (!pre && a !== '404.html') return todo;
            cambios++;
            return 'href="' + MAPA[id.toLowerCase()] + '"';
        });
        if (cambios) escribir(f, s);
        console.log(a + ' → ' + cambios + ' enlace(s)');
    }
}
console.log(SECO ? 'Modo seco: no se ha escrito nada.' : 'Hecho.');
