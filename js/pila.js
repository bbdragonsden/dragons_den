/*
 * Tarjetas que se apilan al hacer scroll (móvil y tableta): cada tarjeta se queda
 * pegada arriba y la siguiente sube por encima; la de debajo se encoge un poco y
 * se oscurece. Solo transform y opacity. Sin efecto con movimiento reducido.
 * Uso: class="dd-pila" en el contenedor; sus hijos directos son las tarjetas.
 */
(function () {
  'use strict';
  var pilas = Array.prototype.slice.call(document.querySelectorAll('.dd-pila'));
  if (!pilas.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var mq = window.matchMedia('(max-width: 900px)');
  var grupos = pilas.map(function (p) {
    var items = Array.prototype.slice.call(p.children);
    items.forEach(function (el, i) {
      el.style.setProperty('--n', i);
      var s = document.createElement('span');
      s.className = 'dd-pila-sombra';
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
    });
    return items;
  });
  // Cada tarjeta se pega bajo la cabecera; si es más alta que la pantalla, se pega
  // más arriba para que se pueda leer entera (y pulsar su botón) antes de taparla.
  function cabecera() {
    var nav = document.querySelector('.dd-nav');
    var base = Math.round((nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0) + 12);
    var barra = document.getElementById('tab-bar');
    var abajo = barra && getComputedStyle(barra).display !== 'none' ? barra.offsetHeight : 0;
    grupos.forEach(function (items) {
      items.forEach(function (el, i) {
        if (!mq.matches) { el.style.top = ''; return; }
        var t = Math.min(base + i * 10, window.innerHeight - abajo - el.offsetHeight - 16);
        el.style.top = t + 'px';
      });
    });
  }
  var marco = null;
  function pintar() {
    marco = null;
    var activo = mq.matches;
    document.documentElement.classList.toggle('dd-pila-on', activo);
    grupos.forEach(function (items) {
      items.forEach(function (el, i) {
        var sig = items[i + 1];
        var p = 0;
        if (activo && sig) {
          var r = el.getBoundingClientRect(), rs = sig.getBoundingClientRect();
          p = (r.bottom - rs.top) / Math.max(1, r.height);
          p = Math.max(0, Math.min(1, p));
        }
        el.style.setProperty('--p', p.toFixed(3));
      });
    });
  }
  function pedir() { if (!marco) marco = requestAnimationFrame(pintar); }
  cabecera();
  pintar();
  window.addEventListener('load', function () { cabecera(); pintar(); });
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', function () { cabecera(); pedir(); });
  if (mq.addEventListener) mq.addEventListener('change', function () { cabecera(); pedir(); });
})();

// Cifras que cuentan hacia arriba al aparecer ([data-cuenta] o las de .p-cifras).
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  var els = Array.prototype.slice.call(document.querySelectorAll('.p-cifras b'));
  if (!els.length) return;
  var io = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var nodo = e.target.querySelector('[data-dd]') || e.target;
      var fin = parseInt(nodo.textContent, 10);
      if (!fin) return;
      var t0 = null, dur = 900;
      (function paso(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / dur);
        nodo.textContent = String(Math.max(1, Math.round(fin * (1 - Math.pow(1 - k, 3)))));
        if (k < 1) requestAnimationFrame(paso); else nodo.textContent = String(fin);
      })(performance.now());
    });
  }, { threshold: .6 });
  els.forEach(function (el) { io.observe(el); });
})();
