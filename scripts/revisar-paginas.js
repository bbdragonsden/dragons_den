// Revisión rápida de las páginas generadas: ids referenciados, enlaces internos y JSON-LD.
'use strict';
const fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '..');
const pags = ['index','metodo','planes','servicios','ficha','embajadores','preguntas','blog','reservar','familias'];
let fallos = 0;
for (const p of pags) {
  const h = fs.readFileSync(path.join(R, p + '.html'), 'utf8');
  const ids = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const refs = [...h.matchAll(/aria-(?:labelledby|describedby|controls)="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/));
  const rotos = refs.filter(r => !ids.has(r));
  const enl = [...h.matchAll(/href="([^"#?]+\.html)/g)].map(m => m[1].replace(/^\//, '')).filter(e => !/^https?:/.test(e));
  const faltan = [...new Set(enl.filter(e => !fs.existsSync(path.join(R, e))))];
  const anclas = [...h.matchAll(/href="#([^"]+)"/g)].map(m => m[1]).filter(a => a && !ids.has(a));
  const ld = (h.match(/application\/ld\+json/g) || []).length;
  const h1 = (h.match(/<h1\b/g) || []).length;
  const marc = h.match(/<!--(bruto|gamificacion|incluye)[^>]*-->/g);
  const linea = `${p}: h1=${h1} ld=${ld}` + (rotos.length ? ` ARIA-ROTOS=${rotos}` : '') + (faltan.length ? ` ENLACES-ROTOS=${faltan}` : '') + (anclas.length ? ` ANCLAS-ROTAS=${[...new Set(anclas)]}` : '') + (marc ? ` MARCADORES=${marc}` : '');
  if (rotos.length || faltan.length || anclas.length || marc || h1 !== 1) fallos++;
  console.log(linea);
}
console.log(fallos ? fallos + ' página(s) con avisos' : 'todo bien');
