#!/usr/bin/env node
// Comprueba que los enlaces de data/reglas.json siguen respondiendo.
// Uso: node scripts/comprobar-reglas.js   (pasarlo al empezar cada temporada)
'use strict';
const fs = require('fs'), path = require('path');
const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'reglas.json'), 'utf8'));
const urls = d.documentos.map((x) => [x.titulo, x.url]).concat(d.autonomicas.filter((a) => a.web).map((a) => [a.federacion, a.web]));
(async () => {
  let mal = 0;
  for (const [t, u] of urls) {
    try {
      const r = await fetch(u, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 DragonsDen-comprobador' } });
      const ok = r.status < 400;
      if (!ok) mal++;
      console.log((ok ? 'ok  ' : 'MAL ') + r.status + '  ' + t);
      try { await r.body.cancel(); } catch (e) { /* nada */ }
    } catch (e) { mal++; console.log('MAL ---  ' + t + '  (' + e.message + ')'); }
  }
  console.log(mal ? mal + ' enlace(s) a revisar' : 'Todos los enlaces responden');
  console.log('Temporada en el catálogo: ' + d.temporada + ' · revisado: ' + d.verificado);
})();
