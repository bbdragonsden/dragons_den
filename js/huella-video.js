/*
 * Huella de un vídeo de prueba, calculada en el navegador antes de subirlo:
 *  - sha256: detecta el mismo archivo subido dos veces (el servidor lo vuelve
 *    a calcular al recibirlo, así que no se puede falsear).
 *  - firma: 4 dHash de 64 bits (uno por fotograma, al 15, 40, 65 y 90 % del
 *    vídeo). Detecta el mismo vídeo recortado o reenviado por WhatsApp.
 *  - duracion_seg y grabado_en (fecha interna del MP4/MOV, si la trae).
 */
(function () {
  'use strict';

  function hex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  async function sha256(file) {
    var buf = await file.arrayBuffer();
    return hex(await crypto.subtle.digest('SHA-256', buf));
  }

  // Fecha de creación de la caja 'mvhd' (segundos desde 1904-01-01).
  async function fechaInterna(file) {
    var trozos = [file.slice(0, 1048576)];
    if (file.size > 1048576) trozos.push(file.slice(Math.max(0, file.size - 1048576)));
    for (var t = 0; t < trozos.length; t++) {
      var b = new Uint8Array(await trozos[t].arrayBuffer());
      for (var i = 0; i < b.length - 24; i++) {
        if (b[i] === 0x6d && b[i + 1] === 0x76 && b[i + 2] === 0x68 && b[i + 3] === 0x64) {
          var dv = new DataView(b.buffer, b.byteOffset + i + 4);
          var version = dv.getUint8(0);
          var seg = version === 1 ? Number(dv.getBigUint64(4)) : dv.getUint32(4);
          if (!seg) return null;
          var ms = (seg - 2082844800) * 1000;
          if (ms < Date.UTC(2015, 0, 1) || ms > Date.now() + 86400000) return null;
          return new Date(ms).toISOString();
        }
      }
    }
    return null;
  }

  function cargar(video, url) {
    return new Promise(function (ok, mal) {
      video.onloadedmetadata = function () { ok(); };
      video.onerror = function () { mal(new Error('No se puede leer el vídeo')); };
      video.src = url;
    });
  }
  function irA(video, t) {
    return new Promise(function (ok) {
      var listo = function () { video.removeEventListener('seeked', listo); ok(); };
      video.addEventListener('seeked', listo);
      video.currentTime = t;
      setTimeout(listo, 2500);
    });
  }

  function dhash(ctx, video) {
    ctx.drawImage(video, 0, 0, 9, 8);
    var d = ctx.getImageData(0, 0, 9, 8).data;
    var gris = [];
    for (var p = 0; p < 72; p++) gris.push(d[p * 4] * 0.299 + d[p * 4 + 1] * 0.587 + d[p * 4 + 2] * 0.114);
    var bits = '';
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) bits += gris[y * 9 + x] > gris[y * 9 + x + 1] ? '1' : '0';
    var out = '';
    for (var k = 0; k < 64; k += 4) out += parseInt(bits.slice(k, k + 4), 2).toString(16);
    return out;
  }

  async function huella(file) {
    var url = URL.createObjectURL(file);
    var video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    try {
      await cargar(video, url);
      var dur = video.duration;
      if (!isFinite(dur)) {           // algunos webm no traen duración hasta el final
        await irA(video, 1e6);
        dur = video.currentTime;
      }
      var canvas = document.createElement('canvas');
      canvas.width = 9; canvas.height = 8;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      var firma = '';
      var puntos = [0.15, 0.4, 0.65, 0.9];
      for (var i = 0; i < puntos.length; i++) {
        await irA(video, Math.max(0.05, dur * puntos[i]));
        firma += dhash(ctx, video);
      }
      var res = await Promise.all([sha256(file), fechaInterna(file)]);
      return {
        sha256: res[0],
        firma: firma,
        duracion_seg: Math.round(dur * 100) / 100,
        grabado_en: res[1],
        bytes: file.size,
        mime: file.type || 'video/mp4',
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  window.DDHuella = { huella: huella };
})();
