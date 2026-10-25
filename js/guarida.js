/*
 * «Entra en la Guarida»: el formulario de entrada se abre en una carta sobre la
 * página en vez de llevar a otra. Sin JS o sin <dialog>, el enlace lleva a
 * /reservar.html como siempre. El formulario se trae de esa misma página, así
 * que solo hay una versión que mantener.
 */
(function () {
  'use strict';
  if (document.getElementById('inscripcion-form')) return; // ya estamos en reservar.html
  if (!window.HTMLDialogElement) return;
  var dlg = null, cargando = null, ultimoFoco = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  function crear() {
    dlg = document.createElement('dialog');
    dlg.className = 'dd-guarida';
    dlg.setAttribute('aria-labelledby', 'dd-guarida-titulo');
    dlg.innerHTML =
      '<div class="dd-guarida-carta">' +
        '<span class="dd-guarida-esquina" aria-hidden="true"></span><span class="dd-guarida-esquina dd-guarida-esquina--b" aria-hidden="true"></span>' +
        '<span class="dd-guarida-brillo" aria-hidden="true"></span>' +
        '<header class="dd-guarida-cab">' +
          '<p class="dd-guarida-eyebrow">Dragons Den &middot; Temporada 2026-27</p>' +
          '<h2 id="dd-guarida-titulo">Entra en <em>la Guarida</em></h2>' +
          '<p class="dd-guarida-sub">Seis pasos cortos. Al final eliges WhatsApp o correo y el mensaje sale escrito con tus respuestas.</p>' +
          '<button type="button" class="dd-guarida-cerrar" aria-label="Cerrar">' + X + '</button>' +
        '</header>' +
        '<div class="dd-guarida-cuerpo"><p class="dd-guarida-cargando" role="status">Abriendo la Guarida&hellip;</p></div>' +
      '</div>';
    document.body.appendChild(dlg);
    dlg.querySelector('.dd-guarida-cerrar').addEventListener('click', cerrar);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) cerrar(); });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(); });
  }

  function cargar() {
    if (cargando) return cargando;
    cargando = fetch('/reservar.html', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var lay = doc.querySelector('#inscripcion .form-layout');
        if (!lay) throw new Error('sin formulario');
        var info = lay.querySelector('.form-info');
        if (info) info.parentNode.removeChild(info);
        var cuerpo = dlg.querySelector('.dd-guarida-cuerpo');
        cuerpo.innerHTML = '';
        cuerpo.appendChild(document.importNode(lay, true));
        return new Promise(function (ok, ko) {
          var s = document.createElement('script');
          s.src = '/js/reservar.js';
          s.onload = ok; s.onerror = ko;
          document.body.appendChild(s);
        });
      });
    cargando.catch(function () { cargando = null; });
    return cargando;
  }

  function anclar(origen) {
    var carta = dlg.querySelector('.dd-guarida-carta');
    if (!origen || !origen.getBoundingClientRect) { carta.style.transformOrigin = ''; return; }
    var o = origen.getBoundingClientRect(), c = carta.getBoundingClientRect();
    carta.style.transformOrigin = Math.round(o.left + o.width / 2 - c.left) + 'px ' + Math.round(o.top + o.height / 2 - c.top) + 'px';
  }

  function abrir(plan, origen) {
    if (!dlg) crear();
    ultimoFoco = document.activeElement;
    var menu = document.getElementById('dd-menu');
    if (menu && !menu.hidden) { var c = menu.querySelector('[data-menu-cerrar]'); if (c) c.click(); }
    dlg.showModal();
    anclar(origen);
    document.documentElement.classList.add('dd-guarida-abierta');
    requestAnimationFrame(function () { requestAnimationFrame(function () { dlg.classList.add('is-open'); }); });
    cargar().then(function () {
      if (plan) {
        var r = dlg.querySelector('input[name="programa"][value="' + plan + '"]');
        if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      var f = dlg.querySelector('#fecha-nacimiento');
      if (f && window.matchMedia('(pointer: fine)').matches) f.focus({ preventScroll: true });
    }).catch(function () {
      location.href = '/reservar.html' + (plan ? '?plan=' + plan : '');
    });
  }

  function cerrar() {
    if (!dlg || !dlg.open) return;
    dlg.classList.remove('is-open');
    setTimeout(function () {
      dlg.close();
      document.documentElement.classList.remove('dd-guarida-abierta');
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus({ preventScroll: true });
    }, reduce ? 0 : 260);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
    var u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
    if (u.origin !== location.origin || !/\/reservar(\.html)?$/.test(u.pathname)) return;
    e.preventDefault();
    abrir((u.searchParams.get('plan') || '').replace(/[^a-z-]/g, ''), a);
  });
})();
