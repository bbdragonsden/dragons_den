/* =========================================================
   Actualidad del colegio en cualquiera de las webs del grupo.
   ---------------------------------------------------------
   Pinta las últimas noticias dentro de [data-actualidad-nsd] como un
   carrusel: buscador, filtro por sección y tarjetas que se deslizan,
   cada una abriendo su ficha completa en una ventana modal, igual que
   la sección de noticias de Dolores Dragons y que la portada del
   colegio. Las noticias están en nsd-noticias.js, que es el mismo
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
   su campo 'webs'. Esto no cambia con el buscador ni el filtro:
   solo se busca y se filtra dentro de las que ya tocaban a esta web.
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
  const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

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
  const suyas = (web
    ? window.NSD_NOTICIAS.filter((n) => (n.webs || ['colegio']).indexOf(web) >= 0)
    : window.NSD_NOTICIAS.slice()
  ).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  if (!suyas.length) return;

  const CATS = window.NSD_CATEGORIAS || {};
  const categoriasConNoticias = Object.keys(CATS).filter((k) => suyas.some((n) => n.categoria === k));

  let consulta = '';
  let categoria = 'todas';
  let indice = 0;

  function filtrar() {
    const q = normalizar(consulta).trim();
    const filtradas = suyas.filter((n) => {
      if (categoria !== 'todas' && n.categoria !== categoria) return false;
      if (!q) return true;
      const cat = CATS[n.categoria] || {};
      const texto = normalizar([n.titulo, n.resumen, cat.nombre].join(' '));
      return q.split(/\s+/).every((p) => texto.includes(p));
    });
    return filtradas.slice(0, cuantas);
  }

  function portadaDe(n, clase) {
    const conBase = base && n.imagen && !/^https?:/.test(n.imagen)
      ? Object.assign({}, n, { imagen: base + n.imagen })
      : n;
    return typeof window.NSD_PORTADA === 'function'
      ? window.NSD_PORTADA(conBase, clase || 'act-nsd__portada')
      : '';
  }

  function categoriaDe(n) {
    return CATS[n.categoria] || { nombre: 'Colegio', icono: 'bi-newspaper' };
  }

  function chip(n, esNueva) {
    const cat = categoriaDe(n);
    return `<span class="act-nsd__cat"><i class="bi ${esc(cat.icono)}" aria-hidden="true"></i> ${esc(cat.nombre)}</span>${esNueva ? '<span class="act-nsd__nuevo">Nuevo</span>' : ''}${n.documento ? `<span class="act-nsd__doc"><i class="bi bi-paperclip" aria-hidden="true"></i> PDF</span>` : ''}`;
  }

  // ── El carrusel ──────────────────────────────────────────────────────
  function tarjeta(n, i) {
    // "Nuevo" solo tiene sentido en la primera tarjeta cuando no hay
    // busqueda ni filtro activos: es la mas reciente de verdad, no la
    // primera de un resultado filtrado.
    const esNueva = i === 0 && categoria === 'todas' && !consulta.trim() && n.fecha === suyas[0].fecha;
    return `
    <li class="act-nsd__item" data-reveal data-reveal-delay="${Math.min(i + 1, 4)}">
      <button type="button" class="act-nsd__enlace" data-idx="${i}">
        ${portadaDe(n)}
        <span class="act-nsd__txt">
          ${chip(n, esNueva)}
          <strong class="act-nsd__titulo">${esc(n.titulo)}</strong>
          <span class="act-nsd__resumen">${esc(n.resumen)}</span>
          <span class="act-nsd__pie">
            <time class="act-nsd__fecha" datetime="${esc(n.fecha)}">${esc(fechaLarga(n.fecha))}</time>
            <span class="act-nsd__leer">Leer <i class="bi bi-arrow-right" aria-hidden="true"></i></span>
          </span>
        </span>
      </button>
    </li>`;
  }

  const pista = () => caja.querySelector('.act-nsd__pista');

  function anchoTarjeta() {
    const p = pista();
    const primera = p && p.querySelector('.act-nsd__item');
    if (!primera) return 340;
    const estilo = getComputedStyle(p);
    return primera.getBoundingClientRect().width + parseFloat(estilo.columnGap || estilo.gap || 18);
  }

  function irA(i, lista) {
    const p = pista();
    if (!p) return;
    const max = lista.length - 1;
    indice = Math.max(0, Math.min(i, max));
    p.scrollTo({ left: indice * anchoTarjeta(), behavior: reduceMotion() ? 'auto' : 'smooth' });
    marcarNav(lista);
  }

  function marcarNav(lista) {
    caja.querySelectorAll('.act-nsd__punto').forEach((p, i) => p.setAttribute('aria-current', String(i === indice)));
    const prev = caja.querySelector('.act-nsd__flecha--prev');
    const next = caja.querySelector('.act-nsd__flecha--next');
    if (prev) prev.disabled = indice <= 0;
    if (next) next.disabled = indice >= lista.length - 1;
  }

  function revelar(raiz) {
    const piezas = raiz.querySelectorAll('[data-reveal]');
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      piezas.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    piezas.forEach((el) => io.observe(el));
  }

  let scrollTimer;
  function onScrollPista(lista) {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const p = pista();
      if (!p) return;
      const i = Math.round(p.scrollLeft / anchoTarjeta());
      if (i !== indice) { indice = i; marcarNav(lista); }
    }, 80);
  }

  function pintar() {
    const lista = filtrar();
    indice = 0;
    const conNav = lista.length > 1;

    caja.innerHTML = `
      <div class="act-nsd">
        <div class="act-nsd__toolbar">
          <div class="act-nsd__filtros" role="group" aria-label="Filtrar las noticias por sección">
            <button type="button" class="act-nsd__filtro ${categoria === 'todas' ? 'is-activo' : ''}" data-cat="todas" aria-pressed="${categoria === 'todas'}">Todo <span>${suyas.length}</span></button>
            ${categoriasConNoticias.map((k) => `<button type="button" class="act-nsd__filtro ${categoria === k ? 'is-activo' : ''}" data-cat="${k}" aria-pressed="${categoria === k}"><i class="bi ${CATS[k].icono}" aria-hidden="true"></i>${esc(CATS[k].nombre)}</button>`).join('')}
          </div>
          <div class="act-nsd__derecha">
            <div class="act-nsd__search">
              <i class="bi bi-search" aria-hidden="true"></i>
              <label class="sr-only" for="actNsdBuscar-${web || 'todas'}">Buscar en las noticias</label>
              <input type="search" id="actNsdBuscar-${web || 'todas'}" placeholder="Buscar…" autocomplete="off" enterkeyhint="search" value="${esc(consulta)}">
            </div>
            ${conNav ? `<div class="act-nsd__nav">
              <button type="button" class="act-nsd__flecha act-nsd__flecha--prev" aria-label="Noticia anterior"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
              <button type="button" class="act-nsd__flecha act-nsd__flecha--next" aria-label="Noticia siguiente"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
            </div>` : ''}
          </div>
        </div>
        ${lista.length
          ? `<ul class="act-nsd__pista">${lista.map(tarjeta).join('')}</ul>`
          : '<p class="act-nsd__vacio">No hay noticias en esta sección todavía.</p>'}
        ${conNav ? `<div class="act-nsd__puntos" role="tablist" aria-label="Ir a una noticia">
          ${lista.map((_, i) => `<button type="button" class="act-nsd__punto" data-idx="${i}" aria-current="${i === 0}" aria-label="Ir a la noticia ${i + 1}"></button>`).join('')}
        </div>` : ''}
      </div>`;

    revelar(caja);
    marcarNav(lista);

    const p = pista();
    if (p) p.addEventListener('scroll', () => onScrollPista(lista), { passive: true });

    caja.querySelector('.act-nsd__filtros').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      categoria = b.dataset.cat;
      pintar();
    });
    caja.querySelector('.act-nsd__search input').addEventListener('input', (e) => {
      consulta = e.target.value;
      pintar();
    });
    const prevBtn = caja.querySelector('.act-nsd__flecha--prev');
    const nextBtn = caja.querySelector('.act-nsd__flecha--next');
    if (prevBtn) prevBtn.addEventListener('click', () => irA(indice - 1, lista));
    if (nextBtn) nextBtn.addEventListener('click', () => irA(indice + 1, lista));
    caja.querySelectorAll('.act-nsd__punto').forEach((b, i) => b.addEventListener('click', () => irA(i, lista)));

    if (window.NSDSpring && typeof window.NSDSpring.tacto === 'function' && !reduceMotion()) {
      caja.querySelectorAll('.act-nsd__enlace').forEach((el) => {
        window.NSDSpring.tacto(el, { escala: 0.985 });
      });
    }
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
    modal.querySelector('[data-modal-chip]').innerHTML = chip(n, false);
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
    abrirModal(filtrar()[Number(boton.dataset.idx)]);
  });

  caja.removeAttribute('hidden');
  pintar();
})();
