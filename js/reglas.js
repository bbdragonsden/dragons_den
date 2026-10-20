/*
 * Normativa del área de jugadores. Cada página de /reglas/ lleva
 * <main data-seccion="..."> y este script la pinta desde /data/reglas.json.
 * Solo con sesión iniciada (en localhost se puede ver sin sesión).
 */
(function () {
  'use strict';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var main = document.querySelector('[data-seccion]');
  var SEC = main.getAttribute('data-seccion');
  var D = null;

  var FLECHA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>';
  var DOC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>';
  var WEB = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function lista(items) { return '<ul class="rg-lista">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; }
  function fichas(items) { return '<div class="rg-fichas">' + items.map(function (x) { return '<div class="rg-ficha"><b>' + esc(x.nombre) + '</b><span>' + esc(x.texto) + '</span></div>'; }).join('') + '</div>'; }
  function seccion(id) { return D.secciones.find(function (s) { return s.id === id; }); }

  function cabecera(id) {
    var s = id === 'inicio' ? { titulo: 'Normativa', resumen: 'Reglas, categorías y competiciones de baloncesto en Madrid y en España, temporada ' + D.temporada + '.' } : seccion(id);
    var titulo = id === 'inicio' ? 'Norma<em>tiva</em>' : esc(s.titulo);
    return (id !== 'inicio' ? '<p class="rg-migas"><a href="/reglas/">Normativa</a> / ' + esc(s.titulo) + '</p>' : '') +
      '<header class="rg-cab"><div><h1 class="ci-h1">' + titulo + '</h1><p class="ci-sub">' + esc(s.resumen) + '</p>' +
      '<p class="rg-meta">Temporada <b>' + esc(D.temporada) + '</b> · Revisado el ' + new Date(D.verificado + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) + '</p></div>' +
      '<div class="rg-acciones"><button class="ci-btn ci-btn--sec ci-btn--peq" type="button" data-imprimir>' + DOC + 'Descargar resumen (PDF)</button></div></header>';
  }

  function docs(grupo) {
    var l = D.documentos.filter(function (d) { return !grupo || d.grupo === grupo; });
    if (!l.length) return '';
    return '<h2 class="rg-h2">Documentos oficiales</h2><ul class="rg-docs">' + l.map(function (d) {
      return '<li><a href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer">' + (d.tipo === 'PDF' ? DOC : WEB) +
        '<span>' + esc(d.titulo) + '<small>' + esc(d.org) + '</small></span><em>' + esc(d.tipo) + '</em></a></li>';
    }).join('') + '</ul><p class="rg-aviso">Los documentos se descargan de la web de cada organismo, que es la versión que vale. Si un enlace falla, avisa a tu entrenador.</p>';
  }

  // ── Secciones ──────────────────────────────────────────────────────────
  var PINTAR = {
    inicio: function () {
      var h = '<section class="rg-edad" aria-labelledby="edad-t"><h2 class="rg-h3" id="edad-t" style="margin-top:0">¿En qué categoría juegas?</h2>' +
        '<form id="edad-form"><div><label class="ci-label" for="edad-anio">Año de nacimiento</label><input class="ci-input ci-num" id="edad-anio" type="number" inputmode="numeric" min="1950" max="2025" placeholder="2012" required></div><button class="ci-btn ci-btn--peq" type="submit">Ver categoría</button></form>' +
        '<div class="rg-edad-res" id="edad-res" aria-live="polite" hidden></div></section>';
      h += '<nav class="rg-hub" aria-label="Apartados de normativa">' + D.secciones.filter(function (s) { return s.id !== 'edades'; }).map(function (s) {
        return '<a class="rg-puerta" href="/reglas/' + s.id + '.html"><b>' + esc(s.titulo) + '</b><span>' + esc(s.resumen) + '</span>' + FLECHA + '</a>';
      }).join('') + '</nav>';
      h += '<h2 class="rg-h2">Categorías por año de nacimiento</h2><p class="rg-p">' + esc(D.categorias.nota) + '</p>' + tablaEdades();
      return h;
    },
    organigrama: function () {
      var o = D.organigrama;
      var nodo = function (id) { return o.niveles.find(function (n) { return n.id === id; }); };
      var rama = function (id) {
        var n = nodo(id);
        var hijos = n.hijos.length ? '<ul>' + n.hijos.map(rama).join('') + '</ul>' : '';
        return '<li><div class="og-nodo' + (n.foco ? ' foco' : '') + '"><b>' + esc(n.nombre) + '</b><span>' + esc(n.rol) + '</span></div>' + hijos + '</li>';
      };
      return '<p class="rg-p" style="margin-top:20px">' + esc(o.nota) + '</p>' +
        '<h2 class="rg-h2">Federaciones</h2><div class="og" role="img" aria-label="Organigrama: FIBA por encima de la FEB; de la FEB dependen la ACB, la Federación de Baloncesto de Madrid y las otras 18 federaciones; de la de Madrid, sus delegaciones."><ul class="og-arbol">' + rama('fiba') + '</ul></div>' +
        '<h2 class="rg-h2">Administración pública</h2><p class="rg-p">Organizan competiciones para quien no tiene licencia federativa.</p><div class="og-publico">' +
        o.publico.map(function (p) { return '<div class="og-nodo"><b>' + esc(p.nombre) + '</b><span>' + esc(p.rol) + '</span></div>'; }).join('') + '</div>' +
        '<h2 class="rg-h2">El camino de un jugador</h2><ol class="og-camino">' + o.camino.map(function (c) { return '<li><span><b>' + esc(c.paso) + '</b><small>' + esc(c.edad) + '</small></span></li>'; }).join('') + '</ol>';
    },
    edades: function () { return '<p class="rg-p" style="margin-top:20px">' + esc(D.categorias.nota) + '</p>' + tablaEdades() + '<p class="rg-aviso">' + esc(D.categorias.nacional) + '</p>'; },
    federado: function () {
      var f = D.federado;
      var t = f.tabla;
      return '<p class="rg-p" style="margin-top:20px">Organiza: <b>' + esc(f.organiza) + '</b>.</p>' +
        '<h2 class="rg-h2">Tipos de liga en categorías de base</h2>' + fichas(f.series) +
        '<h2 class="rg-h2">Senior</h2>' + lista(f.senior) +
        '<h2 class="rg-h2">Reglas por categoría</h2><p class="rg-p">' + esc(t.nota) + '</p>' +
        '<div class="rg-filtro rg-solo-movil" role="group" aria-label="Elegir categoría">' + t.columnas.map(function (c, i) { return '<button type="button" class="ci-op" data-col="' + (i + 2) + '" aria-pressed="' + (i === 0) + '">' + esc(c.split(' (')[0]) + '</button>'; }).join('') + '</div>' +
        '<div class="rg-tabla-wrap" tabindex="0" role="region" aria-label="Reglas por categoría, desplazable"><table class="rg-tabla rg-tabla--cols" data-ver="2"><thead><tr><th scope="col">Regla</th>' + t.columnas.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        t.filas.map(function (fl) { return '<tr><th scope="row">' + esc(fl.regla) + '</th>' + fl.valores.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
        '<h2 class="rg-h2">Para todas las categorías</h2>' + lista(f.reglas_generales) +
        '<h2 class="rg-h2">Minibasket: lo que cambia</h2>' + lista(f.minibasket) +
        '<h2 class="rg-h2">Infantil</h2>' + lista(f.infantil) + docs('federado');
    },
    municipal: function () {
      var m = D.municipal;
      return '<p class="rg-p" style="margin-top:20px">Organiza: <b>' + esc(m.organiza) + '</b>. ' + esc(m.para_quien) + '</p>' +
        '<h2 class="rg-h2">Fechas</h2><ul class="rg-lista">' + m.fechas.map(function (x) { return '<li><b>' + esc(x.cuando) + '</b><small>' + esc(x.que) + '</small></li>'; }).join('') + '</ul>' +
        '<h2 class="rg-h2">Cómo se juega la temporada</h2>' + lista(m.fases) +
        '<h2 class="rg-h2">Cuotas</h2><ul class="rg-lista">' + m.cuotas.map(function (x) { return '<li><b>' + esc(x.precio) + '</b><small>' + esc(x.categoria) + '</small></li>'; }).join('') + '</ul>' +
        '<h2 class="rg-h2">Reglas de baloncesto</h2><p class="rg-aviso">' + esc(m.reglas.nota) + '</p>' + lista(m.reglas.items) + docs('municipal');
    },
    escolar: function () { var e = D.escolar; return '<p class="rg-p" style="margin-top:20px">Organiza: <b>' + esc(e.organiza) + '</b>.</p>' + '<h2 class="rg-h2">Cómo funciona</h2>' + lista(e.items) + docs('escolar'); },
    nacional: function () {
      var n = D.nacional;
      return '<h2 class="rg-h2">Masculino, de arriba abajo</h2>' + fichas(n.masculino) + '<h2 class="rg-h2">Femenino, de arriba abajo</h2>' + fichas(n.femenino) +
        '<h2 class="rg-h2">Base y copas</h2>' + lista(n.base) + docs('nacional');
    },
    '3x3': function () { return '<h2 class="rg-h2">Reglas FIBA 3x3</h2>' + lista(D.tres.reglas) + '<h2 class="rg-h2">Competiciones</h2>' + lista(D.tres.competiciones) + docs('3x3'); },
    'free-basket': function () {
      var f = D.free;
      return '<p class="rg-p" style="margin-top:20px">Organiza: <b>' + esc(f.organiza) + '</b>. ' + esc(f.para_quien) + '</p>' +
        '<h2 class="rg-h2">Categorías</h2>' + lista(f.categorias) + '<h2 class="rg-h2">Formato y precio</h2>' + lista([f.formato, f.precio]) +
        '<h2 class="rg-h2">Reglas propias</h2>' + lista(f.reglas) + docs('free-basket');
    },
    'reglas-fiba': function () {
      var r = D.fiba2026;
      return '<p class="rg-aviso" style="margin-top:20px">En vigor: ' + esc(r.vigor) + '</p><h2 class="rg-h2">Qué cambia</h2>' +
        '<ul class="rg-lista">' + r.cambios.map(function (c) { return '<li><b>' + esc(c.titulo) + '</b> <span style="color:var(--muted);font-size:12px">' + esc(c.art) + '</span><small>' + esc(c.texto) + '</small></li>'; }).join('') + '</ul>' + docs('reglas-fiba');
    },
    autonomicas: function () {
      return '<p class="rg-p" style="margin-top:20px">Cada comunidad tiene sus ligas y sus bases. Las reglas de juego son las de FIBA en todas.</p><ul class="rg-docs" style="margin-top:20px">' + D.autonomicas.map(function (a) {
        return a.web
          ? '<li><a href="' + esc(a.web) + '" target="_blank" rel="noopener noreferrer">' + WEB + '<span>' + esc(a.federacion) + '<small>' + esc(a.nombre) + '</small></span><em>Web</em></a></li>'
          : '<li><a href="https://www.google.com/search?q=' + encodeURIComponent(a.federacion) + '" target="_blank" rel="noopener noreferrer">' + WEB + '<span>' + esc(a.federacion) + '<small>' + esc(a.nombre) + ' · buscar web</small></span><em>Buscar</em></a></li>';
      }).join('') + '</ul>';
    },
    documentos: function () {
      var grupos = [['', 'Todos'], ['federado', 'Federado'], ['municipal', 'Municipal'], ['escolar', 'Escolar'], ['nacional', 'Nacional'], ['3x3', '3x3'], ['free-basket', 'Free Basket'], ['reglas-fiba', 'Reglas FIBA']];
      return '<div class="rg-filtro" role="group" aria-label="Filtrar documentos">' + grupos.map(function (g, i) { return '<button type="button" class="ci-op" data-grupo="' + g[0] + '" aria-pressed="' + (i === 0) + '">' + g[1] + '</button>'; }).join('') + '</div><div id="docs-lista">' + docs('') + '</div>';
    },
  };

  function tablaEdades() {
    var c = D.categorias;
    return '<div class="rg-tabla-wrap" tabindex="0" role="region" aria-label="Categorías por año, desplazable"><table class="rg-tabla rg-tabla--edades"><thead><tr><th scope="col">Nacidos en</th>' +
      c.columnas.map(function (x) { return '<th scope="col">' + esc(x.nombre) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      c.filas.map(function (f) { return '<tr><th scope="row" class="ci-num">' + (f.desde === 1900 ? 'Hasta ' + f.hasta : f.desde + '–' + f.hasta) + '</th>' + c.columnas.map(function (x) { return '<td>' + esc(f[x.id]) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>';
  }

  function enlazar() {
    var b = document.querySelector('[data-imprimir]');
    if (b) b.addEventListener('click', function () { window.print(); });
    var f = document.getElementById('edad-form');
    if (f) f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var a = Number(document.getElementById('edad-anio').value);
      var fila = D.categorias.filas.find(function (x) { return a >= x.desde && a <= x.hasta; });
      var res = document.getElementById('edad-res');
      res.hidden = false;
      res.innerHTML = fila ? D.categorias.columnas.map(function (c) { return '<div><small>' + esc(c.nombre) + '</small><b>' + esc(fila[c.id]) + '</b></div>'; }).join('')
        : '<div><small>Sin datos</small><b>Revisa el año.</b></div>';
    });
    var cols = document.querySelector('.rg-solo-movil');
    if (cols) cols.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-col]');
      if (!btn) return;
      cols.querySelectorAll('[data-col]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
      document.querySelector('.rg-tabla--cols').setAttribute('data-ver', btn.dataset.col);
    });
    var filtro = document.querySelector('.rg-filtro:not(.rg-solo-movil)');
    if (filtro) filtro.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-grupo]');
      if (!btn) return;
      filtro.querySelectorAll('[data-grupo]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
      document.getElementById('docs-lista').innerHTML = docs(btn.dataset.grupo);
    });
  }

  async function iniciar() {
    try {
      if (!LOCAL && window.supabase) {
        var sb = window.supabase.createClient('https://oyuhyrzjhaqzawwnmwcv.supabase.co', 'sb_publishable_W4UBtORpWtWnKGzw-x9VbA_gPsDQfzQ');
        var s = await sb.auth.getSession();
        if (!s.data.session) { location.href = '/login.html'; return; }
      }
      D = await fetch('/data/reglas.json').then(function (r) { return r.json(); });
      var s2 = SEC === 'inicio' ? null : seccion(SEC);
      if (s2) document.title = s2.titulo + ' | Normativa | Dragons Den';
      main.innerHTML = cabecera(SEC) + (PINTAR[SEC] ? PINTAR[SEC]() : '');
      enlazar();
    } catch (e) {
      main.innerHTML = '<p class="ci-vacio">No se ha podido cargar la normativa. Recarga la página.</p>';
    }
  }
  iniciar();
})();
