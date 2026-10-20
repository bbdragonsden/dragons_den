/*
 * Dragons Squad: cartas 3D de embajadores (data/embajadores.json).
 *
 * - Relieve 3D que sigue al puntero, brillo y foil holográfico del color del rango.
 * - Botón (y clic o toque en la carta) para girarla y ver el reverso con sus datos.
 * - Una carta solo se publica con "consentimiento": true (autorización firmada del
 *   tutor). En local (localhost / 127.0.0.1) también se ven las que no lo tienen,
 *   marcadas como BORRADOR, para poder maquetarlas antes de pedir la firma.
 * - Solo se anima transform y opacity. Con movimiento reducido no hay relieve ni flotación.
 *
 * Contenedores que rellena:
 *   #sq-grid        todas las cartas (embajadores.html)
 *   #sq-destacada   la carta de mayor rango (portada)
 * Además aplica el mismo relieve a cualquier elemento con [data-relieve].
 */
(function () {
  'use strict';

  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var QUIETO = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PUNTERO_FINO = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var ICONO_RANGO = {
    bronze: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 15.1 8.3 22 9.3l-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
    silver: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c4.4 0 7-2.7 7-6.6 0-3.2-2-5.6-3.6-7.4-.4 1.9-1.4 3.2-2.7 3.9C13 8 11.6 4.6 9 2c.2 3.3-1.6 5.6-3.1 7.6C4.6 11.4 5 13.4 5 15.4 5 19.3 7.6 22 12 22z"/></svg>',
    gold: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 18 2-11 5 5 3-7 3 7 5-5 2 11z"/><path d="M4 21h16"/></svg>'
  };
  var ICONO_GIRAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Relieve 3D ────────────────────────────────────────────────────────
  // Escribe --rx, --ry (giro), --gx, --gy (posición del brillo) y --brillo en el
  // elemento. El CSS decide qué capa usa cada variable.
  function activarRelieve(el, opciones) {
    if (QUIETO || !PUNTERO_FINO || !el) return;
    var max = (opciones && opciones.max) || 14;
    var marco = null;
    var rect = null;

    function mover(e) {
      if (!rect) rect = el.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width;
      var py = (e.clientY - rect.top) / rect.height;
      px = Math.max(0, Math.min(1, px));
      py = Math.max(0, Math.min(1, py));
      if (marco) cancelAnimationFrame(marco);
      marco = requestAnimationFrame(function () {
        var girada = el.classList.contains('is-girada') ? -1 : 1;
        el.style.setProperty('--rx', ((0.5 - py) * max).toFixed(2) + 'deg');
        el.style.setProperty('--ry', ((px - 0.5) * max * 1.25 * girada).toFixed(2) + 'deg');
        el.style.setProperty('--gx', ((px - 0.5) * 70).toFixed(1) + '%');
        el.style.setProperty('--gy', ((py - 0.5) * 70).toFixed(1) + '%');
      });
    }
    el.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      rect = el.getBoundingClientRect();
      el.classList.add('is-siguiendo');
      el.style.setProperty('--brillo', '1');
    });
    el.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') mover(e); });
    el.addEventListener('pointerleave', function () {
      if (marco) cancelAnimationFrame(marco);
      el.classList.remove('is-siguiendo');
      ['--rx', '--ry', '--gx', '--gy'].forEach(function (v) { el.style.removeProperty(v); });
      el.style.setProperty('--brillo', '0');
      rect = null;
    });
    window.addEventListener('scroll', function () { rect = null; }, { passive: true });
    window.addEventListener('resize', function () { rect = null; });
  }

  // ── Carta ─────────────────────────────────────────────────────────────
  function carta(e, rango, borrador) {
    var badge = rango.nivel_badge;
    var companeros = e.referidos === 1 ? 'compañero' : 'compañeros';
    var nombre = e.nombre || '';
    // Con "fondo" y "sale" la carta va en dos capas: el póster sin la jugadora
    // dentro del marco y la jugadora recortada por delante, saliendo de la carta.
    var capas = !!(e.fondo && e.sale);
    var sale = capas
      ? '<picture class="sq-sale">' +
          '<source type="image/webp" srcset="' + esc(e.sale) + ' 800w' + (e.sale_mini ? ', ' + esc(e.sale_mini) + ' 480w' : '') + '" sizes="(max-width: 560px) 90vw, 420px">' +
          '<img src="' + esc(e.sale_png || e.sale) + '" alt="' + esc(e.alt || ('Carta de ' + nombre)) + '" width="800" height="1131" loading="lazy" decoding="async">' +
        '</picture>'
      : '';
    var frente = capas
      ? '<picture>' +
          '<source type="image/webp" srcset="' + esc(e.fondo) + ' 800w' + (e.fondo_mini ? ', ' + esc(e.fondo_mini) + ' 480w' : '') + '" sizes="(max-width: 560px) 90vw, 420px">' +
          '<img class="sq-foto" src="' + esc(e.fondo_jpg || e.fondo) + '" alt="" width="800" height="1131" loading="lazy" decoding="async">' +
        '</picture>'
      : e.imagen
      ? '<picture>' +
          '<source type="image/webp" srcset="' + esc(e.imagen) + ' 800w' + (e.imagen_mini ? ', ' + esc(e.imagen_mini) + ' 480w' : '') + '" sizes="(max-width: 560px) 90vw, 420px">' +
          '<img class="sq-foto" src="' + esc(e.imagen_jpg || e.imagen) + '" alt="' + esc(e.alt || ('Carta de ' + nombre)) + '" width="800" height="1131" loading="lazy" decoding="async">' +
        '</picture>'
      : '<span class="sq-sin-foto" aria-hidden="true">' + esc(nombre.charAt(0)) + '</span>';

    var art = document.createElement('article');
    art.className = 'sq-card';
    art.setAttribute('data-badge', badge);
    art.setAttribute('aria-label', 'Carta de ' + nombre + ', ' + rango.nombre);
    art.innerHTML =
      '<div class="sq-flotar"><div class="sq-tilt">' +
        '<span class="sq-aura" aria-hidden="true"></span>' +
        '<div class="sq-inner">' +
          '<div class="sq-cara sq-frente">' +
            '<div class="sq-recorte">' + frente + '<span class="sq-foil" aria-hidden="true"></span><span class="sq-brillo" aria-hidden="true"></span></div>' +
            '<span class="sq-marco" aria-hidden="true"></span>' +
            sale +
            '<span class="sq-sello">' + (ICONO_RANGO[badge] || '') + esc(rango.nombre) + '</span>' +
            (e.founder ? '<span class="sq-founder">Founder</span>' : '') +
            (borrador ? '<span class="sq-borrador">Borrador: falta autorización</span>' : '') +
          '</div>' +
          '<div class="sq-cara sq-dorso" aria-hidden="true">' +
            (e.dorsal != null ? '<span class="sq-dorso-dorsal" aria-hidden="true">' + esc(e.dorsal) + '</span>' : '') +
            '<p class="sq-dorso-rango">' + (ICONO_RANGO[badge] || '') + esc(rango.nombre) + '</p>' +
            '<p class="sq-dorso-nombre">' + esc(nombre) + '</p>' +
            (e.frase ? '<p class="sq-dorso-txt">' + esc(e.frase) + '</p>' : '') +
            '<dl class="sq-datos">' +
              '<div><dt>En pista gracias a ' + (e.referidos === 1 ? 'su invitación' : 'sus invitaciones') + '</dt><dd><b>+' + esc(e.referidos) + '</b> ' + companeros + '</dd></div>' +
              (e.recompensa ? '<div><dt>Recompensa</dt><dd>' + esc(e.recompensa) + '</dd></div>' : '') +
              (e.club_actual ? '<div><dt>Compite en</dt><dd>' + esc(e.club_actual) + '</dd></div>' : '') +
              (e.founder ? '<div><dt>Estatus</dt><dd>Founder 26/27</dd></div>' : '') +
            '</dl>' +
          '</div>' +
        '</div>' +
      '</div></div>' +
      '<button type="button" class="sq-girar" aria-pressed="false" aria-label="Girar la carta de ' + esc(nombre) + '">' + ICONO_GIRAR + '</button>' +
      '<div class="sq-pie"><b>' + esc(nombre) + (e.dorsal != null ? ' &middot; ' + esc(e.dorsal) : '') + '</b><span>' + esc(rango.nombre) + ' &middot; +' + esc(e.referidos) + ' ' + companeros + ' en pista</span></div>';

    var boton = art.querySelector('.sq-girar');
    var dorso = art.querySelector('.sq-dorso');
    function girar() {
      var girada = art.classList.toggle('is-girada');
      boton.setAttribute('aria-pressed', girada ? 'true' : 'false');
      dorso.setAttribute('aria-hidden', girada ? 'false' : 'true');
    }
    boton.addEventListener('click', function (ev) { ev.stopPropagation(); girar(); });
    art.querySelector('.sq-tilt').addEventListener('click', girar);

    // Si la foto no carga, se queda la inicial en vez de un hueco roto.
    var img = art.querySelector('.sq-recorte img');
    var recortada = art.querySelector('.sq-sale');
    if (recortada) recortada.querySelector('img').addEventListener('error', function () { recortada.remove(); }, { once: true });
    if (img) img.addEventListener('error', function () {
      var span = document.createElement('span');
      span.className = 'sq-sin-foto';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = nombre.charAt(0);
      (img.closest('picture') || img).replaceWith(span);
    }, { once: true });

    activarRelieve(art);
    return art;
  }

  function vacia(texto) {
    var d = document.createElement('div');
    d.className = 'sq-vacia';
    d.innerHTML = '<div><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
      '<b>Tu carta aquí</b><p>' + esc(texto) + '</p></div>';
    return d;
  }

  function pintar(datos) {
    var rangos = {};
    (datos.rangos || []).forEach(function (r) { rangos[r.id] = r; });

    var lista = (datos.embajadores || []).filter(function (e) {
      return rangos[e.rango] && (e.consentimiento === true || LOCAL);
    }).sort(function (a, b) {
      return (rangos[b.rango].orden - rangos[a.rango].orden) || (b.referidos - a.referidos);
    });

    var grid = document.getElementById('sq-grid');
    if (grid) {
      grid.textContent = '';
      if (lista.length) {
        lista.forEach(function (e) { grid.appendChild(carta(e, rangos[e.rango], e.consentimiento !== true)); });
      } else {
        grid.appendChild(vacia('Las primeras cartas aparecerán aquí en cuanto sus familias autoricen la publicación.'));
      }
      grid.hidden = false;
    }

    var destacada = document.getElementById('sq-destacada');
    if (destacada) {
      destacada.textContent = '';
      destacada.appendChild(lista.length
        ? carta(lista[0], rangos[lista[0].rango], lista[0].consentimiento !== true)
        : vacia('Trae a tus compañeros, sube de rango y consigue tu carta en el Dragons Squad.'));
    }
  }

  function iniciar() {
    document.querySelectorAll('[data-relieve]').forEach(function (el) { activarRelieve(el, { max: 10 }); });
    if (!document.getElementById('sq-grid') && !document.getElementById('sq-destacada')) return;
    fetch('/data/embajadores.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(pintar)
      .catch(function (err) {
        if (window.console) console.warn('[squad]', err);
        pintar({ rangos: [], embajadores: [] });
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
