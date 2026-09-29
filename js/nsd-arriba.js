/* =========================================================
   Boton flotante "volver arriba".
   ---------------------------------------------------------
   Mismo tamano y mismo sitio en las cinco webs del grupo (46px,
   abajo a la derecha), pero el color sale de variables CSS que cada
   web ya tiene definidas con su propia identidad: usa --nsd-arriba-bg
   si existe, si no cae en --brand-700 (colegio/infantil/campamento) y
   si tampoco existe usa un valor por defecto. Para cambiar el color
   en una web con otra paleta (Dolores Dragons, Dragons Den), basta con
   definir --nsd-arriba-bg y --nsd-arriba-fg en su propio CSS: no hace
   falta tocar este archivo.

   Se crea el propio boton y su propio <style> por JS: ninguna pagina
   tiene que llevar el marcado a mano, solo cargar este script una vez.
   ========================================================= */
(function () {
  'use strict';
  if (document.querySelector('.volver-arriba')) return;

  var estilo = document.createElement('style');
  estilo.textContent = [
    '.volver-arriba{position:fixed;right:20px;bottom:20px;z-index:70;',
    'width:46px;height:46px;border-radius:50%;',
    'border:1px solid var(--nsd-arriba-borde, var(--border, rgba(0,0,0,.14)));',
    'display:grid;place-items:center;cursor:pointer;padding:0;',
    'background:var(--nsd-arriba-bg, var(--brand-700, #163524));',
    'color:var(--nsd-arriba-fg, #fff);',
    'box-shadow:0 6px 16px -4px rgba(0,0,0,.32);',
    'opacity:0;transform:translateY(10px);pointer-events:none;',
    'transition:opacity .25s ease,transform .25s ease,background-color .2s ease;}',
    '.volver-arriba.is-visible{opacity:1;transform:none;pointer-events:auto;}',
    '.volver-arriba:hover,.volver-arriba:focus-visible{background:var(--nsd-arriba-bg-hover, var(--brand-800, #0b2417));}',
    '.volver-arriba:focus-visible{outline:2px solid var(--nsd-arriba-fg, #fff);outline-offset:2px;}',
    '.volver-arriba svg{width:20px;height:20px;}',
    '@media (max-width:640px){.volver-arriba{right:14px;bottom:14px;width:44px;height:44px;}}',
    '@media (prefers-reduced-motion: reduce){.volver-arriba{transition:opacity .15s linear;}}'
  ].join('');
  document.head.appendChild(estilo);

  var boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'volver-arriba';
  boton.setAttribute('aria-label', 'Volver arriba');
  boton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(boton);

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var visible = false;
  function comprobar() {
    var debeVerse = window.scrollY > window.innerHeight * 0.6;
    if (debeVerse !== visible) { visible = debeVerse; boton.classList.toggle('is-visible', visible); }
  }
  document.addEventListener('scroll', comprobar, { passive: true });
  comprobar();

  boton.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
})();
