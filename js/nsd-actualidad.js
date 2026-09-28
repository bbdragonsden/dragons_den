/* =========================================================
   Actualidad del colegio en cualquiera de las webs del grupo.
   ---------------------------------------------------------
   Pinta las últimas noticias dentro de [data-actualidad-nsd] como un
   carrusel: tarjetas que se deslizan y cada una abre su ficha completa
   en una ventana modal, igual que la sección de noticias de Dolores
   Dragons. Las noticias están en nsd-noticias.js, que es el mismo
   archivo en las cinco webs: se escriben una vez y salen en todas.

   Atributos del contenedor:
     data-actualidad-nsd   Cuántas enseña (por defecto 3).
     data-base             Dominio del colegio, para que los
                           enlaces y las imágenes del blog
                           funcionen desde la escuela infantil y
                           el campamento. En el colegio se deja
                           vacío.
     data-web              Qué web es esta ('infantil',
                           'campamento'…). Solo salen las
                           noticias marcadas para ella. Sin este
                           atributo salen todas, que es lo que
                           hace la web del colegio.

   LA REGLA (no tocar): sin data-web salen todas las noticias de
   las cinco webs. Con data-web, solo las que tengan esa clave en
   su campo 'webs'. Esto no cambia con el rediseño: solo cambia
   cómo se ven y se abren las tarjetas.
   ========================================================= */
(function () {
  'use strict';

  const caja = document.querySelector('[data-actualidad-nsd]');
  if (!caja || !window.NSD_NOTICIAS) return;

  const cuantas = Number(caja.dataset.actualidadNsd) || 3;
  const base = caja.dataset.base || '';
  const web = caja.dataset.web || '';
  const reduceMotion = (window.NSDSpring && window.NSDSpring.reduceMotion)
    ? window.NSDSpring.reduceMotion
    : () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Un enlace del blog es relativo: desde otra web necesita el dominio.
  const enlace = (u) => (!u ? '' : (/^https?:/.test(u) ? u : base + u));

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function fechaLarga(f) {
    const p = String(f).split('-');
    if (p.length !== 3) return f;
    return Number(p[2]) + ' de ' + MESES[Number(p[1]) - 1] + ' de ' + p[0];
  }

  // Sin data-web salen todas (la del colegio); con el, solo las suyas.
  const suyas = web
    ? window.NSD_NOTICIAS.filter((n) => (n.webs || ['colegio']).indexOf(web) >= 0)
    : window.NSD_NOTICIAS.slice();

  const lista = suyas
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .slice(0, cuantas);

  if (!lista.length) return;

  function portadaDe(n, clase) {
    const conBase = base && n.imagen && !/^https?:/.test(n.imagen)
      ? Object.assign({}, n, { imagen: base + n.imagen })
      : n;
    return typeof window.NSD_PORTADA === 'function'
      ? window.NSD_PORTADA(conBase, clase || 'act-nsd__portada')
      : '';
  }

  function categoriaDe(n) {
    return (window.NSD_CATEGORIAS || {})[n.categoria] || { nombre: 'Colegio', icono: 'bi-newspaper' };
  }

  function chip(n) {
    const cat = categoriaDe(n);
    return `<span class="act-nsd__cat"><i class="bi ${esc(cat.icono)}" aria-hidden="true"></i> ${esc(cat.nombre)}</span>${n.documento ? `<span class="act-nsd__doc"><i class="bi bi-paperclip" aria-hidden="true"></i> PDF</span>` : ''}`;
  }

  // ── El carrusel ──────────────────────────────────────────────────────
  const tarjetas = lista.map((n, i) => `
    <li class="act-nsd__item" data-reveal data-reveal-delay="${Math.min(i + 1, 4)}">
      <button type="button" class="act-nsd__enlace" data-idx="${i}">
        ${portadaDe(n)}
        <span class="act-nsd__txt">
          ${chip(n)}
          <strong class="act-nsd__titulo">${esc(n.titulo)}</strong>
          <span class="act-nsd__resumen">${esc(n.resumen)}</span>
          <span class="act-nsd__pie">
            <time class="act-nsd__fecha" datetime="${esc(n.fecha)}">${esc(fechaLarga(n.fecha))}</time>
            <span class="act-nsd__leer">Leer <i class="bi bi-arrow-right" aria-hidden="true"></i></span>
          </span>
        </span>
      </button>
    </li>`).join('');

  const conNav = lista.length > 1;
  caja.removeAttribute('hidden');
  caja.innerHTML = `
    <div class="act-nsd">
      ${conNav ? `
      <div class="act-nsd__nav">
        <button type="button" class="act-nsd__flecha act-nsd__flecha--prev" aria-label="Noticia anterior"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
        <button type="button" class="act-nsd__flecha act-nsd__flecha--next" aria-label="Noticia siguiente"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
      </div>` : ''}
      <ul class="act-nsd__pista">${tarjetas}</ul>
      ${conNav ? `<div class="act-nsd__puntos" role="tablist" aria-label="Ir a una noticia">
        ${lista.map((_, i) => `<button type="button" class="act-nsd__punto" data-idx="${i}" aria-current="${i === 0}" aria-label="Ir a la noticia ${i + 1}"></button>`).join('')}
      </div>` : ''}
    </div>`;

  const pista = caja.querySelector('.act-nsd__pista');
  const tarjetasEl = Array.from(caja.querySelectorAll('.act-nsd__item'));
  const flechaPrev = caja.querySelector('.act-nsd__flecha--prev');
  const flechaNext = caja.querySelector('.act-nsd__flecha--next');
  const puntos = Array.from(caja.querySelectorAll('.act-nsd__punto'));

  function irA(i) {
    const tarjeta = tarjetasEl[Math.max(0, Math.min(i, tarjetasEl.length - 1))];
    if (!tarjeta || !pista) return;
    pista.scrollTo({ left: tarjeta.offsetLeft - pista.offsetLeft, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  function actualizarNav() {
    if (!pista) return;
    const indice = tarjetasEl.findIndex((el) => el.offsetLeft - pista.offsetLeft >= pista.scrollLeft - 20);
    const actual = indice < 0 ? 0 : indice;
    puntos.forEach((p, i) => p.setAttribute('aria-current', String(i === actual)));
    if (flechaPrev) flechaPrev.disabled = pista.scrollLeft <= 4;
    if (flechaNext) flechaNext.disabled = pista.scrollLeft >= pista.scrollWidth - pista.clientWidth - 4;
  }

  if (conNav) {
    flechaPrev.addEventListener('click', () => {
      const actual = puntos.findIndex((p) => p.getAttribute('aria-current') === 'true');
      irA(actual - 1);
    });
    flechaNext.addEventListener('click', () => {
      const actual = puntos.findIndex((p) => p.getAttribute('aria-current') === 'true');
      irA(actual + 1);
    });
    puntos.forEach((p) => p.addEventListener('click', () => irA(Number(p.dataset.idx))));
    pista.addEventListener('scroll', () => { window.requestAnimationFrame(actualizarNav); }, { passive: true });
    actualizarNav();
  }

  // ── La ficha, en ventana modal ──────────────────────────────────────
  let modal = null;
  let disparador = null;

  function construirModal() {
    modal = document.createElement('div');
    modal.className = 'act-nsd-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="act-nsd-modal__fondo" data-cerrar></div>
      <div class="act-nsd-modal__caja" role="dialog" aria-modal="true" aria-labelledby="act-nsd-modal-titulo">
        <button type="button" class="act-nsd-modal__cerrar" data-cerrar aria-label="Cerrar la noticia"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        <div data-modal-portada></div>
        <div class="act-nsd-modal__cuerpo">
          <span data-modal-chip></span>
          <h3 id="act-nsd-modal-titulo" data-modal-titulo></h3>
          <p data-modal-resumen></p>
          <div class="act-nsd-modal__pie">
            <time data-modal-fecha></time>
            <a class="btn btn--gold" data-modal-enlace target="_blank" rel="noopener noreferrer">Leer la noticia completa <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrarModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) cerrarModal(); });
  }

  function abrirModal(n) {
    if (!modal) construirModal();
    modal.querySelector('[data-modal-portada]').innerHTML = portadaDe(n, 'act-nsd-modal__portada');
    modal.querySelector('[data-modal-chip]').innerHTML = chip(n);
    modal.querySelector('[data-modal-titulo]').textContent = n.titulo;
    modal.querySelector('[data-modal-resumen]').textContent = n.resumen;
    const t = modal.querySelector('[data-modal-fecha]');
    t.textContent = fechaLarga(n.fecha);
    t.setAttribute('datetime', n.fecha);
    const url = enlace(n.url);
    const boton = modal.querySelector('[data-modal-enlace]');
    boton.href = url || '#';
    boton.hidden = !url;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.act-nsd-modal__cerrar').focus();
  }

  function cerrarModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (disparador) disparador.focus();
  }

  caja.addEventListener('click', (e) => {
    const boton = e.target.closest('.act-nsd__enlace');
    if (!boton) return;
    disparador = boton;
    abrirModal(lista[Number(boton.dataset.idx)]);
  });

  // Aparición al entrar en pantalla. Estas tarjetas se crean después de que
  // la web haya arrancado, así que el observer global de [data-reveal]
  // (nsd-sitio.js, main.js…) ya hizo su barrido y nunca las habría visto:
  // este widget se ocupa siempre de las suyas, sin depender de nadie más.
  const piezas = caja.querySelectorAll('[data-reveal]');
  if (reduceMotion() || !('IntersectionObserver' in window)) {
    piezas.forEach((el) => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    piezas.forEach((el) => io.observe(el));
  }

  // Tacto: en las webs que traen el motor de muelles, las tarjetas
  // responden al dedo/al clic igual que el resto de tarjetas del sitio.
  if (window.NSDSpring && typeof window.NSDSpring.tacto === 'function' && !reduceMotion()) {
    caja.querySelectorAll('.act-nsd__enlace').forEach((el) => {
      window.NSDSpring.tacto(el, { escala: 0.985 });
    });
  }
})();
