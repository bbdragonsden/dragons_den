/*
 * Portada: "Tu tiro, analizado". Un balón que se lanza arrastrando hacia atrás
 * y soltando (tirachinas), dentro de un marco de análisis de vídeo que mide el
 * ángulo de salida y devuelve una corrección como la del entrenador.
 * Solo se anima transform y opacity. Con movimiento reducido no hay vuelo:
 * el resultado se calcula y se muestra directamente.
 */
(function () {
  'use strict';
  var escena = document.getElementById('p-tiro');
  if (!escena) return;

  var QUIETO = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var campo = escena.querySelector('.pt-campo');
  var balon = escena.querySelector('.pt-balon');
  var guia = escena.querySelector('.pt-guia');
  var rastro = escena.querySelector('.pt-rastro');
  var red = escena.querySelector('.pt-red');
  var destello = escena.querySelector('.pt-destello');
  var pista = escena.querySelector('.pt-pista');
  var lectura = {
    ang: escena.querySelector('[data-pt="ang"]'),
    vel: escena.querySelector('[data-pt="vel"]'),
    arco: escena.querySelector('[data-pt="arco"]'),
    tiros: escena.querySelector('[data-pt="tiros"]')
  };
  var veredicto = escena.querySelector('.pt-veredicto');
  var boton = escena.querySelector('.pt-lanzar');
  var reloj = escena.querySelector('[data-pt="reloj"]');

  var GUIA_N = 14, RASTRO_N = 26;
  var puntosGuia = [], puntosRastro = [];
  for (var i = 0; i < GUIA_N; i++) { var g = document.createElement('i'); guia.appendChild(g); puntosGuia.push(g); }
  for (var j = 0; j < RASTRO_N; j++) { var r = document.createElement('i'); rastro.appendChild(r); puntosRastro.push(r); }

  var M = {};            // medidas de la escena en px
  var estado = 'listo';  // listo | apuntando | volando
  var tiros = 0, canastas = 0, demoHecha = false;
  var t0 = performance.now();

  function medir() {
    var b = campo.getBoundingClientRect();
    M.w = b.width; M.h = b.height;
    M.r = Math.max(14, Math.min(26, M.w * 0.045));          // radio del balón
    M.x0 = M.w * 0.12; M.y0 = M.h * 0.8;                    // salida
    M.aroX = M.w * 0.78; M.aroY = M.h * 0.68;               // centro del aro
    M.aroR = Math.max(M.r * 1.9, M.w * 0.085);              // medio ancho del aro
    M.tablero = M.aroX + M.aroR + M.w * 0.045;               // cara del tablero
    M.tableroArriba = M.aroY - M.h * 0.16;
    M.g = M.h * 2.35;                                        // gravedad (px/s²)
    M.k = 3.6;                                               // fuerza por px de arrastre
    M.vmax = M.h * 2.6;
  }

  function poner(el, x, y, rot, esc) {
    el.style.transform = 'translate3d(' + (x - M.r) + 'px,' + (y - M.r) + 'px,0)' + (rot ? ' rotate(' + rot + 'deg)' : '') + (esc ? ' scale(' + esc + ')' : '');
  }
  function reposo() {
    poner(balon, M.x0, M.y0, 0);
    balon.style.opacity = '1';
  }

  // ── Telemetría ──────────────────────────────────────────────────────
  function grados(vx, vy) { return Math.round(Math.atan2(-vy, vx) * 180 / Math.PI); }
  function mostrar(vx, vy) {
    var a = grados(vx, vy);
    // Escala real: del punto de tiro al aro hay unos 0,9 m de altura.
    var mpp = 0.9 / (M.y0 - M.aroY);
    var tiempo = Math.sqrt(9.81 / (M.g * mpp));
    var v = Math.sqrt(vx * vx + vy * vy) * mpp * tiempo;
    var h = (vy < 0 ? (vy * vy) / (2 * M.g) : 0) * mpp;
    lectura.ang.textContent = (isFinite(a) ? a : 0) + '°';
    lectura.vel.textContent = v.toFixed(1).replace('.', ',') + ' m/s';
    lectura.arco.textContent = h.toFixed(1).replace('.', ',') + ' m';
  }

  // ── Guía de apuntado: solo el primer tramo, para que siga siendo tiro ──
  function velocidadDesde(dx, dy) {
    var vx = -dx * M.k, vy = -dy * M.k;
    var v = Math.sqrt(vx * vx + vy * vy);
    if (v > M.vmax) { vx *= M.vmax / v; vy *= M.vmax / v; }
    return { vx: vx, vy: vy };
  }
  function pintarGuia(vx, vy) {
    for (var i = 0; i < GUIA_N; i++) {
      var t = (i + 1) * 0.03;
      var x = M.x0 + vx * t, y = M.y0 + vy * t + 0.5 * M.g * t * t;
      puntosGuia[i].style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      puntosGuia[i].style.opacity = String(0.85 - i / GUIA_N * 0.75);
    }
  }
  function ocultarGuia() { puntosGuia.forEach(function (p) { p.style.opacity = '0'; }); }
  function limpiarRastro() { puntosRastro.forEach(function (p) { p.style.opacity = '0'; }); }

  // ── Simulación ──────────────────────────────────────────────────────
  // Devuelve la trayectoria completa y el resultado; la animación solo la reproduce.
  function simular(vx, vy) {
    var x = M.x0, y = M.y0, dt = 1 / 120, t = 0, pts = [], res = null, toques = 0;
    var izq = M.aroX - M.aroR, der = M.aroX + M.aroR;
    var pasoPlanoAntes = y > M.aroY;
    while (t < 3.2) {
      var yAntes = y;
      vy += M.g * dt; x += vx * dt; y += vy * dt; t += dt;
      // tablero
      if (x + M.r > M.tablero && y > M.tableroArriba && y < M.aroY + M.h * 0.04 && vx > 0) {
        x = M.tablero - M.r; vx = -vx * 0.55; toques++;
      }
      // desde abajo: el aro lo frena y lo devuelve
      if (yAntes > M.aroY && y <= M.aroY && vy < 0 && x > M.aroX - M.aroR - M.r * 0.6 && x < M.aroX + M.aroR + M.r * 0.6) {
        vy = Math.abs(vy) * 0.3; y = M.aroY + 1; toques++;
      }
      // cruce del plano del aro bajando
      if (yAntes < M.aroY && y >= M.aroY && vy > 0) {
        var limpio = x > izq + M.r * 0.3 && x < der - M.r * 0.3;
        var hierro = !limpio && x > izq - M.r * 0.8 && x < der + M.r * 0.8;
        if (limpio && !res) res = { canasta: true, limpia: toques === 0, t: t };
        else if (hierro && !res) {
          toques++;
          // rebote en el aro: sale hacia fuera
          vy = -vy * 0.42; vx = (x < M.aroX ? -1 : 1) * Math.abs(vx) * 0.5 + (x < M.aroX ? -40 : 40);
          y = M.aroY - 1;
        }
      }
      pts.push([x, y, t]);
      if (y > M.h + M.r * 2 || x < -M.r * 3 || x > M.w + M.r * 3) break;
      if (res && t > res.t + 0.45) break;
    }
    if (!res) {
      // ¿corto o largo? Mira dónde cruzó la altura del aro en la bajada
      var cruce = null;
      for (var k = 1; k < pts.length; k++) if (pts[k - 1][1] < M.aroY && pts[k][1] >= M.aroY) { cruce = pts[k][0]; break; }
      var maxY = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
      res = { canasta: false, tipo: maxY > M.aroY ? 'bajo' : (cruce !== null && cruce < M.aroX ? 'corto' : 'largo') };
    }
    return { pts: pts, res: res };
  }

  function consejo(res, a) {
    var franja = a >= 45 && a <= 58;
    if (res.canasta && res.limpia && franja) return ['Canasta limpia', 'Salida a ' + a + '°: la franja de los buenos tiradores (45-55°). Así se repite.'];
    if (res.canasta && franja) return ['Canasta', 'Entra con ayuda del tablero. Buen arco, ' + a + '°. Ahora busca la red sin tocar hierro.'];
    if (res.canasta) return ['Canasta, pero ojo', 'Entra con ' + a + '° de salida. Con 45-55° el aro "se hace más grande" y fallas menos.'];
    if (res.tipo === 'bajo') return ['No llega', 'Te faltan piernas: el balón no supera la altura del aro. Más impulso desde abajo.'];
    if (a < 40) return ['Tiro plano', 'Sale a ' + a + '°. Un arco más alto da más margen al entrar. Suelta más arriba.'];
    if (res.tipo === 'corto') return ['Corto', a + '° de salida está bien; falta fuerza. Termina el gesto con la muñeca.'];
    return ['Largo', 'Te pasas. Con ' + a + '° de salida, suelta con menos fuerza y deja caer el balón.'];
  }

  function reproducir(vx, vy, fin) {
    estado = 'volando';
    escena.classList.add('is-volando');
    escena.classList.remove('is-pista');
    var sim = simular(vx, vy);
    var a = grados(vx, vy);
    veredicto.classList.remove('is-ok', 'is-ko');
    veredicto.querySelector('b').textContent = 'Analizando';
    veredicto.querySelector('span').textContent = 'Ángulo de salida ' + a + '°. Midiendo el arco…';
    veredicto.classList.add('is-visible');
    mostrar(vx, vy);
    limpiarRastro();
    var cada = Math.max(1, Math.floor(sim.pts.length / RASTRO_N));

    function cerrar() {
      tiros++; if (sim.res.canasta) canastas++;
      lectura.tiros.textContent = canastas + '/' + tiros;
      var c = consejo(sim.res, a);
      veredicto.querySelector('b').textContent = c[0];
      veredicto.querySelector('span').textContent = c[1];
      veredicto.classList.remove('is-ok', 'is-ko');
      void veredicto.offsetWidth;
      veredicto.classList.add('is-visible', sim.res.canasta ? 'is-ok' : 'is-ko');
      if (sim.res.canasta) {
        red.classList.remove('is-red'); void red.offsetWidth; red.classList.add('is-red');
        destello.classList.remove('is-destello'); void destello.offsetWidth; destello.classList.add('is-destello');
      }
      if (tiros >= 3) escena.classList.add('is-cta');
      setTimeout(function () {
        estado = 'listo';
        escena.classList.remove('is-volando');
        balon.style.opacity = '0';
        setTimeout(function () { reposo(); }, 180);
        if (fin) fin();
      }, QUIETO ? 200 : 650);
    }

    if (QUIETO) {
      var p = sim.pts[sim.pts.length - 1];
      for (var q = 0; q < RASTRO_N; q++) {
        var pt = sim.pts[Math.min(sim.pts.length - 1, q * cada)];
        puntosRastro[q].style.transform = 'translate3d(' + pt[0] + 'px,' + pt[1] + 'px,0)';
        puntosRastro[q].style.opacity = '.5';
      }
      poner(balon, p[0], Math.min(p[1], M.h - M.r), 0);
      cerrar();
      return;
    }

    var inicio = performance.now(), idx = 0, n = 0;
    var giro = vx > 0 ? -1 : 1;
    function marco(ahora) {
      var t = (ahora - inicio) / 1000;
      while (idx < sim.pts.length - 1 && sim.pts[idx][2] < t) {
        if (idx % cada === 0 && n < RASTRO_N) {
          var d = puntosRastro[n++];
          d.style.transform = 'translate3d(' + sim.pts[idx][0] + 'px,' + sim.pts[idx][1] + 'px,0)';
          d.style.opacity = '.55';
        }
        idx++;
      }
      var p = sim.pts[idx];
      // por debajo del aro, el balón pasa detrás de la red
      escena.classList.toggle('is-bajo-aro', sim.res.canasta && p[1] > M.aroY && Math.abs(p[0] - M.aroX) < M.aroR * 1.4);
      poner(balon, p[0], p[1], t * 540 * giro);
      if (idx < sim.pts.length - 1) requestAnimationFrame(marco);
      else { escena.classList.remove('is-bajo-aro'); cerrar(); }
    }
    requestAnimationFrame(marco);
  }

  // ── Gesto: arrastrar hacia atrás y soltar ───────────────────────────
  var origen = null, dedo = null;
  balon.addEventListener('pointerdown', function (e) {
    if (estado !== 'listo') return;
    medir();
    estado = 'apuntando';
    dedo = e.pointerId;
    balon.setPointerCapture(e.pointerId);
    origen = { x: e.clientX, y: e.clientY };
    escena.classList.add('is-apuntando');
    escena.classList.remove('is-pista');
    veredicto.classList.remove('is-visible');
    limpiarRastro();
    e.preventDefault();
  });
  balon.addEventListener('pointermove', function (e) {
    if (estado !== 'apuntando' || e.pointerId !== dedo) return;
    var dx = e.clientX - origen.x, dy = e.clientY - origen.y;
    // el balón sigue al dedo 1:1 con resistencia al estirar mucho (rubber band)
    var d = Math.sqrt(dx * dx + dy * dy), lim = M.h * 0.34;
    var f = d > lim ? (lim + (d - lim) * 0.25) / d : 1;
    poner(balon, M.x0 + dx * f, M.y0 + dy * f, 0, 1 - Math.min(.12, d / 2000));
    var v = velocidadDesde(dx, dy);
    if (d > 8) { pintarGuia(v.vx, v.vy); mostrar(v.vx, v.vy); } else ocultarGuia();
  });
  function soltar(e) {
    if (estado !== 'apuntando' || e.pointerId !== dedo) return;
    escena.classList.remove('is-apuntando');
    ocultarGuia();
    var dx = e.clientX - origen.x, dy = e.clientY - origen.y;
    if (Math.sqrt(dx * dx + dy * dy) < 14 || dx >= 0 || dy <= 0) {
      // toque sin estirar: vuelve al sitio y recuerda el gesto
      estado = 'listo'; reposo(); escena.classList.add('is-pista');
      return;
    }
    var v = velocidadDesde(dx, dy);
    reproducir(v.vx, v.vy);
  }
  balon.addEventListener('pointerup', soltar);
  balon.addEventListener('pointercancel', function (e) { if (e.pointerId === dedo) { estado = 'listo'; escena.classList.remove('is-apuntando'); ocultarGuia(); reposo(); } });

  // Velocidad ideal hacia el aro con un ángulo dado (para el botón y la demo)
  function anguloMinimo() { return Math.atan(2 * (M.y0 - M.aroY) / (M.aroX - M.x0)) * 180 / Math.PI; }
  function tiroIdeal(anguloGrados, error) {
    anguloGrados = Math.max(anguloGrados, anguloMinimo() + 10);
    var a = anguloGrados * Math.PI / 180;
    var dx = M.aroX - M.x0, dy = M.y0 - M.aroY;
    var v = Math.sqrt(M.g * dx * dx / (2 * Math.cos(a) * Math.cos(a) * (dx * Math.tan(a) - dy)));
    v *= 1 + (error || 0);
    return { vx: v * Math.cos(a), vy: -v * Math.sin(a) };
  }
  boton.addEventListener('click', function () {
    if (estado !== 'listo') return;
    medir();
    veredicto.classList.remove('is-visible');
    var ang = 46 + Math.random() * 12;
    var err = (Math.random() - 0.45) * 0.09;
    var v = tiroIdeal(ang, err);
    reproducir(v.vx, v.vy);
  });

  // ── Reloj de grabación ──────────────────────────────────────────────
  if (reloj) setInterval(function () {
    var s = Math.floor((performance.now() - t0) / 1000);
    reloj.textContent = '00:' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);

  // ── Arranque y demo de la primera visita ────────────────────────────
  medir(); reposo();
  window.addEventListener('resize', function () { if (estado === 'listo') { medir(); reposo(); } });
  var visto = false;
  try { visto = localStorage.getItem('dd_tiro_visto') === '1'; } catch (e) {}
  // La demo arranca cuando la escena se ve de verdad (en móvil está bajo el titular).
  function alVer(fn) {
    if (!('IntersectionObserver' in window)) return setTimeout(fn, 1400);
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); setTimeout(fn, 700); }
    }, { threshold: 0.6 });
    io.observe(campo);
  }
  if (!visto && !QUIETO) {
    veredicto.classList.add('is-visible');
    alVer(function () {
      if (estado !== 'listo' || demoHecha) return;
      demoHecha = true;
      medir();
      var v = tiroIdeal(51, 0);
      reproducir(v.vx, v.vy, function () {
        tiros = 0; canastas = 0; lectura.tiros.textContent = '0/0';
        veredicto.querySelector('b').textContent = 'Te toca';
        veredicto.querySelector('span').textContent = 'Arrastra el balón hacia atrás y suéltalo. Analizamos tu tiro.';
        escena.classList.add('is-pista');
      });
      try { localStorage.setItem('dd_tiro_visto', '1'); } catch (e) {}
    });
  } else {
    veredicto.querySelector('b').textContent = 'Te toca';
    veredicto.querySelector('span').textContent = 'Arrastra el balón hacia atrás y suéltalo. Analizamos tu tiro.';
    veredicto.classList.add('is-visible');
    escena.classList.add('is-pista');
  }
})();
