/* Calculadora de categoría para la guía de familias. Lee data/reglas.json. */
(function () {
  'use strict';
  var form = document.getElementById('f-calc');
  if (!form) return;
  var res = document.getElementById('f-res');
  var datos = null;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var carga = fetch('/data/reglas.json').then(function (r) { return r.json(); }).then(function (j) {
    datos = j;
    document.getElementById('f-temp').textContent = 'Temporada ' + j.temporada + '. ' + (j.categorias.nota || '') + ' Para jugar en una categoría superior manda el reglamento de cada competición.';
  }).catch(function () { res.innerHTML = '<p class="dd-calc-nota">No se han podido cargar las categorías. Recarga la página.</p>'; });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    carga.then(function () {
      if (!datos) return;
      var a = parseInt(document.getElementById('f-anio').value, 10);
      if (!a || a < 1900 || a > 2024) { res.innerHTML = '<p class="dd-calc-nota">Escribe un año de cuatro cifras, por ejemplo 2013.</p>'; return; }
      var c = datos.categorias;
      var fila = c.filas.find(function (f) { return a >= f.desde && a <= f.hasta; });
      if (!fila) { res.innerHTML = '<p class="dd-calc-nota">Todavía no hay competición para ese año de nacimiento.</p>'; return; }
      res.innerHTML = '<div class="dd-calc-res">' + c.columnas.map(function (col) {
        return '<div><small>' + esc(col.nombre) + '</small><b>' + esc(fila[col.id] || '—') + '</b></div>';
      }).join('') + '</div>';
    });
  });
})();
