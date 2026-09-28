/* =========================================================
   Actualidad del colegio en cualquiera de las webs del grupo.
   ---------------------------------------------------------
   Pinta las últimas noticias dentro de [data-actualidad-nsd].
   Las noticias están en nsd-noticias.js, que es el mismo archivo
   en las tres webs: se escriben una vez y salen en todas.

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
   ========================================================= */
(function () {
  'use strict';

  const caja = document.querySelector('[data-actualidad-nsd]');
  if (!caja || !window.NSD_NOTICIAS) return;

  const cuantas = Number(caja.dataset.actualidadNsd) || 3;
  const base = caja.dataset.base || '';
  const web = caja.dataset.web || '';

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

  caja.innerHTML = '<ul class="act-nsd">' + lista.map((n) => {
    const cat = (window.NSD_CATEGORIAS || {})[n.categoria] || { nombre: 'Colegio', icono: 'bi-newspaper' };
    const url = enlace(n.url);
    // La imagen esta en la web del colegio: se le pone el mismo prefijo
    const conBase = base && n.imagen && !/^https?:/.test(n.imagen)
      ? Object.assign({}, n, { imagen: base + n.imagen })
      : n;
    const portada = typeof window.NSD_PORTADA === 'function'
      ? window.NSD_PORTADA(conBase, 'act-nsd__portada')
      : '';
    const cuerpo = `
      <span class="act-nsd__cat"><i class="bi ${esc(cat.icono)}" aria-hidden="true"></i> ${esc(cat.nombre)}</span>${n.documento ? `<span class="act-nsd__doc"><i class="bi bi-paperclip" aria-hidden="true"></i> PDF</span>` : ''}
      <strong class="act-nsd__titulo">${esc(n.titulo)}</strong>
      <span class="act-nsd__resumen">${esc(n.resumen)}</span>
      <time class="act-nsd__fecha" datetime="${esc(n.fecha)}">${esc(fechaLarga(n.fecha))}</time>`;
    // Sin página propia no se inventa un enlace roto: se queda en tarjeta.
    return url
      ? `<li class="act-nsd__item"><a class="act-nsd__enlace" href="${esc(url)}">${portada}<span class="act-nsd__txt">${cuerpo}</span></a></li>`
      : `<li class="act-nsd__item"><div class="act-nsd__enlace act-nsd__enlace--plano">${portada}<span class="act-nsd__txt">${cuerpo}</span></div></li>`;
  }).join('') + '</ul>';
})();
