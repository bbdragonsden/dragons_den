/*
 * Panel de revisión del entrenador: comentarios y pruebas en vídeo pendientes,
 * validación de sesiones de Dragons Den, alertas y resumen por jugador.
 * En local, ?demo=1 funciona sin servidor.
 */
(function () {
  'use strict';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var DEMO = LOCAL && /[?&]demo=1/.test(location.search);
  var sb = !DEMO && window.supabase ? window.supabase.createClient('https://oyuhyrzjhaqzawwnmwcv.supabase.co', 'sb_publishable_W4UBtORpWtWnKGzw-x9VbA_gPsDQfzQ') : null;
  var $ = function (id) { return document.getElementById(id); };
  var D = null;
  var CAUSAS = { tecnica: 'técnica', decision: 'decisiones', cansancio: 'cansancio', concentracion: 'concentración', nervios: 'nervios', externo: 'algo externo' };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fecha(f) { return new Date(String(f).length === 10 ? f + 'T12:00:00Z' : f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }); }

  async function api(metodo, cuerpo) {
    if (DEMO) return demo(metodo, cuerpo);
    var s = await sb.auth.getSession();
    if (!s.data.session) { location.href = '/login.html'; throw new Error('sin sesión'); }
    var r = await fetch('/api/checkin' + (metodo === 'GET' ? '?vista=revision' : ''), {
      method: metodo,
      headers: Object.assign({ Authorization: 'Bearer ' + s.data.session.access_token }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || 'Algo ha fallado');
    return j;
  }

  function item(x) {
    var pf = x.prefiltro || {};
    var h = '<article class="rv-item" data-id="' + x.id + '"><div class="rv-cab"><b>' + esc(x.jugador.nombre) + '</b><small>' +
      (x.tipo === 'prueba_video' ? 'Prueba en vídeo' : 'Comentario') + ' · ' + fecha(x.created_at) + (x.estado === 'repetido' ? ' · marcada como repetida' : '') + '</small></div>';
    if (x.tipo === 'prueba_video') {
      h += x.video_url
        ? '<video class="rv-video" src="' + esc(x.video_url) + '" controls playsinline preload="metadata"></video>'
        : '<p class="ci-vacio">El vídeo ya no está disponible.</p>';
      h += '<p class="rv-codigo">Debe verse el código <strong>' + esc(x.codigo) + '</strong> y el gesto <strong>' + esc(x.gesto) + '</strong> · ' + (x.video_duracion || '?') + ' s</p>';
    } else {
      h += '<p class="rv-texto">' + esc(x.texto) + '</p>';
    }
    h += '<div class="rv-pf"><b class="' + esc(pf.sugerencia || 'revisar') + '">' + esc(pf.sugerencia || 'revisar') + ' · ' + (pf.puntos != null ? pf.puntos : '–') + '</b>' +
      (pf.motivos && pf.motivos.length ? '<span>' + pf.motivos.map(esc).join(' · ') + '</span>' : '<span>Sin avisos</span>') + '</div>';
    h += '<label class="ci-label" for="nota-' + x.id + '" style="margin:0">Nota para el jugador (opcional)</label><input class="ci-input" id="nota-' + x.id + '" maxlength="300">';
    h += '<div class="rv-acciones"><button class="ci-btn ci-btn--ok ci-btn--peq" data-dec="aprobar" type="button">Aprobar (+' + x.xp_si_aprueba + ' XP)</button>' +
      '<button class="ci-btn ci-btn--mal ci-btn--peq" data-dec="rechazar" type="button">Rechazar</button>' +
      (x.tipo === 'prueba_video' ? '<button class="ci-btn ci-btn--mal ci-btn--peq" data-dec="repetido" type="button">Repetida o falsa</button>' : '') + '</div></article>';
    return h;
  }

  function pintar() {
    $('rv-cargando').classList.add('ci-oculto');
    $('n-pend').textContent = D.pendientes.length;
    $('n-val').textContent = D.sin_validar.length;
    $('n-ale').textContent = D.alertas.length;
    $('n-jug').textContent = D.jugadores.length;
    var rec = D.recompensas || [];
    $('n-rec').textContent = rec.length;
    $('rv-rec').innerHTML = rec.length ? rec.map(function (r) {
      return '<tr data-rec="' + r.id + '"><td>' + esc(r.jugador.nombre) + '</td><td>' + esc(r.nivel + ' · ' + (r.nivel_nombre || '')) + '</td><td>' + esc(r.titulo) + '</td><td><span class="rv-estado">' + esc(r.estado) + '</span></td><td><div class="rv-acciones">' +
        (r.estado === 'pendiente' ? '<button class="ci-btn ci-btn--sec ci-btn--peq" data-est="preparada" type="button">Preparada</button>' : '') +
        '<button class="ci-btn ci-btn--ok ci-btn--peq" data-est="entregada" type="button">Entregada</button><button class="ci-link" data-est="rechazada" type="button">Descartar</button></div></td></tr>';
    }).join('') : '<tr><td colspan="5" class="ci-vacio">No hay recompensas por entregar.</td></tr>';
    var cj = D.canjes || [];
    $('n-rec').textContent = rec.length + cj.length;
    $('rv-canjes').innerHTML = cj.length ? cj.map(function (c) {
      return '<tr data-canje="' + c.id + '"><td>' + esc(c.jugador.nombre) + '</td><td>' + esc(c.nombre) + '</td><td class="ci-num">' + c.escamas + '</td><td>' + fecha(c.created_at) + '</td><td><div class="rv-acciones"><button class="ci-btn ci-btn--ok ci-btn--peq" data-cest="entregado" type="button">Entregado</button><button class="ci-link" data-cest="rechazado" type="button">Rechazar</button></div></td></tr>';
    }).join('') : '<tr><td colspan="5" class="ci-vacio">No hay canjes pendientes.</td></tr>';
    if (D.temporada) $('rv-xp-tope').textContent = 'Los aceleradores (hitos, métricas, referidos) tienen un tope de ' + D.temporada.tope_aceleradores + ' XP por jugador en la ' + D.temporada.nombre + '. Pasado el tope no suman.';
    $('prot-jug').innerHTML = D.jugadores.map(function (j) { return '<option value="' + esc(j.user_id) + '">' + esc(j.jugador.nombre) + '</option>'; }).join('');
    $('xp-jug').innerHTML = D.jugadores.map(function (j) { return '<option value="' + esc(j.user_id) + '">' + esc(j.jugador.nombre) + '</option>'; }).join('');
    $('xp-fuente').innerHTML = (D.fuentes_manuales || []).map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.nombre) + ' (+' + f.xp + ')</option>'; }).join('');
    $('rv-pend').innerHTML = D.pendientes.length ? D.pendientes.map(item).join('') : '<p class="ci-vacio">No hay nada pendiente.</p>';
    $('rv-val').innerHTML = D.sin_validar.length ? D.sin_validar.map(function (c) {
      return '<tr><td><input type="checkbox" class="rv-sel" value="' + c.id + '" aria-label="Validar sesión de ' + esc(c.jugador.nombre) + ' del ' + fecha(c.fecha) + '"></td><td>' + esc(c.jugador.nombre) + '</td><td>' + fecha(c.fecha) + '</td><td>' + (c.tipo === 'partido' ? 'Partido' : 'Entreno') + '</td><td class="ci-num">' + c.duracion_min + '</td><td class="ci-num">' + c.rpe + '/10</td></tr>';
    }).join('') : '<tr><td colspan="6" class="ci-vacio">Todas las sesiones están validadas.</td></tr>';
    $('rv-ale').innerHTML = D.alertas.length ? D.alertas.map(function (a) {
      return '<tr><td>' + esc(a.jugador.nombre) + '</td><td>' + fecha(a.fecha) + '</td><td><span class="rv-nivel ' + esc(a.nivel) + '" aria-hidden="true"></span>' + esc(a.texto) + '</td></tr>';
    }).join('') : '<tr><td colspan="3" class="ci-vacio">Sin alertas en los últimos 14 días.</td></tr>';
    $('rv-jug').innerHTML = D.jugadores.length ? D.jugadores.map(function (j) {
      var rel = j.semana.relacion;
      return '<tr><td>' + esc(j.jugador.nombre) + '</td><td class="ci-num">' + j.sesiones + '</td><td class="ci-num">' + j.semana.carga_semana + '</td><td class="ci-num"' + (rel >= 1.5 ? ' style="color:var(--warn)"' : '') + '>' + (rel ? Math.round(rel * 100) + ' %' : '–') + '</td><td class="ci-num">' + (j.forma == null ? '–' : j.forma.toFixed(1)) + '</td><td>' + (j.xp != null ? j.xp + ' · ' + esc(j.nivel) + (D.temporada ? '<br><small style="color:var(--muted)">Aceleradores ' + (j.aceleradores || 0) + '/' + D.temporada.tope_aceleradores + '</small>' : '') : '–') + '</td><td>' + esc(j.ultimo && j.ultimo.proximo || '–') + (j.ultimo && j.ultimo.causa ? '<br><small style="color:var(--muted)">Le costó por ' + CAUSAS[j.ultimo.causa] + '</small>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="ci-vacio">Sin check-ins en los últimos 14 días.</td></tr>';
  }

  async function decidir(art, dec) {
    var id = art.dataset.id;
    art.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    try {
      await api('POST', { accion: 'revisar', id: id, decision: dec, nota: $('nota-' + id).value, sancionar: dec === 'repetido' });
      D.pendientes = D.pendientes.filter(function (x) { return x.id !== id; });
      art.style.opacity = '0';
      setTimeout(pintar, 200);
    } catch (e) {
      $('rv-error').textContent = e.message;
      art.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
    }
  }

  function tabs() {
    var lista = Array.prototype.slice.call(document.querySelectorAll('.rv-tab'));
    function activar(t) {
      lista.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        $(x.getAttribute('aria-controls')).hidden = !on;
      });
    }
    lista.forEach(function (t, i) {
      t.addEventListener('click', function () { activar(t); });
      t.addEventListener('keydown', function (ev) {
        var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        var n = lista[(i + d + lista.length) % lista.length];
        activar(n); n.focus();
      });
    });
  }

  function enlazar() {
    tabs();
    $('rv-pend').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-dec]');
      if (b) decidir(b.closest('.rv-item'), b.dataset.dec);
    });
    $('rv-aprobar-sugeridos').addEventListener('click', async function () {
      var ok = D.pendientes.filter(function (x) { return x.tipo !== 'prueba_video' && x.prefiltro && x.prefiltro.sugerencia === 'aprobar'; });
      for (var i = 0; i < ok.length; i++) {
        var art = document.querySelector('.rv-item[data-id="' + ok[i].id + '"]');
        if (art) await decidir(art, 'aprobar');
      }
    });
    var sel = function () { return Array.prototype.slice.call(document.querySelectorAll('.rv-sel:checked')).map(function (c) { return c.value; }); };
    $('rv-val').addEventListener('change', function () { $('rv-validar').disabled = !sel().length; });
    $('rv-todas').addEventListener('click', function () {
      document.querySelectorAll('.rv-sel').forEach(function (c) { c.checked = true; });
      $('rv-validar').disabled = !sel().length;
    });
    $('rv-rec').addEventListener('click', async function (ev) {
      var b = ev.target.closest('[data-est]');
      if (!b) return;
      var tr = b.closest('tr'), id = tr.dataset.rec;
      b.disabled = true;
      try {
        await api('POST', { accion: 'recompensa', id: id, estado: b.dataset.est });
        var r = D.recompensas.find(function (x) { return x.id === id; });
        if (b.dataset.est === 'preparada') r.estado = 'preparada';
        else D.recompensas = D.recompensas.filter(function (x) { return x.id !== id; });
        pintar();
      } catch (e) { $('rv-error').textContent = e.message; b.disabled = false; }
    });
    $('rv-canjes').addEventListener('click', async function (ev) {
      var b = ev.target.closest('[data-cest]');
      if (!b) return;
      var id = b.closest('tr').dataset.canje;
      b.disabled = true;
      try {
        await api('POST', { accion: 'canje', id: id, estado: b.dataset.cest });
        D.canjes = D.canjes.filter(function (x) { return x.id !== id; });
        pintar();
      } catch (e) { $('rv-error').textContent = e.message; b.disabled = false; }
    });
    $('rv-prot-form').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      $('rv-prot-ok').textContent = '';
      var btn = this.querySelector('button'); btn.disabled = true;
      try {
        var out = await api('POST', { accion: 'proteger', user_id: $('prot-jug').value, fecha: $('prot-fecha').value, nota: $('prot-nota').value });
        $('rv-prot-ok').textContent = 'Semana del ' + fecha(out.semana || $('prot-fecha').value) + ' protegida.';
        $('prot-nota').value = '';
      } catch (e) { $('rv-error').textContent = e.message; }
      btn.disabled = false;
    });
    $('rv-xp-form').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      $('rv-xp-ok').textContent = '';
      var btn = this.querySelector('button'); btn.disabled = true;
      try {
        var out = await api('POST', { accion: 'dar_xp', user_id: $('xp-jug').value, fuente: $('xp-fuente').value, nota: $('xp-nota').value });
        $('rv-xp-ok').textContent = out.xp ? 'Hecho: +' + out.xp + ' XP.' : (out.aviso || 'No se ha sumado XP.');
        $('xp-nota').value = '';
      } catch (e) { $('rv-error').textContent = e.message; }
      btn.disabled = false;
    });
    $('rv-validar').addEventListener('click', async function () {
      var ids = sel();
      this.disabled = true;
      try {
        await api('POST', { accion: 'validar', ids: ids });
        D.sin_validar = D.sin_validar.filter(function (c) { return ids.indexOf(c.id) < 0; });
        pintar();
      } catch (e) { $('rv-error').textContent = e.message; }
    });
  }

  async function iniciar() {
    try {
      D = await api('GET');
      pintar();
      enlazar();
    } catch (e) {
      $('rv-cargando').textContent = e.message === 'Solo el entrenador' ? 'Esta página es solo para el entrenador.' : 'No se ha podido cargar. Recarga la página.';
    }
  }

  function demo(metodo) {
    var hoy = new Date().toISOString();
    var J = function (n) { return { nombre: n, email: '' }; };
    return new Promise(function (ok) {
      setTimeout(function () {
        if (metodo !== 'GET') return ok({ ok: true, xp: 150, semana: '2026-11-09' });
        ok({
          pendientes: [
            { id: 'p1', tipo: 'comentario_checkin', jugador: J('Naomi C.'), created_at: hoy, xp_si_aprueba: 5, texto: 'Hoy he fallado muchos tiros libres al final porque llegaba cansada, pero en defensa he hablado en todos los bloqueos.', prefiltro: { puntos: 95, sugerencia: 'aprobar', motivos: [] } },
            { id: 'p2', tipo: 'comentario_checkin', jugador: J('Jugador de ejemplo'), created_at: hoy, xp_si_aprueba: 5, texto: 'bien bien bien bien bien', prefiltro: { puntos: 10, sugerencia: 'rechazar', motivos: ['Palabras repetidas', 'No habla de la sesión'] } },
            { id: 'p3', tipo: 'prueba_video', jugador: J('Naomi C.'), created_at: hoy, xp_si_aprueba: 5, codigo: '47', gesto: '3 dedos', video_duracion: 5.2, video_url: null, prefiltro: { puntos: 70, sugerencia: 'revisar', motivos: [] } },
          ],
          sin_validar: [{ id: 's1', jugador: J('Naomi C.'), fecha: hoy.slice(0, 10), tipo: 'entreno', duracion_min: 60, rpe: 6 }, { id: 's2', jugador: J('Jugador de ejemplo'), fecha: hoy.slice(0, 10), tipo: 'entreno', duracion_min: 60, rpe: 5 }],
          alertas: [{ jugador: J('Jugador de ejemplo'), fecha: hoy.slice(0, 10), nivel: 'alta', texto: 'Molestia que le ha limitado (tobillo)' }],
          jugadores: [{ user_id: '11111111-1111-4111-8111-111111111111', jugador: J('Naomi C.'), sesiones: 6, semana: { carga_semana: 1820, relacion: 1.6 }, forma: 3.8, xp: 1240, aceleradores: 150, nivel: 'Sexto Hombre', ultimo: { proximo: 'Botar con la cabeza levantada', causa: 'cansancio' } }],
          recompensas: [{ id: 'rc1', jugador: J('Naomi C.'), nivel: 4, nivel_nombre: 'Sexto Hombre', titulo: 'Un análisis de vídeo extra de 15 minutos', estado: 'pendiente' }],
          temporada: { id: '2026-27', nombre: 'Temporada 2026-27', tope_aceleradores: 600 },
          canjes: [{ id: 'cj1', jugador: J('Naomi C.'), nombre: 'Capitán de una sesión', escamas: 10, created_at: hoy }],
          fuentes_manuales: [{ id: 'sesion_pista', nombre: 'Sesión en pista (la marca el entrenador)', xp: 25 }, { id: 'hito_tecnico', nombre: 'Hito técnico conseguido (lo marca el entrenador)', xp: 150 }],
        });
      }, 250);
    });
  }

  iniciar();
})();
