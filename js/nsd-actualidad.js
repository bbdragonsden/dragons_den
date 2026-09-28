/* =========================================================
   Actualidad del colegio en cualquiera de las webs del grupo.
   ---------------------------------------------------------
   Pinta las últimas noticias dentro de [data-actualidad-nsd].
   Las noticias están en nsd-noticias.js, que es el mismo archivo
   en las cinco webs: se escriben una vez y salen en todas.

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
   cómo se ven las tarjetas.
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

  function portadaDe(n) {
    const conBase = base && n.imagen && !/^https?:/.test(n.imagen)
      ? Object.assign({}, n, { imagen: base + n.imagen })
      : n;
    return typeof window.NSD_PORTADA === 'function'
      ? window.NSD_PORTADA(conBase, 'act-nsd__portada')
      : '';
  }

  function chips(n, cat) {
    return `<span class="act-nsd__cat"><i class="bi ${esc(cat.icono)}" aria-hidden="true"></i> ${esc(cat.nombre)}</span>${n.documento ? `<span class="act-nsd__doc"><i class="bi bi-paperclip" aria-hidden="true"></i> PDF</span>` : ''}`;
  }

  // La primera (la más reciente) se pinta más grande, como portada de la
  // sección; el resto sigue en formato de tarjeta compacta. Igual que hace
  // la web del colegio con su propio blog, pero en una escala más pequeña.
  const [destacada, ...resto] = lista;
  const catDestacada = (window.NSD_CATEGORIAS || {})[destacada.categoria] || { nombre: 'Colegio', icono: 'bi-newspaper' };
  const urlDestacada = enlace(destacada.url);

  const tarjetaDestacada = `
    <li class="act-nsd__item act-nsd__item--destacada" data-reveal>
      ${urlDestacada
        ? `<a class="act-nsd__enlace act-nsd__enlace--destacada" href="${esc(urlDestacada)}">`
        : `<div class="act-nsd__enlace act-nsd__enlace--destacada act-nsd__enlace--plano">`}
        ${portadaDe(destacada)}
        <span class="act-nsd__txt">
          ${chips(destacada, catDestacada)}
          <strong class="act-nsd__titulo">${esc(destacada.titulo)}</strong>
          <span class="act-nsd__resumen">${esc(destacada.resumen)}</span>
          <span class="act-nsd__pie">
            <time class="act-nsd__fecha" datetime="${esc(destacada.fecha)}">${esc(fechaLarga(destacada.fecha))}</time>
            ${urlDestacada ? '<span class="act-nsd__leer">Leer <i class="bi bi-arrow-right" aria-hidden="true"></i></span>' : ''}
          </span>
        </span>
      ${urlDestacada ? '</a>' : '</div>'}
    </li>`;

  const tarjetasResto = resto.map((n, i) => {
    const cat = (window.NSD_CATEGORIAS || {})[n.categoria] || { nombre: 'Colegio', icono: 'bi-newspaper' };
    const url = enlace(n.url);
    const delay = Math.min(i + 1, 4);
    const cuerpo = `
      ${chips(n, cat)}
      <strong class="act-nsd__titulo">${esc(n.titulo)}</strong>
      <span class="act-nsd__resumen">${esc(n.resumen)}</span>
      <time class="act-nsd__fecha" datetime="${esc(n.fecha)}">${esc(fechaLarga(n.fecha))}</time>`;
    return url
      ? `<li class="act-nsd__item" data-reveal data-reveal-delay="${delay}"><a class="act-nsd__enlace" href="${esc(url)}">${portadaDe(n)}<span class="act-nsd__txt">${cuerpo}</span></a></li>`
      : `<li class="act-nsd__item" data-reveal data-reveal-delay="${delay}"><div class="act-nsd__enlace act-nsd__enlace--plano">${portadaDe(n)}<span class="act-nsd__txt">${cuerpo}</span></div></li>`;
  }).join('');

  // Si el contenedor empezaba oculto (por ejemplo con `hidden`, a la
  // espera de tener algo que mostrar) se descubre ahora que ya hay noticias.
  caja.removeAttribute('hidden');
  caja.innerHTML = `<ul class="act-nsd">${tarjetaDestacada}${tarjetasResto}</ul>`;

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
