/*
 * Oferta de temporada: lee data/planes.json, data/embajadores.json y
 * data/roster-metrics.json y rellena la portada.
 *
 * El HTML ya trae el contenido completo (SEO y por si falla la red); este
 * script lo sustituye por lo que diga el JSON, así que cambiar un precio es
 * cambiarlo en data/planes.json. `node data/validar.js` avisa si el HTML se
 * ha quedado desfasado respecto al JSON.
 *
 * Ganchos en el HTML (rutas relativas a servicios_presenciales; un tramo que
 * cae en una lista se busca por id):
 *   data-dd="tiers.hibrido.precio_mes"      -> texto
 *   data-dd-list="tiers.hibrido.incluye"    -> <li> de la lista
 *   data-dd-wa="tiers.hibrido.whatsapp_texto" -> href de WhatsApp
 */
(function () {
  'use strict';

  var ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var ICON_USERS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  var ICON_GIFT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';
  var ICON_RANGO = {
    bronze: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 15.1 8.3 22 9.3l-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
    silver: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c4.4 0 7-2.7 7-6.6 0-3.2-2-5.6-3.6-7.4-.4 1.9-1.4 3.2-2.7 3.9C13 8 11.6 4.6 9 2c.2 3.3-1.6 5.6-3.1 7.6C4.6 11.4 5 13.4 5 15.4 5 19.3 7.6 22 12 22z"/></svg>',
    gold: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 18 2-11 5 5 3-7 3 7 5-5 2 11z"/><path d="M4 21h16"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cargar(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  // Recorre "a.b.c"; si un tramo cae en un array, busca el elemento por id.
  function leer(raiz, ruta) {
    return ruta.split('.').reduce(function (o, k) {
      if (o == null) return undefined;
      if (Array.isArray(o)) {
        for (var i = 0; i < o.length; i++) if (o[i] && o[i].id === k) return o[i];
        return o[+k];
      }
      return o[k];
    }, raiz);
  }

  function enlaceWa(numero, texto) {
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto);
  }

  // ── Precios ──────────────────────────────────────────────────────────
  function pintarPrecios(planes) {
    var sp = planes.servicios_presenciales;
    if (!sp) return;
    window.DD_PLANES = planes; // el formulario de inscripción lee de aquí los precios del mensaje

    document.querySelectorAll('[data-dd]').forEach(function (el) {
      var v = leer(sp, el.getAttribute('data-dd'));
      if (v !== undefined && v !== null && typeof v !== 'object') el.textContent = v;
    });

    document.querySelectorAll('[data-dd-list]').forEach(function (ul) {
      var lista = leer(sp, ul.getAttribute('data-dd-list'));
      if (!Array.isArray(lista)) return;
      ul.innerHTML = lista.map(function (t) {
        return '<li>' + ICON_CHECK + '<span>' + esc(t) + '</span></li>';
      }).join('');
    });

    document.querySelectorAll('[data-dd-wa]').forEach(function (a) {
      var texto = leer(sp, a.getAttribute('data-dd-wa'));
      if (typeof texto === 'string') a.setAttribute('data-wa-base', texto);
    });
    if (sp.exalumno && sp.exalumno.whatsapp_sufijo) SUFIJO_EX = sp.exalumno.whatsapp_sufijo;
    NUMERO_WA = sp.whatsapp || NUMERO_WA;
    actualizarWa();
  }

  // ── Modo ex-alumno ───────────────────────────────────────────────────
  // Un interruptor cambia todos los precios de la página. Se recuerda en el
  // navegador y se puede forzar con ?exalumno=1 (o 0) para mandar el enlace
  // por WhatsApp a una familia que ya entrenó con nosotros.
  var CLAVE = 'dd-modo-precio';
  var SUFIJO_EX = ' Soy ex-alumno/a de Dragons Den.';
  var NUMERO_WA = '34646794962';
  var modo = 'std';

  function leerModoInicial() {
    try {
      var q = new URLSearchParams(location.search).get('exalumno');
      if (q === '1') return 'ex';
      if (q === '0') return 'std';
    } catch (e) { /* sin URLSearchParams */ }
    try { return localStorage.getItem(CLAVE) === 'ex' ? 'ex' : 'std'; } catch (e) { return 'std'; }
  }

  function actualizarWa() {
    document.querySelectorAll('[data-dd-wa]').forEach(function (a) {
      var base = a.getAttribute('data-wa-base');
      if (base == null) {
        try { base = new URL(a.href).searchParams.get('text') || ''; } catch (e) { base = ''; }
        a.setAttribute('data-wa-base', base);
      }
      if (!base) return;
      a.href = enlaceWa(NUMERO_WA, modo === 'ex' ? base + SUFIJO_EX : base);
    });
  }

  function aplicarModo(nuevo, animar) {
    modo = nuevo === 'ex' ? 'ex' : 'std';
    var raiz = document.documentElement;
    raiz.classList.toggle('dd-modo-ex', modo === 'ex');
    document.querySelectorAll('.dd-modo-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-modo') === modo ? 'true' : 'false');
    });
    try { localStorage.setItem(CLAVE, modo); } catch (e) { /* almacenamiento bloqueado */ }
    actualizarWa();

    // El formulario de inscripción ya sabe que ha entrenado antes con nosotros.
    var tipo = document.getElementById('tipo');
    if (tipo && modo === 'ex' && !tipo.value) tipo.value = 'anterior';

    if (animar && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      document.querySelectorAll('.dd-cifra, .dd-carta-precio, .dd-matricula-precio').forEach(function (el) {
        el.classList.remove('dd-cambio');
        void el.offsetWidth;
        el.classList.add('dd-cambio');
      });
    }
  }

  function iniciarModo() {
    var botones = document.querySelectorAll('.dd-modo-btn');
    if (!botones.length) return;
    botones.forEach(function (b) {
      b.addEventListener('click', function () { aplicarModo(b.getAttribute('data-modo'), true); });
    });
    document.documentElement.classList.add('dd-modo-listo');
    aplicarModo(leerModoInicial(), false);
  }

  // ── Embajadores ──────────────────────────────────────────────────────
  function pintarEmbajadores(datos) {
    var grid = document.getElementById('dd-squad-grid');
    var vacio = document.getElementById('dd-squad-sin-publicar');
    if (!grid || !datos) return;

    var rangos = {};
    (datos.rangos || []).forEach(function (r) { rangos[r.id] = r; });

    // Solo con autorización firmada del tutor. Sin ella, la tarjeta no existe.
    var visibles = (datos.embajadores || []).filter(function (e) {
      return e.consentimiento === true && rangos[e.rango];
    }).sort(function (a, b) {
      return (rangos[b.rango].orden - rangos[a.rango].orden) || (b.referidos - a.referidos);
    });

    if (!visibles.length) { grid.hidden = true; if (vacio) vacio.hidden = false; return; }

    grid.innerHTML = visibles.map(function (e) {
      var r = rangos[e.rango];
      var inicial = esc((e.nombre || '?').trim().charAt(0));
      var foto = e.imagen
        ? '<img src="' + esc(e.imagen) + '" alt="' + esc(e.nombre) + ', embajador ' + esc(r.nombre) + ' de Dragons Den" loading="lazy" decoding="async" width="400" height="500">'
        : '<span class="dd-amb-sin-foto" aria-hidden="true">' + inicial + '</span>';
      var companeros = e.referidos === 1 ? 'compañero' : 'compañeros';
      return '<article class="dd-amb" data-badge="' + esc(r.nivel_badge) + '">' +
        '<div class="dd-amb-foto">' + foto +
          '<span class="dd-rango">' + (ICON_RANGO[r.nivel_badge] || '') + esc(r.nombre) + '</span>' +
          (e.founder === true ? '<span class="dd-founder-chip" title="De los primeros en confiar en Dragons Den">Founder</span>' : '') +
        '</div>' +
        '<div class="dd-amb-cuerpo">' +
          '<h3 class="dd-amb-nombre">' + esc(e.nombre) + '</h3>' +
          '<p class="dd-amb-club">Compite con ' + esc(e.club_actual) + '</p>' +
          '<div class="dd-amb-datos">' +
            '<p class="dd-amb-dato">' + ICON_USERS + '<span>+' + esc(e.referidos) + ' ' + companeros + ' en pista</span></p>' +
            (e.recompensa ? '<p class="dd-amb-dato">' + ICON_GIFT + '<span>' + esc(e.recompensa) + '</span></p>' : '') +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    // Si una foto falla, se queda la inicial en vez de un hueco roto.
    grid.querySelectorAll('img').forEach(function (img) {
      img.addEventListener('error', function () {
        var span = document.createElement('span');
        span.className = 'dd-amb-sin-foto';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = (img.alt || '?').charAt(0);
        img.replaceWith(span);
      }, { once: true });
    });

    grid.hidden = false;
    if (vacio) vacio.hidden = true;
  }

  // ── Ficha de jugador (demo) ──────────────────────────────────────────
  function pintarFicha(datos) {
    var ficha = document.getElementById('dd-ficha');
    if (!ficha || !datos || !datos.demo) return;
    var d = datos.demo, max = datos.escala_max || 10;

    var set = function (sel, val) { var el = ficha.querySelector(sel); if (el && val) el.textContent = val; };
    set('[data-rm="jugador"]', d.jugador);
    set('[data-rm="meta"]', [d.categoria, d.posicion, d.plan].filter(Boolean).join(' · '));
    set('[data-rm="actualizado"]', 'Actualizada: ' + d.actualizado);
    set('[data-rm="hito"]', d.siguiente_hito);
    set('[data-rm="obs"]', d.observaciones);
    var chip = ficha.querySelector('[data-rm-founder]');
    if (chip) chip.hidden = d.founder !== true;

    var ul = ficha.querySelector('.dd-metricas');
    if (ul && Array.isArray(d.metricas)) {
      ul.innerHTML = d.metricas.map(function (m) {
        var v = Math.max(0, Math.min(max, +m.valor || 0));
        return '<li><div class="dd-metrica-cab"><span>' + esc(m.nombre) + '</span>' +
          '<b>' + v + '<small>/' + max + '</small></b></div>' +
          '<div class="dd-barra" role="meter" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + v + '" aria-label="' + esc(m.nombre) + '">' +
          '<i style="--v:' + (v / max) + '"></i></div></li>';
      }).join('');
    }
  }

  // Las barras se llenan una vez, al entrar en pantalla.
  function animarFicha() {
    var ficha = document.getElementById('dd-ficha');
    if (!ficha) return;
    var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto || !('IntersectionObserver' in window)) return;
    ficha.classList.add('is-pendiente');
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        requestAnimationFrame(function () { ficha.classList.remove('is-pendiente'); });
        io.disconnect();
      });
    }, { threshold: 0.35 });
    io.observe(ficha);
  }

  function aviso(e) { if (window.console) console.warn('[dd-oferta]', e.message || e); }

  function iniciar() {
    iniciarModo();
    animarFicha();
    cargar('/data/planes.json').then(pintarPrecios).catch(aviso);
    // Las cartas del Dragons Squad las pinta js/squad.js; esto solo queda para
    // páginas antiguas que aún tengan la rejilla #dd-squad-grid.
    if (document.getElementById('dd-squad-grid')) cargar('/data/embajadores.json').then(pintarEmbajadores).catch(aviso);
    cargar('/data/roster-metrics.json').then(pintarFicha).catch(aviso);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
