/*
 * Mi carta: la carta del jugador dentro de su perfil privado y la forma de
 * compartirla. Solo se carga en la plataforma, con sesión iniciada: cada uno
 * comparte la suya y nadie más puede generarla.
 *
 * - Todo se dibuja en un <canvas> en el propio dispositivo. La foto que elija
 *   el jugador no se sube a ningún sitio.
 * - Cada red y cada modo tiene su tamaño y sus zonas seguras (lo que tapa la
 *   interfaz de la app: nombre de usuario arriba, botones y texto abajo...).
 * - En móvil se usa el menú nativo de compartir con la imagen. En escritorio
 *   se descarga la imagen, se copia el texto y se abre la red que tenga enlace
 *   para publicar.
 */
(function () {
  'use strict';

  var COLOR = { bronce: '#c08a5b', plata: '#c3c8cf', oro: '#d9bf72', leyenda: '#f0dfa8', dragon: '#c8a96e' };
  var URL_WEB = location.origin + '/';

  function ico(p) { return '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false"><path d="' + p + '"/></svg>'; }
  // Logos de Phosphor Icons (licencia MIT)
  var LOGO = {
    instagram: ico('M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160ZM176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z'),
    tiktok: ico('M224,72a48.05,48.05,0,0,1-48-48,8,8,0,0,0-8-8H128a8,8,0,0,0-8,8V156a20,20,0,1,1-28.57-18.08A8,8,0,0,0,96,130.690V88a8,8,0,0,0-9.4-7.88C50.91,86.48,24,119.1,24,156a76,76,0,0,0,152,0V116.29A103.25,103.25,0,0,0,224,128a8,8,0,0,0,8-8V80A8,8,0,0,0,224,72Zm-8,39.64a87.19,87.19,0,0,1-43.33-16.15A8,8,0,0,0,160,102v54a60,60,0,0,1-120,0c0-25.9,16.64-49.13,40-57.6v27.67A36,36,0,1,0,136,156V32h24.5A64.14,64.14,0,0,0,216,87.5Z'),
    whatsapp: ico('M187.58,144.84l-32-16a8,8,0,0,0-8,.5l-14.69,9.8a40.55,40.55,0,0,1-16-16l9.8-14.69a8,8,0,0,0,.5-8l-16-32A8,8,0,0,0,104,64a40,40,0,0,0-40,40,88.1,88.1,0,0,0,88,88,40,40,0,0,0,40-40A8,8,0,0,0,187.58,144.84ZM152,176a72.08,72.08,0,0,1-72-72A24,24,0,0,1,99.29,80.46l11.48,23L101,118a8,8,0,0,0-.73,7.51,56.47,56.47,0,0,0,30.15,30.15A8,8,0,0,0,138,155l14.61-9.74,23,11.48A24,24,0,0,1,152,176ZM128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z'),
    facebook: ico('M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm8,191.63V152h24a8,8,0,0,0,0-16H136V112a16,16,0,0,1,16-16h16a8,8,0,0,0,0-16H152a32,32,0,0,0-32,32v24H96a8,8,0,0,0,0,16h24v63.63a88,88,0,1,1,16,0Z'),
    x: ico('M214.75,211.71l-62.6-98.38,61.77-67.95a8,8,0,0,0-11.840-10.76L143.24,99.34,102.75,35.71A8,8,0,0,0,96,32H48a8,8,0,0,0-6.75,12.3l62.6,98.37-61.77,68a8,8,0,1,0,11.84,10.76l58.84-64.72,40.49,63.63A8,8,0,0,0,160,224h48a8,8,0,0,0,6.75-12.29ZM164.39,208,62.57,48h29L193.43,208Z'),
    linkedin: ico('M216,24H40A16,16,0,0,0,24,40V216a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V40A16,16,0,0,0,216,24Zm0,192H40V40H216V216ZM96,112v64a8,8,0,0,1-16,0V112a8,8,0,0,1,16,0Zm88,28v36a8,8,0,0,1-16,0V140a20,20,0,0,0-40,0v36a8,8,0,0,1-16,0V112a8,8,0,0,1,15.79-1.78A36,36,0,0,1,184,140ZM100,84A12,12,0,1,1,88,72,12,12,0,0,1,100,84Z'),
    telegram: ico('M228.88,26.19a9,9,0,0,0-9.16-1.57L17.06,103.93a14.22,14.22,0,0,0,2.43,27.21L72,141.45V200a15.92,15.92,0,0,0,10,14.83,15.91,15.91,0,0,0,17.51-3.73l25.32-26.26L165,220a15.88,15.88,0,0,0,10.51,4,16.3,16.3,0,0,0,5-.79,15.85,15.85,0,0,0,10.67-11.63L231.77,35A9,9,0,0,0,228.88,26.19Zm-61.14,36L78.15,126.35l-49.6-9.73ZM88,200V152.52l24.79,21.74Zm87.53,8L92.85,135.5l119-85.29Z'),
    pinterest: ico('M224,112c0,22.57-7.9,43.2-22.23,58.11C188.39,184,170.25,192,152,192c-17.88,0-29.82-5.86-37.43-12l-10.78,45.82A8,8,0,0,1,96,232a8.24,8.24,0,0,1-1.84-.21,8,8,0,0,1-6-9.62l32-136a8,8,0,0,1,15.58,3.66l-16.9,71.8C122,166,131.3,176,152,176c27.53,0,56-23.94,56-64A72,72,0,1,0,73.63,148a8,8,0,0,1-13.85,8A88,88,0,1,1,224,112Z')
  };

  // Zonas seguras: margen (en px del lienzo final) que tapa la interfaz de cada app.
  function z(t, r, b, l) { return { t: t, r: r, b: b, l: l }; }
  var REDES = [
    { id: 'instagram', n: 'Instagram', tags: true, web: 'https://www.instagram.com/', modos: [
      { id: 'historia', n: 'Historia', w: 1080, h: 1920, z: z(250, 72, 340, 72), nota: 'Arriba va tu usuario y abajo la caja de respuesta: la carta queda en el centro.' },
      { id: 'publicacion', n: 'Publicación', w: 1080, h: 1350, z: z(80, 80, 80, 80), nota: 'Vertical 4:5, el formato que más ocupa en el feed.' },
      { id: 'reel', n: 'Portada de reel', w: 1080, h: 1920, z: z(220, 180, 460, 72), nota: 'Deja libres los botones de la derecha y el texto de abajo.' }
    ] },
    { id: 'tiktok', n: 'TikTok', tags: true, web: 'https://www.tiktok.com/upload', modos: [
      { id: 'publicacion', n: 'Publicación', w: 1080, h: 1920, z: z(170, 180, 480, 72), nota: 'Esquiva los botones de la derecha y la descripción de abajo.' },
      { id: 'historia', n: 'Historia', w: 1080, h: 1920, z: z(220, 72, 300, 72), nota: 'Pantalla completa con margen arriba y abajo.' }
    ] },
    { id: 'whatsapp', n: 'WhatsApp', modos: [
      { id: 'estado', n: 'Estado', w: 1080, h: 1920, z: z(210, 72, 260, 72), nota: 'Arriba va la barra del estado y abajo el campo de respuesta.' },
      { id: 'chat', n: 'Chat o grupo', w: 1080, h: 1080, z: z(70, 70, 70, 70), nota: 'Cuadrada: en el chat se ve entera, sin recortes.' }
    ], abrir: function (t) { return 'https://wa.me/?text=' + encodeURIComponent(t + ' ' + URL_WEB); } },
    { id: 'facebook', n: 'Facebook', modos: [
      { id: 'historia', n: 'Historia', w: 1080, h: 1920, z: z(250, 72, 340, 72), nota: 'Arriba va tu nombre y abajo las reacciones.' },
      { id: 'publicacion', n: 'Publicación', w: 1080, h: 1350, z: z(80, 80, 80, 80), nota: 'Vertical 4:5 para el muro.' }
    ], abrir: function () { return 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(URL_WEB); } },
    { id: 'x', n: 'X', modos: [
      { id: 'post', n: 'Post', w: 1600, h: 900, z: z(60, 60, 60, 60), nota: 'Horizontal 16:9: se ve entera en el timeline.' }
    ], abrir: function (t) { return 'https://x.com/intent/post?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(URL_WEB); } },
    { id: 'linkedin', n: 'LinkedIn', modos: [
      { id: 'publicacion', n: 'Publicación', w: 1200, h: 1200, z: z(70, 70, 70, 70), nota: 'Cuadrada, la que mejor se ve en el feed.' },
      { id: 'horizontal', n: 'Horizontal', w: 1200, h: 627, z: z(48, 60, 48, 60), nota: 'El formato de las imágenes horizontales.' }
    ], abrir: function () { return 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(URL_WEB); } },
    { id: 'telegram', n: 'Telegram', modos: [
      { id: 'historia', n: 'Historia', w: 1080, h: 1920, z: z(220, 72, 300, 72), nota: 'Pantalla completa con margen para la interfaz.' },
      { id: 'chat', n: 'Chat o canal', w: 1080, h: 1080, z: z(70, 70, 70, 70), nota: 'Cuadrada, sin recortes.' }
    ], abrir: function (t) { return 'https://t.me/share/url?url=' + encodeURIComponent(URL_WEB) + '&text=' + encodeURIComponent(t); } },
    { id: 'pinterest', n: 'Pinterest', web: 'https://www.pinterest.com/pin-builder/', modos: [
      { id: 'pin', n: 'Pin', w: 1000, h: 1500, z: z(70, 70, 70, 70), nota: 'Vertical 2:3, el formato estándar de los pines.' }
    ] }
  ];

  var S = null; // estado de la vista

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ── Fuentes e imágenes ───────────────────────────────────────────────
  var fuentes = null;
  function cargarFuentes() {
    if (fuentes) return fuentes;
    var lista = [['Bebas Neue', '/fonts/bebas-neue-latin-400-normal.woff2', '400'], ['Inter', '/fonts/inter-latin-400-normal.woff2', '400'], ['Inter', '/fonts/inter-latin-600-normal.woff2', '600']];
    fuentes = Promise.all(lista.map(function (f) {
      try { var ff = new FontFace(f[0], 'url(' + f[1] + ')', { weight: f[2] }); document.fonts.add(ff); return ff.load().catch(function () {}); } catch (e) { return Promise.resolve(); }
    })).then(function () { return document.fonts.ready; });
    return fuentes;
  }
  function cargarImagen(src) {
    return new Promise(function (ok) {
      if (!src) return ok(null);
      var i = new Image(); i.decoding = 'async';
      i.onload = function () { ok(i); }; i.onerror = function () { ok(null); };
      i.src = src;
    });
  }

  // ── Datos de la carta ────────────────────────────────────────────────
  function datosBase(ctx) {
    var p = ctx.perfil || {};
    var meta = (ctx.user && ctx.user.user_metadata) || {};
    var completo = String(p.nombre || meta.name || meta.full_name || (ctx.user && ctx.user.email ? ctx.user.email.split('@')[0] : 'Jugador')).trim();
    var partes = completo.split(/\s+/);
    var corto = partes[0] + (partes[1] ? ' ' + partes[1].charAt(0).toUpperCase() + '.' : '');
    var pos = { base: 'Base', escolta: 'Escolta', alero: 'Alero', alapivot: 'Ala-pívot', pivot: 'Pívot' }[p.posicion] || '';
    var prog = ctx.progreso || null;
    var asp = prog && prog.aspecto ? prog.aspecto : null;
    var nivel = prog && prog.nivel ? prog.nivel : null;
    var temporada = prog && prog.temporada ? prog.temporada.id : '2026-27';
    var rango = asp ? asp.nombre.replace(/^Carta\s+(de\s+)?/i, '') : 'Dragón';
    return {
      completo: completo, corto: corto, posicion: pos,
      aspecto: asp ? asp.id : 'dragon',
      rango: rango.charAt(0).toUpperCase() + rango.slice(1),
      nivel: nivel ? 'Nivel ' + nivel.numero + ' · ' + nivel.nombre : '',
      temporada: 'Temporada ' + temporada.replace(/^20(\d\d)-(\d\d)$/, '$1/$2')
    };
  }
  function clave() { return 'dd_mi_carta_' + (S && S.ctx.user ? S.ctx.user.id : 'anon'); }
  function guardarPrefs() {
    try { localStorage.setItem(clave(), JSON.stringify(S.pref)); } catch (e) {}
  }
  function leerPrefs() {
    try { return JSON.parse(localStorage.getItem(clave()) || '{}') || {}; } catch (e) { return {}; }
  }

  // ── Dibujo ───────────────────────────────────────────────────────────
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function redondo(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // letter-spacing manual: Safari antiguo no soporta ctx.letterSpacing
  function medirEsp(c, txt, sp) {
    var a = 0; for (var i = 0; i < txt.length; i++) a += c.measureText(txt[i]).width + (i < txt.length - 1 ? sp : 0);
    return a;
  }
  function espaciado(c, txt, x, y, sp, alinear) {
    var ancho = medirEsp(c, txt, sp);
    var px = alinear === 'center' ? x - ancho / 2 : alinear === 'right' ? x - ancho : x;
    c.textAlign = 'left';
    for (var i = 0; i < txt.length; i++) { c.fillText(txt[i], px, y); px += c.measureText(txt[i]).width + sp; }
    return ancho;
  }
  function lineas(c, txt, max) {
    var pal = String(txt).split(/\s+/), out = [], l = '';
    pal.forEach(function (p) { var t = l ? l + ' ' + p : p; if (c.measureText(t).width > max && l) { out.push(l); l = p; } else l = t; });
    if (l) out.push(l);
    return out;
  }
  function ajustar(c, txt, fuente, tam, max, sp) {
    var t = tam; c.font = fuente.replace('{t}', t);
    while (medirEsp(c, txt, sp || 0) > max && t > 10) { t -= 2; c.font = fuente.replace('{t}', t); }
    return t;
  }

  // Carta en proporción 1:1,414, la de las cartas del Squad
  function dibujarCarta(c, x, y, w, d, img, conHalo) {
    var h = w * 1.414, k = w / 800, col = COLOR[d.aspecto] || COLOR.dragon;
    c.save();
    if (conHalo) { c.shadowColor = hexA(col, .7); c.shadowBlur = 90 * k; }
    c.fillStyle = '#0a0a0a'; redondo(c, x, y, w, h, 22 * k); c.fill();
    c.shadowBlur = 0; c.shadowColor = 'transparent';

    c.save();
    redondo(c, x, y, w, h, 22 * k); c.clip();
    var fondo = c.createLinearGradient(x, y, x, y + h);
    fondo.addColorStop(0, '#17140f'); fondo.addColorStop(1, '#070707');
    c.fillStyle = fondo; c.fillRect(x, y, w, h);
    var luz = c.createRadialGradient(x + w * .5, y + h * .32, 0, x + w * .5, y + h * .32, w * .8);
    luz.addColorStop(0, hexA(col, .34)); luz.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = luz; c.fillRect(x, y, w, h);
    c.strokeStyle = hexA(col, .16); c.lineWidth = 2 * k;
    c.beginPath(); c.arc(x + w / 2, y + h * .98, w * .42, Math.PI, 0); c.stroke();
    c.beginPath(); c.arc(x + w / 2, y + h * .98, w * .14, Math.PI, 0); c.stroke();
    if (img) {
      var r = Math.max(w / img.width, h / img.height), iw = img.width * r, ih = img.height * r;
      c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    } else {
      // Sin foto: balón dibujado detrás de la inicial
      var bx = x + w / 2, by = y + h * .44, br = w * .4;
      c.save(); c.strokeStyle = hexA(col, .22); c.lineWidth = 3 * k;
      c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(bx - br, by); c.lineTo(bx + br, by); c.moveTo(bx, by - br); c.lineTo(bx, by + br); c.stroke();
      c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.clip();
      c.beginPath(); c.ellipse(bx - br * 1.05, by, br * .6, br * 1.1, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(bx + br * 1.05, by, br * .6, br * 1.1, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
      var gi = c.createLinearGradient(x, y + h * .3, x, y + h * .64);
      gi.addColorStop(0, 'rgba(255,255,255,.75)'); gi.addColorStop(1, hexA(col, .35));
      c.fillStyle = gi;
      c.font = (560 * k) + 'px "Bebas Neue"'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText((d.nombre || 'D').charAt(0).toUpperCase(), x + w / 2, y + h * .64);
    }
    var baja = c.createLinearGradient(x, y + h * .45, x, y + h);
    baja.addColorStop(0, 'rgba(0,0,0,0)'); baja.addColorStop(1, 'rgba(0,0,0,.92)');
    c.fillStyle = baja; c.fillRect(x, y + h * .45, w, h * .55);
    var alta = c.createLinearGradient(x, y, x, y + h * .2);
    alta.addColorStop(0, 'rgba(0,0,0,.6)'); alta.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = alta; c.fillRect(x, y, w, h * .2);
    var foil = c.createLinearGradient(x, y, x + w, y + h);
    foil.addColorStop(.38, 'rgba(255,255,255,0)'); foil.addColorStop(.5, hexA(col, .16)); foil.addColorStop(.62, 'rgba(255,255,255,0)');
    c.fillStyle = foil; c.fillRect(x, y, w, h);
    c.restore();

    c.strokeStyle = col; c.lineWidth = 3 * k; redondo(c, x, y, w, h, 22 * k); c.stroke();
    c.strokeStyle = hexA(col, .5); c.lineWidth = 1.5 * k; redondo(c, x + 18 * k, y + 18 * k, w - 36 * k, h - 36 * k, 12 * k); c.stroke();

    c.textBaseline = 'alphabetic';
    c.fillStyle = col; c.font = (34 * k) + 'px "Bebas Neue"';
    espaciado(c, 'DRAGONS DEN', x + 50 * k, y + 84 * k, 6 * k);
    c.fillStyle = 'rgba(255,255,255,.72)'; c.font = '600 ' + (17 * k) + 'px Inter';
    espaciado(c, d.temporada.toUpperCase(), x + 50 * k, y + 114 * k, 2.5 * k);
    if (d.dorsal) {
      c.font = (190 * k) + 'px "Bebas Neue"'; c.textAlign = 'right';
      c.lineWidth = 2.5 * k; c.strokeStyle = hexA(col, .85); c.strokeText(String(d.dorsal), x + w - 46 * k, y + 200 * k);
      c.textAlign = 'left';
    }

    var base = y + h - 72 * k;
    var linea2 = [d.posicion, d.nivel].filter(Boolean).join('  ·  ');
    if (linea2) {
      c.fillStyle = 'rgba(255,255,255,.8)';
      ajustar(c, linea2.toUpperCase(), '600 {t}px Inter', 19 * k, w - 100 * k, 2 * k);
      espaciado(c, linea2.toUpperCase(), x + 50 * k, base, 2 * k);
      base -= 46 * k;
    }
    var nom = d.nombre.toUpperCase();
    c.fillStyle = '#fff';
    var tn = ajustar(c, nom, '{t}px "Bebas Neue"', 132 * k, w - 100 * k, 2 * k);
    espaciado(c, nom, x + 50 * k, base, 2 * k);
    base -= tn * .92;
    c.font = (30 * k) + 'px "Bebas Neue"';
    var txt = d.rango.toUpperCase();
    var sw = medirEsp(c, txt, 4 * k) + 40 * k, sh = 46 * k, sx = x + 50 * k, sy = base - sh - 4 * k;
    c.fillStyle = 'rgba(8,8,8,.88)'; c.fillRect(sx, sy, sw, sh);
    c.strokeStyle = col; c.lineWidth = 2 * k; c.strokeRect(sx, sy, sw, sh);
    c.fillStyle = col; espaciado(c, txt, sx + 20 * k, sy + sh - 13 * k, 4 * k);
    c.restore();
    return h;
  }

  // Compone la imagen final para una red y un modo
  function componer(lienzo, modo, d, img) {
    var W = modo.w, H = modo.h;
    lienzo.width = W; lienzo.height = H;
    var c = lienzo.getContext('2d');
    var col = COLOR[d.aspecto] || COLOR.dragon;
    c.fillStyle = '#080808'; c.fillRect(0, 0, W, H);
    var g = c.createRadialGradient(W * .5, H * .42, 0, W * .5, H * .42, Math.max(W, H) * .7);
    g.addColorStop(0, hexA(col, .22)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = .045; c.strokeStyle = '#fff'; c.lineWidth = 2;
    for (var i = -H; i < W; i += 46) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.stroke(); }
    c.restore();
    c.strokeStyle = hexA(col, .12); c.lineWidth = 3;
    c.beginPath(); c.arc(W / 2, H * 1.02, Math.min(W, H) * .62, Math.PI, 0); c.stroke();

    var Z = modo.z, A = { x: Z.l, y: Z.t, w: W - Z.l - Z.r, h: H - Z.t - Z.b };
    var prop = H / W, s = W / 1080;
    var lema = d.lema ? '«' + d.lema + '»' : 'Una carta no se compra. Se gana.';
    var host = location.host.replace(/^www\./, '');

    function marca(x, y, alin, tam) {
      c.fillStyle = '#c8a96e'; c.font = tam + 'px "Bebas Neue"'; c.textBaseline = 'alphabetic';
      espaciado(c, 'DRAGONS DEN', x, y, tam * .18, alin);
    }
    function pie(x, y, alin, tam) {
      c.fillStyle = 'rgba(255,255,255,.62)'; c.font = '600 ' + tam + 'px Inter';
      espaciado(c, host.toUpperCase(), x, y, tam * .12, alin);
    }
    function frase(x, y, maxW, tam, alin, maxL) {
      c.fillStyle = 'rgba(255,255,255,.88)'; c.font = '400 ' + tam + 'px Inter';
      lineas(c, lema, maxW).slice(0, maxL || 3).forEach(function (l, k) { c.textAlign = alin || 'left'; c.fillText(l, x, y + k * tam * 1.4); });
      c.textAlign = 'left';
    }

    if (prop >= 1.6) {
      // Vertical (historias, estados, reels): marca arriba, carta grande, frase y web abajo
      var tamM = 64 * s;
      marca(W / 2, A.y + tamM, 'center', tamM);
      c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '600 ' + (24 * s) + 'px Inter';
      espaciado(c, 'TECNIFICACIÓN DE BALONCESTO', W / 2, A.y + tamM + 46 * s, 5 * s, 'center');
      var arriba = tamM + 96 * s, abajo = 200 * s;
      var dispH = A.h - arriba - abajo;
      var cw = Math.min(A.w * .86, dispH / 1.414), ch = cw * 1.414;
      var cy = A.y + arriba + (dispH - ch) / 2;
      dibujarCarta(c, A.x + (A.w - cw) / 2, cy, cw, d, img, true);
      frase(W / 2, cy + ch + 78 * s, A.w * .9, 36 * s, 'center', 2);
      pie(W / 2, A.y + A.h - 6 * s, 'center', 24 * s);
    } else if (prop >= 1.2) {
      // Vertical corto (4:5, 2:3): marca arriba, carta centrada, frase y web
      var tm = 54 * s, ab = 150 * s;
      marca(W / 2, A.y + tm, 'center', tm);
      var dh = A.h - tm - 44 * s - ab;
      var cw2 = Math.min(A.w * .8, dh / 1.414), ch2 = cw2 * 1.414;
      var cy2 = A.y + tm + 44 * s + (dh - ch2) / 2;
      dibujarCarta(c, A.x + (A.w - cw2) / 2, cy2, cw2, d, img, true);
      frase(W / 2, cy2 + ch2 + 64 * s, A.w * .9, 32 * s, 'center', 2);
      pie(W / 2, A.y + A.h - 4 * s, 'center', 22 * s);
    } else {
      // Cuadrado y horizontal: carta a la izquierda, texto a la derecha
      var u = Math.min(W, H) / 1080, ancho = prop < .8;
      var ch3 = A.h * .96, cw3 = ch3 / 1.414;
      var cx3 = A.x + (ancho ? A.w * .05 : 0), cy3 = A.y + (A.h - ch3) / 2;
      dibujarCarta(c, cx3, cy3, cw3, d, img, true);
      var tx = cx3 + cw3 + (ancho ? 90 : 64) * u, tw = A.x + A.w - tx;
      var f = ancho ? 1.2 : 1;
      var ty = A.y + A.h * (ancho ? .2 : .16);
      marca(tx, ty, 'left', Math.min(70 * u * f, tw / 6));
      var nom = d.nombre.toUpperCase();
      var tNom = ajustar(c, nom, '{t}px "Bebas Neue"', 128 * u * f, tw, 2 * u);
      c.fillStyle = '#fff'; espaciado(c, nom, tx, ty + tNom * 1.05, 2 * u);
      c.fillStyle = col; c.font = (42 * u * f) + 'px "Bebas Neue"';
      espaciado(c, ('Carta ' + d.rango).toUpperCase(), tx, ty + tNom * 1.05 + 58 * u * f, 5 * u);
      frase(tx, ty + tNom * 1.05 + 140 * u * f, tw, 40 * u * f, 'left', 3);
      pie(tx, A.y + A.h - 10 * u, 'left', 22 * u * f);
    }
  }

  // ── Texto que acompaña a cada red ────────────────────────────────────
  function texto(red, d) {
    var base = 'Mi carta de Dragons Den: ' + d.rango + (d.nivel ? ' (' + d.nivel.replace(' · ', ', ') + ')' : '') + '.';
    var lema = d.lema ? ' ' + d.lema : ' Una carta no se compra. Se gana.';
    if (red.id === 'x') return base + lema + ' #DragonsDen #Baloncesto';
    if (red.id === 'linkedin') return 'Sigo mi progreso en Dragons Den, tecnificación de baloncesto en Madrid. ' + base;
    if (red.tags) return base + lema + '\n\n#DragonsDen #Baloncesto #Basket #Madrid';
    return base + lema;
  }

  // ── Vista ────────────────────────────────────────────────────────────
  var ICO_DESCARGA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
  var ICO_COPIAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';

  function pintar(main, ctx) {
    S = { ctx: ctx, base: datosBase(ctx), foto: null, red: REDES[0], modo: REDES[0].modos[0] };
    var p = leerPrefs();
    S.pref = { dorsal: p.dorsal || '', lema: p.lema || '', nombreCompleto: !!p.nombreCompleto, verPosicion: p.verPosicion !== false, verNivel: p.verNivel !== false };

    main.innerHTML =
      '<div class="content-header"><p class="content-eyebrow">Mi espacio</p><h1 class="content-title">Mi carta</h1>' +
      '<p class="content-desc">Tu carta de Dragons Den. Solo t&uacute; puedes crearla y compartirla: se dibuja en tu dispositivo y no la publicamos en ning&uacute;n sitio.</p></div>' +
      '<div class="mc">' +
        '<section class="mc-col mc-col--carta" aria-labelledby="mc-t1">' +
          '<h2 class="mc-h" id="mc-t1">Tu carta</h2>' +
          '<div class="mc-escena"><canvas class="mc-carta" width="800" height="1131" role="img" aria-label="Vista previa de tu carta"></canvas></div>' +
          '<div class="mc-campos">' +
            '<div class="mc-campo mc-campo--ancho"><label for="mc-foto">Foto (opcional)</label>' +
              '<input id="mc-foto" type="file" accept="image/*" aria-describedby="mc-foto-ayuda">' +
              '<p class="mc-ayuda" id="mc-foto-ayuda">La foto se queda en este dispositivo: no se sube a la plataforma. Si el jugador es menor de 14 a&ntilde;os, que la elija su padre, madre o tutor.</p>' +
              '<button type="button" class="mc-quitar" hidden>Quitar foto</button></div>' +
            '<div class="mc-campo"><label for="mc-dorsal">Dorsal</label><input id="mc-dorsal" type="text" inputmode="numeric" maxlength="2" placeholder="Ej: 23"></div>' +
            '<div class="mc-campo"><label for="mc-lema">Tu frase (opcional)</label><input id="mc-lema" type="text" maxlength="70" placeholder="Ej: Nunca me rindo"></div>' +
            '<div class="mc-campo mc-campo--ancho mc-checks">' +
              '<label><input type="checkbox" id="mc-completo"> Nombre completo (si no, nombre e inicial)</label>' +
              '<label><input type="checkbox" id="mc-pos"> Mostrar posici&oacute;n</label>' +
              '<label><input type="checkbox" id="mc-niv"> Mostrar nivel</label>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<section class="mc-col" aria-labelledby="mc-t2">' +
          '<h2 class="mc-h" id="mc-t2">Compartir</h2>' +
          '<p class="mc-paso" id="mc-p1">1. Elige la red</p>' +
          '<div class="mc-redes" role="radiogroup" aria-labelledby="mc-p1">' + REDES.map(function (r, i) {
            return '<button type="button" role="radio" class="mc-red" data-red="' + r.id + '" aria-checked="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' + LOGO[r.id] + '<span>' + esc(r.n) + '</span></button>';
          }).join('') + '</div>' +
          '<p class="mc-paso" id="mc-p2">2. Elige d&oacute;nde la vas a poner</p>' +
          '<div class="mc-modos" role="radiogroup" aria-labelledby="mc-p2"></div>' +
          '<div class="mc-vista"><div class="mc-marco"><img alt="" class="mc-img"><span class="mc-seguro" aria-hidden="true"></span></div>' +
            '<p class="mc-nota"></p></div>' +
          '<label class="mc-paso" for="mc-texto">3. Texto (se copia solo)</label>' +
          '<textarea class="mc-texto" id="mc-texto" rows="3"></textarea>' +
          '<div class="mc-acciones">' +
            '<button type="button" class="mc-btn mc-btn--uno" data-acc="compartir"></button>' +
            '<button type="button" class="mc-btn" data-acc="descargar">' + ICO_DESCARGA + 'Descargar imagen</button>' +
            '<button type="button" class="mc-btn" data-acc="copiar">' + ICO_COPIAR + 'Copiar texto</button>' +
          '</div>' +
          '<p class="mc-estado" role="status" aria-live="polite"></p>' +
        '</section>' +
      '</div>';

    S.el = {
      carta: main.querySelector('.mc-carta'), modos: main.querySelector('.mc-modos'), img: main.querySelector('.mc-img'),
      seguro: main.querySelector('.mc-seguro'), marco: main.querySelector('.mc-marco'), nota: main.querySelector('.mc-nota'),
      texto: main.querySelector('#mc-texto'), estado: main.querySelector('.mc-estado'), uno: main.querySelector('[data-acc="compartir"]'),
      quitar: main.querySelector('.mc-quitar')
    };
    main.querySelector('#mc-dorsal').value = S.pref.dorsal;
    main.querySelector('#mc-lema').value = S.pref.lema;
    main.querySelector('#mc-completo').checked = S.pref.nombreCompleto;
    main.querySelector('#mc-pos').checked = S.pref.verPosicion;
    main.querySelector('#mc-niv').checked = S.pref.verNivel;
    if (!S.base.posicion) main.querySelector('#mc-pos').closest('label').hidden = true;
    if (!S.base.nivel) main.querySelector('#mc-niv').closest('label').hidden = true;

    function marcar(grupo, b) {
      grupo.querySelectorAll('[role="radio"]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
    }
    var gRedes = main.querySelector('.mc-redes');
    gRedes.addEventListener('click', function (e) {
      var b = e.target.closest('.mc-red'); if (!b) return;
      S.red = REDES.filter(function (r) { return r.id === b.dataset.red; })[0];
      S.modo = S.red.modos[0];
      marcar(gRedes, b);
      pintarModos(); S.el.texto.value = texto(S.red, datos()); actualizar();
    });
    S.el.modos.addEventListener('click', function (e) {
      var b = e.target.closest('.mc-modo'); if (!b) return;
      S.modo = S.red.modos.filter(function (m) { return m.id === b.dataset.modo; })[0];
      marcar(S.el.modos, b);
      actualizar();
    });
    [gRedes, S.el.modos].forEach(function (g) {
      g.addEventListener('keydown', function (e) {
        if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].indexOf(e.key) < 0) return;
        var bs = [].slice.call(g.querySelectorAll('[role="radio"]')), i = bs.indexOf(document.activeElement);
        if (i < 0) return; e.preventDefault();
        var n = bs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length];
        n.click(); n.focus();
      });
    });
    function cambio() {
      var dor = main.querySelector('#mc-dorsal');
      dor.value = dor.value.replace(/\D/g, '').slice(0, 2);
      S.pref.dorsal = dor.value;
      S.pref.lema = main.querySelector('#mc-lema').value.trim();
      S.pref.nombreCompleto = main.querySelector('#mc-completo').checked;
      S.pref.verPosicion = main.querySelector('#mc-pos').checked;
      S.pref.verNivel = main.querySelector('#mc-niv').checked;
      guardarPrefs();
      S.el.texto.value = texto(S.red, datos());
      actualizar();
    }
    var campos = main.querySelector('.mc-campos');
    campos.addEventListener('input', function (e) { if (e.target.id !== 'mc-foto') cambio(); });
    campos.addEventListener('change', function (e) { if (e.target.type === 'checkbox') cambio(); });
    main.querySelector('#mc-foto').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      cargarImagen(URL.createObjectURL(f)).then(function (im) {
        S.foto = im; S.el.quitar.hidden = !im;
        if (!im) avisar('No se ha podido abrir esa imagen. Prueba con un JPG o PNG.');
        actualizar();
      });
    });
    S.el.quitar.addEventListener('click', function () { S.foto = null; S.el.quitar.hidden = true; main.querySelector('#mc-foto').value = ''; actualizar(); });
    main.querySelector('.mc-acciones').addEventListener('click', function (e) {
      var b = e.target.closest('[data-acc]'); if (!b) return;
      if (b.dataset.acc === 'compartir') compartir();
      else if (b.dataset.acc === 'descargar') generar().then(descargar).then(function () { avisar('Imagen descargada (' + S.modo.w + ' × ' + S.modo.h + ').'); });
      else copiarTexto().then(function (ok) { avisar(ok ? 'Texto copiado.' : 'No se ha podido copiar. Selecciónalo y cópialo a mano.'); });
    });

    pintarModos();
    S.el.texto.value = texto(S.red, datos());
    cargarFuentes().then(actualizar);
  }

  function datos() {
    var b = S.base;
    return {
      nombre: S.pref.nombreCompleto ? b.completo : b.corto,
      posicion: S.pref.verPosicion ? b.posicion : '',
      nivel: S.pref.verNivel ? b.nivel : '',
      rango: b.rango, aspecto: b.aspecto, temporada: b.temporada,
      dorsal: S.pref.dorsal, lema: S.pref.lema
    };
  }

  function pintarModos() {
    S.el.modos.innerHTML = S.red.modos.map(function (m) {
      var si = m === S.modo;
      return '<button type="button" role="radio" class="mc-modo" data-modo="' + m.id + '" aria-checked="' + si + '" tabindex="' + (si ? 0 : -1) + '"><b>' + esc(m.n) + '</b><span>' + m.w + ' × ' + m.h + '</span></button>';
    }).join('');
    var nativo = !!(navigator.canShare && navigator.share);
    S.el.uno.innerHTML = LOGO[S.red.id].replace('width="22" height="22"', 'width="18" height="18"') +
      (nativo ? 'Compartir en ' + esc(S.red.n) : (S.red.abrir ? 'Descargar y abrir ' + esc(S.red.n) : 'Descargar para ' + esc(S.red.n)));
  }

  var turno = 0;
  function actualizar() {
    var d = datos(), vez = ++turno, img = S.foto;
    var cc = S.el.carta.getContext('2d');
    cc.clearRect(0, 0, 800, 1131);
    dibujarCarta(cc, 0, 0, 800, d, img, false);
    var lz = document.createElement('canvas');
    componer(lz, S.modo, d, img);
    S.lienzo = lz;
    lz.toBlob(function (b) {
      if (vez !== turno || !b) return;
      if (S.urlVista) URL.revokeObjectURL(S.urlVista);
      S.urlVista = URL.createObjectURL(b);
      S.el.img.src = S.urlVista;
      S.el.img.alt = 'Vista previa para ' + S.red.n + ', ' + S.modo.n;
    }, 'image/png');
    S.el.marco.style.aspectRatio = S.modo.w + ' / ' + S.modo.h;
    S.el.marco.classList.toggle('is-ancho', S.modo.w > S.modo.h);
    var Z = S.modo.z;
    S.el.seguro.style.top = (Z.t / S.modo.h * 100) + '%';
    S.el.seguro.style.bottom = (Z.b / S.modo.h * 100) + '%';
    S.el.seguro.style.left = (Z.l / S.modo.w * 100) + '%';
    S.el.seguro.style.right = (Z.r / S.modo.w * 100) + '%';
    S.el.nota.textContent = S.modo.nota + ' La línea discontinua marca la zona que la app no tapa.';
  }

  function generar() {
    return new Promise(function (ok) { S.lienzo.toBlob(function (b) { ok(b); }, 'image/png'); });
  }
  function nombreArchivo() { return 'carta-dragons-den-' + S.red.id + '-' + S.modo.id + '.png'; }
  function descargar(blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombreArchivo();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function copiarTexto() {
    var t = S.el.texto.value;
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return false; });
    return Promise.resolve(false);
  }
  function avisar(t) { S.el.estado.textContent = ''; setTimeout(function () { S.el.estado.textContent = t; }, 30); }

  function compartir() {
    generar().then(function (blob) {
      var file = new File([blob], nombreArchivo(), { type: 'image/png' });
      var t = S.el.texto.value;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Instagram y TikTok ignoran el texto al recibir una imagen: va también al portapapeles.
        return copiarTexto().then(function () {
          return navigator.share({ files: [file], text: t, title: 'Mi carta de Dragons Den' });
        }).then(function () {
          avisar('Listo. El texto está copiado por si la app no lo pone sola.');
        }, function (err) {
          if (err && err.name === 'AbortError') return;
          descargar(blob); avisar('Tu navegador no ha dejado compartir: la imagen se ha descargado.');
        });
      }
      descargar(blob);
      return copiarTexto().then(function (ok) {
        var url = S.red.abrir ? S.red.abrir(t) : S.red.web;
        if (url) window.open(url, '_blank', 'noopener');
        avisar('Imagen descargada' + (ok ? ' y texto copiado' : '') + '. ' +
          (S.red.abrir ? 'Adjunta la imagen en la ventana de ' + S.red.n + ' que se ha abierto.' : 'Súbela desde la app de ' + S.red.n + ' o desde su web.'));
      });
    });
  }

  window.DDMiCarta = { pintar: pintar, REDES: REDES, componer: componer, dibujarCarta: dibujarCarta, cargarFuentes: cargarFuentes };
})();
