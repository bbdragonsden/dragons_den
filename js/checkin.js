/*
 * Check-in tras entrenar o jugar. Lee el catálogo de /data/checkin.json y
 * habla con /api/checkin. En local, ?demo=1 funciona sin servidor.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://oyuhyrzjhaqzawwnmwcv.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_W4UBtORpWtWnKGzw-x9VbA_gPsDQfzQ';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var DEMO = LOCAL && /[?&]demo=1/.test(location.search);
  var sb = !DEMO && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  var $ = function (id) { return document.getElementById(id); };
  var CAT = null;     // catálogo
  var EST = null;     // estado del jugador
  var R = {};         // respuestas en curso
  var PASOS = [];
  var paso = 0;
  var ultimo = null;  // check-in guardado
  var DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── API ───────────────────────────────────────────────────────────────
  async function token() {
    var s = await sb.auth.getSession();
    return s.data && s.data.session ? s.data.session.access_token : null;
  }
  async function api(metodo, cuerpo) {
    if (DEMO) return demo(metodo, cuerpo);
    var t = await token();
    if (!t) { location.href = '/login.html'; throw new Error('sin sesión'); }
    var r = await fetch('/api/checkin', {
      method: metodo,
      headers: Object.assign({ Authorization: 'Bearer ' + t }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(j.error || 'Algo ha fallado'); e.datos = j; throw e; }
    return j;
  }

  // ── Inicio ────────────────────────────────────────────────────────────
  function lunesDe(fechaTxt) {
    var d = new Date(fechaTxt + 'T12:00:00Z');
    var dia = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - dia * 86400000);
  }
  function pintarInicio() {
    var hoy = EST.hoy;
    var lun = lunesDe(hoy);
    var porDia = {};
    EST.historial.forEach(function (c) { porDia[c.fecha] = (porDia[c.fecha] || 0) + 1; });
    var html = '';
    for (var i = 0; i < 7; i++) {
      var f = new Date(lun.getTime() + i * 86400000).toISOString().slice(0, 10);
      var n = porDia[f] || 0;
      html += '<div class="ci-dia' + (n ? ' tiene' : '') + (f === hoy ? ' hoy' : '') + '"><small>' + DIAS[i] + '</small><span><span aria-hidden="true">' + (n || '') + '</span><span class="sr-only">' + (n ? n + (n === 1 ? ' sesión' : ' sesiones') : 'sin sesión') + '</span></span></div>';
    }
    $('ci-semana').innerHTML = html;

    var s = EST.semana || {};
    var forma = EST.forma == null ? '–' : EST.forma.toFixed(1);
    $('ci-datos').innerHTML =
      '<div><b class="ci-num">' + (s.sesiones_semana || 0) + '</b><span>Sesiones esta semana</span></div>' +
      '<div><b class="ci-num">' + (s.carga_semana || 0) + '</b><span>Carga semanal</span></div>' +
      '<div><b class="ci-num">' + forma + '</b><span>Forma (de 5)</span></div>';

    if (EST.foco_actual) { $('ci-foco').classList.remove('ci-oculto'); $('ci-foco').querySelector('p').textContent = EST.foco_actual; }

    if (!EST.bienestar) {
      $('ci-consent').classList.remove('ci-oculto');
      $('ci-consent-texto').textContent = CAT.consentimiento_bienestar.texto;
    }

    pintarProgreso();
    pintarCrecimiento();
    pintarEquipos();
    pintarHistorial();
  }

  function pintarProgreso() {
    var p = EST.progreso;
    if (!p) return;
    $('ci-xp').classList.remove('ci-oculto');
    var t = p.temporada || {};
    $('ci-xp-nivel').textContent = 'Nivel ' + p.nivel.numero + ' · ' + p.nivel.nombre;
    var barra = $('ci-xp-barra');
    barra.setAttribute('aria-valuenow', String(p.pct));
    barra.setAttribute('aria-valuetext', p.pct + ' % hasta el siguiente nivel');
    requestAnimationFrame(function () { barra.querySelector('i').style.transform = 'scaleX(' + Math.max(0, Math.min(1, p.pct / 100)) + ')'; });
    var fmt = function (f) { return new Date(f + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }); };
    var sig;
    if (!t.en_curso && t.inicio && EST.hoy < t.inicio) sig = 'La ' + (t.nombre || 'temporada') + ' empieza el ' + fmt(t.inicio) + '. Desde ese lunes, cada semana cuenta.';
    else if (p.bloqueado_hasta) sig = 'Ya tienes el XP de Leyenda del Den. Se corona a partir del ' + fmt(p.bloqueado_hasta) + ': aguanta hasta el final.';
    else if (p.siguiente) sig = 'Te faltan ' + p.siguiente.faltan + ' XP para ' + p.siguiente.nombre + (p.siguiente.recompensa ? '. Recompensa: ' + p.siguiente.recompensa + '.' : '.');
    else sig = 'Has llegado al nivel más alto de la temporada.';
    $('ci-xp-sig').textContent = sig;
    if (t.en_curso && p.proyeccion) {
      $('ci-xp-proy').innerHTML = 'Quedan ' + t.semanas_quedan + ' semanas. A tu ritmo de las últimas 4, acabas la temporada en <b>' + esc(p.proyeccion.nombre) + '</b>.' + (p.proyeccion.nivel < 9 ? ' Leyenda del Den pide no fallar casi ninguna semana.' : '');
    }
    $('ci-semanas').innerHTML = (p.semanas || []).map(function (w) {
      var txt = { cumplida: 'Semana Dragón', protegida: 'protegida', comodin: 'salvada con comodín', fallada: 'sin cumplir', en_curso: 'en curso' }[w.estado];
      return '<li class="' + w.estado + '" title="' + fmt(w.lunes) + ': ' + txt + '"><span class="sr-only">Semana del ' + fmt(w.lunes) + ': ' + txt + '</span></li>';
    }).join('');
    var sa = p.semana_actual || {};
    $('ci-xp-datos').innerHTML =
      '<div><b class="ci-num">' + p.xp + '</b><span>XP</span></div>' +
      '<div><b class="ci-num">' + p.racha + '</b><span>Semanas Dragón seguidas</span></div>' +
      '<div><b class="ci-num">' + (p.comodines || 0) + '</b><span>Comodines</span></div>';
    $('ci-logros').innerHTML = (p.aspecto ? '<li class="si">' + esc(p.aspecto.nombre) + '</li>' : '') + (p.logros || []).map(function (l) {
      return '<li class="' + (l.conseguido ? 'si' : '') + '">' + esc(l.nombre) + (l.conseguido ? '' : ' · ' + Math.min(l.valor, l.minimo) + '/' + l.minimo) + '<span class="sr-only">' + (l.conseguido ? ', conseguido' : ', pendiente') + '</span></li>';
    }).join('') + (p.temporadas_anteriores || []).map(function (a) { return '<li class="si">' + esc(a.nombre) + ' ' + esc(a.temporada) + '</li>'; }).join('');
    pintarTienda();
  }

  function pintarTienda() {
    var p = EST.progreso;
    if (!p || !p.escamas || !(EST.tienda || []).length) return;
    $('ci-tienda').classList.remove('ci-oculto');
    $('ci-escamas').textContent = p.escamas.saldo;
    var pend = {};
    (EST.canjes || []).forEach(function (c) { if (c.estado === 'pendiente') pend[c.item] = (pend[c.item] || 0) + 1; });
    $('ci-tienda-lista').innerHTML = EST.tienda.map(function (it) {
      var puede = p.escamas.saldo >= it.escamas;
      return '<li><div><b>' + esc(it.nombre) + '</b><small>' + it.escamas + ' Escamas' + (it.detalle ? ' · ' + esc(it.detalle) : '') + (pend[it.id] ? ' · Pedido, pendiente de entrega' : '') + '</small></div>' +
        '<button class="ci-btn ci-btn--sec ci-btn--peq" type="button" data-canje="' + esc(it.id) + '"' + (puede ? '' : ' disabled') + ' aria-label="Canjear ' + esc(it.nombre) + ' por ' + it.escamas + ' Escamas">' + (puede ? 'Canjear' : 'Faltan ' + (it.escamas - p.escamas.saldo)) + '</button></li>';
    }).join('');
  }

  function pintarCrecimiento() {
    if (!EST.bienestar) return;
    var c = EST.crecimiento || {};
    $('ci-crec').classList.remove('ci-oculto');
    var t = 'Mídete descalzo, de espaldas a la pared, una vez al mes. Si creces muy rápido (un estirón), tu cuerpo necesita otra carga y otros ejercicios.';
    var h = '<span>' + esc(t) + '</span>';
    if (c.ultima) h += '<span class="ci-crec-dato">' + Number(c.ultima.estatura_cm).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' cm</span><small style="color:var(--muted)">Última medida: ' + new Date(c.ultima.fecha + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) + '</small>';
    if (c.cm_anio != null) {
      h += '<br><small>Ritmo: ' + Number(c.cm_anio).toLocaleString('es-ES') + ' cm al año</small>';
      if (c.cm_anio >= ((CAT.mediciones || {}).umbral_estiron_cm_anio || 7)) h += '<p class="ci-crec-alerta">Estás en pleno estirón. Es normal, pero tendones y cartílagos están más sensibles: más técnica y coordinación, menos saltos repetidos y sprints, y cuenta cualquier molestia en rodillas o talones.</p>';
    }
    $('ci-crec-texto').innerHTML = h;
  }

  function pintarEquipos() {
    var cont = $('ci-equipos');
    if (!EST.equipos.length) { cont.innerHTML = '<p class="ci-vacio">Añade los equipos con los que entrenas o juegas. Si estás en dos, añade los dos.</p>'; return; }
    var tipos = { dragons_den: 'Dragons Den', club: 'Club', seleccion: 'Selección', otro: 'Otro' };
    cont.innerHTML = EST.equipos.map(function (e) {
      return '<span class="ci-equipo">' + esc(e.nombre) + ' <small style="color:var(--muted)">· ' + tipos[e.tipo] + '</small>' +
        '<button type="button" data-baja="' + e.id + '" aria-label="Quitar ' + esc(e.nombre) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>';
    }).join('');
  }

  function estadoSesion(c) {
    var pr = EST.revisiones.find(function (r) { return r.checkin_id === c.id && r.tipo === 'prueba_video'; });
    if (c.validado_por !== 'sin_validar') return ['Validada', 'ok'];
    if (pr && pr.estado === 'pendiente') return ['En revisión', 'rev'];
    if (pr && (pr.estado === 'rechazado' || pr.estado === 'repetido')) return ['Prueba rechazada', 'mal'];
    if (c.equipo_tipo === 'dragons_den') return ['La valida tu entrenador', ''];
    return ['Sin prueba', ''];
  }
  function pintarHistorial() {
    var ul = $('ci-historial');
    if (!EST.historial.length) { ul.innerHTML = '<li class="ci-vacio">Todavía no has registrado ninguna sesión.</li>'; return; }
    var eq = {};
    EST.equipos.forEach(function (e) { eq[e.id] = e.nombre; });
    ul.innerHTML = EST.historial.slice(0, 10).map(function (c) {
      var st = estadoSesion(c);
      var f = new Date(c.fecha + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
      return '<li><b>' + (c.tipo === 'partido' ? 'Partido' : 'Entreno') + (eq[c.equipo_id] ? ' · ' + esc(eq[c.equipo_id]) : '') + '</b>' +
        '<span class="ci-estado' + (st[1] ? ' ci-estado--' + st[1] : '') + '">' + st[0] + '</span>' +
        '<small>' + f + ' · esfuerzo ' + c.rpe + '/10 · ' + c.duracion_min + ' min</small></li>';
    }).join('');
  }

  // ── Asistente ─────────────────────────────────────────────────────────
  function visible(q) {
    if (q.solo_si) for (var k in q.solo_si) if (R[k] !== q.solo_si[k]) return false;
    if (q.solo_si_min) for (var m in q.solo_si_min) if (!(Number(R[m]) >= q.solo_si_min[m])) return false;
    if (q.solo_si_foco && !EST.foco_actual) return false;
    if (q.tipo === 'video') return false;           // la prueba va después de guardar
    if (q.tipo === 'equipo' && !EST.equipos.length) return false;
    return true;
  }
  function prepararPasos() {
    PASOS = CAT.pasos.filter(function (p) { return !p.requiere_consentimiento || EST.bienestar; });
  }
  function aspectoOps(q) {
    return CAT.aspectos.map(function (a) { return { v: a.id, t: a.t }; });
  }

  function objetivos() {
    var lista = [];
    var a = CAT.aspectos.find(function (x) { return x.id === R.mejorar; });
    if (R.causa && CAT.objetivo_por_causa[R.causa]) lista.push(CAT.objetivo_por_causa[R.causa]);
    if (a) lista = lista.concat(a.objetivos);
    return lista.slice(0, 4);
  }

  function opBoton(qid, o, multi) {
    var sel = multi ? (R[qid] || []).indexOf(o.v) >= 0 : String(R[qid]) === String(o.v);
    return '<button type="button" class="ci-op" data-q="' + qid + '" data-v="' + esc(o.v) + '"' + (multi ? ' data-multi="1"' : '') + ' aria-pressed="' + sel + '">' + esc(o.t) + '</button>';
  }

  function pintarPregunta(q) {
    var txt = q.texto.replace('{foco}', esc(EST.foco_actual || ''));
    var h = '<div class="ci-preg" data-preg="' + q.id + '" role="group" aria-labelledby="p-' + q.id + '"><p id="p-' + q.id + '">' + txt + '</p>' + (q.ayuda ? '<small>' + esc(q.ayuda) + '</small>' : '');
    if (q.tipo === 'elige' || q.tipo === 'aspecto' || q.tipo === 'varias') {
      var ops = q.tipo === 'aspecto' ? aspectoOps(q) : q.opciones;
      h += '<div class="ci-ops">' + ops.map(function (o) { return opBoton(q.id, o, q.tipo === 'varias'); }).join('') + '</div>';
    } else if (q.tipo === 'equipo') {
      h += '<div class="ci-ops">' + EST.equipos.map(function (e) { return opBoton(q.id, { v: e.id, t: e.nombre }); }).join('') + '</div>';
    } else if (q.tipo === 'escala') {
      var n = q.max - q.min + 1;
      h += '<div class="ci-escala' + (n === 5 ? ' ci-escala--5' : '') + '">';
      for (var i = q.min; i <= q.max; i++) h += '<button type="button" class="ci-op ci-num" data-q="' + q.id + '" data-v="' + i + '" aria-pressed="' + (R[q.id] === i) + '" aria-label="' + i + (q.etiquetas[i] ? ', ' + q.etiquetas[i] : '') + '">' + i + '</button>';
      h += '</div><div class="ci-escala-et"><span>' + esc(q.etiquetas[q.min]) + '</span><span>' + esc(q.etiquetas[q.max]) + '</span></div>';
      h += '<p class="ci-escala-lectura" id="lec-' + q.id + '">' + (R[q.id] != null ? esc(lectura(q, R[q.id])) : '') + '</p>';
    } else if (q.tipo === 'objetivo') {
      h += '<div class="ci-objs">' + objetivos().map(function (t) { return opBoton(q.id, { v: t, t: t }); }).join('') + '</div>';
      h += '<label class="ci-label" for="obj-propio" style="margin-top:14px">O escríbelo tú</label><input class="ci-input" id="obj-propio" maxlength="120" value="' + esc(R.proximo_propio || '') + '" placeholder="Ej.: pedir el balón en cada ataque">';
    } else if (q.tipo === 'texto') {
      h += '<textarea class="ci-textarea" id="txt-' + q.id + '" maxlength="' + q.max + '" placeholder="Qué ha pasado, qué quieres que vea tu entrenador…" style="margin-top:12px">' + esc(R[q.id] || '') + '</textarea>';
    }
    return h + '</div>';
  }

  function lectura(q, v) {
    var et = q.etiquetas || {};
    for (var i = v; i >= q.min; i--) if (et[i]) return et[i];
    return '';
  }

  function pintarPaso() {
    var p = PASOS[paso];
    $('ci-progreso').innerHTML = PASOS.map(function (_, i) { return '<i class="' + (i <= paso ? 'hecho' : '') + '"></i>'; }).join('');
    $('ci-paso-num').textContent = 'Paso ' + (paso + 1) + ' de ' + PASOS.length;
    $('ci-paso-titulo').textContent = p.titulo;
    var html = '<div class="ci-paso">';
    p.preguntas.forEach(function (q) { if (visible(q)) html += pintarPregunta(q); });
    $('ci-paso').innerHTML = html + '</div>';
    $('ci-error').textContent = '';
    $('ci-atras').textContent = paso === 0 ? 'Cancelar' : 'Atrás';
    $('ci-siguiente').textContent = paso === PASOS.length - 1 ? 'Guardar' : 'Siguiente';
    actualizarSiguiente();
  }

  function completo() {
    var p = PASOS[paso];
    return p.preguntas.every(function (q) {
      if (!visible(q) || q.opcional || q.tipo === 'texto') return true;
      if (q.tipo === 'objetivo') return !!(R.proximo || (R.proximo_propio || '').trim());
      var v = R[q.id];
      return q.tipo === 'varias' ? v && v.length : v != null && v !== '';
    });
  }
  function actualizarSiguiente() { $('ci-siguiente').disabled = !completo(); }

  function pulsarOpcion(btn) {
    var q = btn.dataset.q;
    var raw = btn.dataset.v;
    var preg = null;
    CAT.pasos.forEach(function (p) { p.preguntas.forEach(function (x) { if (x.id === q) preg = x; }); });
    var v = raw;
    if (preg && (preg.tipo === 'escala')) v = Number(raw);
    else if (preg && preg.opciones) { var o = preg.opciones.find(function (x) { return String(x.v) === raw; }); if (o) v = o.v; }
    if (btn.dataset.multi) {
      var arr = (R[q] || []).slice();
      var i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1); else arr.push(v);
      R[q] = arr;
      btn.setAttribute('aria-pressed', String(i < 0));
    } else {
      R[q] = v;
      if (q === 'proximo') R.proximo_propio = '';
      btn.parentNode.querySelectorAll('.ci-op').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      if (preg && preg.tipo === 'escala') { var l = $('lec-' + q); if (l) l.textContent = lectura(preg, v); }
      if (q === 'equipo_id') {
        var eq = EST.equipos.find(function (e) { return e.id === v; });
        if (eq && R.duracion_min == null) {
          var d = [45, 60, 75, 90, 120].reduce(function (a, b) { return Math.abs(b - eq.duracion_habitual_min) < Math.abs(a - eq.duracion_habitual_min) ? b : a; });
          R.duracion_min = d;
          var bd = document.querySelector('[data-q="duracion_min"][data-v="' + d + '"]');
          if (bd) bd.parentNode.querySelectorAll('.ci-op').forEach(function (b) { b.setAttribute('aria-pressed', String(b === bd)); });
        }
      }
      // Preguntas que dependen de esta (partido, zona de molestia)
      if (q === 'tipo' || q === 'dolor') {
        if (q === 'dolor' && Number(v) === 0) delete R.dolor_zona;
        pintarPaso();
        return;
      }
    }
    actualizarSiguiente();
  }

  function abrirWizard() {
    R = {};
    paso = 0;
    if (EST.equipos.length === 1) R.equipo_id = EST.equipos[0].id;
    prepararPasos();
    $('ci-inicio').classList.add('ci-oculto');
    $('ci-wizard').classList.add('abierto');
    pintarPaso();
    $('ci-paso-titulo').focus();
    window.scrollTo(0, 0);
  }
  function cerrarWizard() {
    $('ci-wizard').classList.remove('abierto');
    $('ci-inicio').classList.remove('ci-oculto');
  }

  async function guardar() {
    var resp = Object.assign({}, R);
    if ((R.proximo_propio || '').trim()) resp.proximo = R.proximo_propio.trim();
    delete resp.proximo_propio;
    var t = $('txt-comentario');
    if (t) resp.comentario = t.value.trim();
    $('ci-siguiente').disabled = true;
    $('ci-siguiente').textContent = 'Guardando…';
    try {
      var out = await api('POST', { accion: 'guardar', respuestas: resp });
      ultimo = out;
      pintarResultado(out);
    } catch (e) {
      $('ci-error').textContent = e.message + (e.datos && e.datos.campos ? ' (' + e.datos.campos.join(', ') + ')' : '');
      $('ci-siguiente').disabled = false;
      $('ci-siguiente').textContent = 'Guardar';
    }
  }

  function pintarResultado(out) {
    $('ci-wizard').classList.remove('abierto');
    $('ci-resultado').classList.remove('ci-oculto');
    var c = out.consejo || {};
    var p = c.principal;
    var html = '<small>Para ti</small><p>' + esc(p ? p.texto : 'Buen trabajo registrando la sesión. Sigue así.') + '</p>';
    if (c.otros && c.otros.length) html += '<ul>' + c.otros.map(function (o) { return '<li>' + esc(o.texto) + '</li>'; }).join('') + '</ul>';
    if (out.revision_comentario) html += '<p style="font-size:14px;color:var(--text-2);margin-top:14px">Tu comentario está en revisión. Si es útil, suma XP.</p>';
    $('ci-consejo').innerHTML = html;
    var s = c.semana || {};
    if (s.media_semanas_previas) {
      var pct = Math.min(2, (s.relacion || 0)) / 2;
      $('ci-carga').innerHTML = '<small>Carga de esta semana: <b class="ci-num">' + s.carga_semana + '</b> (tu media: ' + s.media_semanas_previas + ')</small><div class="ci-carga-barra" role="img" aria-label="' + Math.round((s.relacion || 0) * 100) + ' % de tu media"><i style="transform:scaleX(' + pct + ')"></i></div>';
    } else {
      $('ci-carga').innerHTML = '<small>Carga de esta sesión: <b class="ci-num">' + (out.checkin.rpe * out.checkin.duracion_min) + '</b>. Con unas semanas más verás si vas por encima o por debajo de lo normal.</small>';
    }
    if (out.necesita_prueba) $('ci-prueba').classList.remove('ci-oculto');
    $('ci-res-titulo').focus();
    window.scrollTo(0, 0);
  }

  // ── Prueba en vídeo ───────────────────────────────────────────────────
  var revisionPrueba = null;
  async function pedirCodigo() {
    var b = $('ci-pedir-codigo');
    b.disabled = true;
    try {
      var out = await api('POST', { accion: 'codigo', checkin_id: ultimo.checkin.id });
      revisionPrueba = out.revision_id;
      $('ci-codigo').textContent = out.codigo;
      $('ci-gesto').textContent = 'y haz este gesto: ' + out.gesto;
      $('ci-instr').innerHTML = CAT.prueba_video.instrucciones.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
        '<li>Ten el código ' + esc(out.codigo) + ' a la vista (en la pantalla de otro móvil o en un papel).</li>';
      $('ci-codigo-wrap').classList.remove('ci-oculto');
      b.classList.add('ci-oculto');
    } catch (e) {
      $('ci-subida').textContent = e.message;
      b.disabled = false;
    }
  }

  async function subirVideo(file) {
    var st = $('ci-subida');
    var PV = CAT.prueba_video;
    if (file.size > PV.tamano_max_mb * 1048576) { st.textContent = 'El vídeo pesa más de ' + PV.tamano_max_mb + ' MB. Graba solo 5 segundos.'; return; }
    st.textContent = 'Comprobando el vídeo…';
    try {
      var h = await window.DDHuella.huella(file);
      if (h.duracion_seg < PV.duracion_min_seg - 0.5 || h.duracion_seg > PV.duracion_max_seg + 1) {
        st.textContent = 'Dura ' + h.duracion_seg.toFixed(1) + ' s. Tiene que durar entre ' + PV.duracion_min_seg + ' y ' + PV.duracion_max_seg + ' segundos.';
        return;
      }
      st.textContent = 'Subiendo…';
      var prep = await api('POST', Object.assign({ accion: 'subida', revision_id: revisionPrueba }, h));
      if (!DEMO) {
        var up = await sb.storage.from('pruebas').uploadToSignedUrl(prep.ruta, prep.token, file, { contentType: h.mime });
        if (up.error) throw new Error('No se ha podido subir. Prueba con wifi.');
      }
      var fin = await api('POST', { accion: 'confirmar', revision_id: revisionPrueba });
      st.textContent = fin.estado === 'repetido'
        ? 'Este vídeo ya se había usado como prueba. Graba uno nuevo en la pista.'
        : 'Enviado. Tu entrenador lo revisará y, si todo está bien, sumarás el XP de la sesión.';
      if (fin.estado !== 'repetido') document.querySelector('.ci-file').classList.add('ci-oculto');
    } catch (e) {
      st.textContent = e.message;
    }
  }

  // ── Eventos ───────────────────────────────────────────────────────────
  function enlazar() {
    $('ci-empezar').addEventListener('click', abrirWizard);
    $('ci-paso').addEventListener('click', function (ev) {
      var b = ev.target.closest('.ci-op');
      if (b) pulsarOpcion(b);
    });
    $('ci-paso').addEventListener('input', function (ev) {
      if (ev.target.id === 'obj-propio') {
        R.proximo_propio = ev.target.value;
        if (ev.target.value.trim()) { delete R.proximo; document.querySelectorAll('[data-q="proximo"]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); }
        actualizarSiguiente();
      }
    });
    $('ci-siguiente').addEventListener('click', function () {
      if (!completo()) { $('ci-error').textContent = 'Contesta lo que falta para seguir.'; return; }
      if (paso === PASOS.length - 1) return guardar();
      paso++; pintarPaso(); $('ci-paso-titulo').focus(); window.scrollTo(0, 0);
    });
    $('ci-atras').addEventListener('click', function () {
      if (paso === 0) return cerrarWizard();
      paso--; pintarPaso(); $('ci-paso-titulo').focus();
    });
    $('ci-pedir-codigo').addEventListener('click', pedirCodigo);
    $('ci-video').addEventListener('change', function (ev) { if (ev.target.files[0]) subirVideo(ev.target.files[0]); });

    $('ci-form-eq').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      $('eq-error').textContent = '';
      try {
        var out = await api('POST', { accion: 'equipo', nombre: $('eq-nombre').value, tipo: $('eq-tipo').value, duracion: $('eq-dur').value });
        EST.equipos.push(out.equipo);
        $('eq-nombre').value = '';
        pintarEquipos();
      } catch (e) { $('eq-error').textContent = e.message; }
    });
    $('ci-equipos').addEventListener('click', async function (ev) {
      var b = ev.target.closest('[data-baja]');
      if (!b) return;
      await api('POST', { accion: 'equipo', baja: true, id: b.dataset.baja }).catch(function () {});
      EST.equipos = EST.equipos.filter(function (e) { return e.id !== b.dataset.baja; });
      pintarEquipos();
    });

    $('ci-nac').addEventListener('change', function () {
      var edad = (Date.now() - Date.parse(this.value)) / (365.25 * 86400000);
      $('ci-tutor-wrap').classList.toggle('ci-oculto', !(edad < CAT.consentimiento_bienestar.edad_minima_propia));
    });
    $('ci-tienda-lista').addEventListener('click', async function (ev) {
      var b = ev.target.closest('[data-canje]');
      if (!b) return;
      $('ci-tienda-error').textContent = ''; $('ci-tienda-ok').textContent = '';
      b.disabled = true;
      try {
        var out = await api('POST', { accion: 'canjear', item: b.dataset.canje });
        EST.progreso.escamas.saldo = out.saldo;
        EST.progreso.escamas.gastadas += EST.tienda.find(function (x) { return x.id === b.dataset.canje; }).escamas;
        EST.canjes = (EST.canjes || []).concat([{ item: b.dataset.canje, estado: 'pendiente' }]);
        pintarTienda();
        $('ci-tienda-ok').textContent = 'Pedido hecho. Tu entrenador te lo da en la próxima sesión.';
      } catch (e) { $('ci-tienda-error').textContent = e.message; b.disabled = false; }
    });
    $('ci-crec-form').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      $('ci-crec-error').textContent = '';
      var v = Number($('ci-estatura').value);
      try {
        var out = await api('POST', { accion: 'medicion', estatura_cm: v });
        EST.crecimiento = { ultima: { fecha: EST.hoy, estatura_cm: v }, cm_anio: out.cm_anio };
        $('ci-estatura').value = '';
        pintarCrecimiento();
      } catch (e) { $('ci-crec-error').textContent = e.message; }
    });
    $('ci-consent-form').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      $('ci-consent-error').textContent = '';
      try {
        await api('POST', { accion: 'bienestar', fecha_nacimiento: $('ci-nac').value, acepto: $('ci-acepto').checked, otorgado_por: $('ci-tutor').checked ? 'tutor' : 'jugador' });
        EST.bienestar = true;
        $('ci-consent').classList.add('ci-oculto');
      } catch (e) { $('ci-consent-error').textContent = e.message; }
    });
  }

  // ── Arranque ──────────────────────────────────────────────────────────
  async function iniciar() {
    try {
      if (!DEMO) {
        var s = await sb.auth.getSession();
        if (!s.data.session) { location.href = '/login.html'; return; }
      }
      var res = await Promise.all([fetch('/data/checkin.json').then(function (r) { return r.json(); }), api('GET')]);
      CAT = res[0]; EST = res[1];
      $('ci-cargando').classList.add('ci-oculto');
      $('ci-inicio').classList.remove('ci-oculto');
      pintarInicio();
      enlazar();
      if (/[?&]nuevo=1/.test(location.search)) abrirWizard();
    } catch (e) {
      var fun = await fetch('/data/funciones.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return {}; });
      $('ci-cargando').textContent = fun.checkin === false
        ? 'El check-in se activa muy pronto. Mientras tanto, tienes la normativa y el calentamiento en tu área.'
        : 'No se ha podido cargar el check-in. Recarga la página.';
    }
  }

  // ── Modo demo (solo en local) ─────────────────────────────────────────
  var DEMO_EST = null;
  function demo(metodo, cuerpo) {
    var hoy = new Date().toISOString().slice(0, 10);
    var hace = function (d) { return new Date(Date.now() - d * 86400000).toISOString().slice(0, 10); };
    if (!DEMO_EST) DEMO_EST = {
      catalogo_version: 1, bienestar: /bienestar=0/.test(location.search) ? false : true, hoy: hoy,
      equipos: [{ id: '00000000-0000-0000-0000-000000000001', nombre: 'Infantil A del club', tipo: 'club', duracion_habitual_min: 90 },
                { id: '00000000-0000-0000-0000-000000000002', nombre: 'Dragons Den', tipo: 'dragons_den', duracion_habitual_min: 60 }],
      historial: [
        { id: 'a', fecha: hace(1), tipo: 'partido', equipo_id: '00000000-0000-0000-0000-000000000001', equipo_tipo: 'club', rpe: 7, duracion_min: 75, validado_por: 'sin_validar', proximo: 'Botar con la cabeza levantada' },
        { id: 'b', fecha: hace(2), tipo: 'entreno', equipo_id: '00000000-0000-0000-0000-000000000002', equipo_tipo: 'dragons_den', rpe: 6, duracion_min: 60, validado_por: 'entrenador' },
        { id: 'c', fecha: hace(4), tipo: 'entreno', equipo_id: '00000000-0000-0000-0000-000000000001', equipo_tipo: 'club', rpe: 5, duracion_min: 90, validado_por: 'sin_validar' },
      ],
      revisiones: [{ id: 'r1', tipo: 'prueba_video', estado: 'pendiente', checkin_id: 'a' }],
      foco_actual: 'Botar con la cabeza levantada',
      semana: { sesiones_semana: 2, carga_semana: 885, media_semanas_previas: 1100, relacion: 0.8 },
      forma: 3.6,
      edad: 13,
      progreso: { temporada: { id: '2026-27', nombre: 'Temporada 2026-27', inicio: '2026-11-02', fin: '2027-05-30', en_curso: true, semanas_quedan: 21 }, xp: 1240, nivel: { numero: 4, nombre: 'Sexto Hombre' }, aspecto: { id: 'bronce', nombre: 'Carta de bronce' }, siguiente: { numero: 5, nombre: 'Titular', xp_desde: 1550, faltan: 310, recompensa: 'Carta plateada y capitán de una sesión' }, pct: 48, racha: 6, mejor_racha: 6, comodines: 1,
        proyeccion: { xp: 4100, nivel: 8, nombre: 'MVP' }, escamas: { ganadas: 37, gastadas: 10, saldo: 27 },
        semanas: ['cumplida', 'cumplida', 'fallada', 'cumplida', 'cumplida', 'cumplida', 'protegida', 'cumplida', 'cumplida', 'en_curso'].map(function (e, i) { return { lunes: new Date(Date.UTC(2026, 10, 2 + i * 7)).toISOString().slice(0, 10), estado: e }; }),
        temporadas_anteriores: [],
        semana_actual: { checkins: 2, otras: 1 },
        logros: [{ id: 'primer_parte', nombre: 'Primer parte', conseguido: true, valor: 3, minimo: 1 }, { id: 'constante', nombre: 'Constante', conseguido: false, valor: 3, minimo: 10 }, { id: 'mes_dragon', nombre: 'Mes Dragón', conseguido: false, valor: 3, minimo: 4 }] },
      crecimiento: { ultima: { fecha: hace(40), estatura_cm: 158.5 }, cm_anio: 8.2 },
      tienda: [{ id: 'capitan', nombre: 'Capitán de una sesión', detalle: 'Eliges el calentamiento y diriges un ejercicio.', escamas: 10 }, { id: 'munequera', nombre: 'Muñequera Dragons Den', escamas: 25 }, { id: 'descuento_10', nombre: '10 € de descuento en equipación', escamas: 40 }, { id: 'camiseta', nombre: 'Camiseta oficial de entrenamiento', escamas: 80 }, { id: 'sudadera', nombre: 'Sudadera oficial', escamas: 120 }],
      canjes: [{ item: 'capitan', estado: 'pendiente' }],
    };
    var e = DEMO_EST;
    return new Promise(function (ok) {
      setTimeout(function () {
        if (metodo === 'GET') return ok(JSON.parse(JSON.stringify(e)));
        if (cuerpo.accion === 'equipo') return ok({ equipo: { id: String(Math.random()), nombre: cuerpo.nombre, tipo: cuerpo.tipo, duracion_habitual_min: Number(cuerpo.duracion) } });
        if (cuerpo.accion === 'bienestar') return ok({ ok: true });
        if (cuerpo.accion === 'medicion') return ok({ ok: true, cm_anio: 8.4 });
        if (cuerpo.accion === 'canjear') { var it = e.tienda.find(function (x) { return x.id === cuerpo.item; }); e.progreso.escamas.saldo -= it.escamas; return ok({ ok: true, saldo: e.progreso.escamas.saldo }); }
        if (cuerpo.accion === 'guardar') {
          var r = cuerpo.respuestas;
          return ok({
            checkin: { id: 'nuevo', rpe: r.rpe, duracion_min: r.duracion_min },
            necesita_prueba: (e.equipos.find(function (x) { return x.id === r.equipo_id; }) || {}).tipo !== 'dragons_den',
            revision_comentario: r.comentario ? { estado: 'pendiente' } : null,
            consejo: {
              principal: r.causa === 'externo'
                ? { texto: 'El árbitro, el rival o la suerte no los controlas. Lo que sí: tu esfuerzo y la siguiente jugada. Para la próxima sesión, céntrate en eso.' }
                : { texto: 'Lo mejor de hoy ha sido tu ' + (r.mejor || 'actitud') + '. Apúntatelo: es una base para la próxima sesión.' },
              otros: r.sueno === 'menos7' ? [{ texto: 'Duermes menos de 8 horas. A tu edad el cuerpo mejora mientras duermes: intenta 8 a 10 horas.' }] : [],
              semana: { carga_semana: 885 + r.rpe * r.duracion_min, media_semanas_previas: 1100, relacion: Math.round(((885 + r.rpe * r.duracion_min) / 1100) * 100) / 100 },
            },
          });
        }
        if (cuerpo.accion === 'codigo') return ok({ revision_id: 'r2', codigo: '47', gesto: '3 dedos' });
        if (cuerpo.accion === 'subida') return ok({ ruta: 'x', token: 'y' });
        if (cuerpo.accion === 'confirmar') return ok({ estado: 'pendiente' });
        ok({});
      }, 250);
    });
  }

  iniciar();
})();
