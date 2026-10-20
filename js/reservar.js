// Asistente de inscripción de reservar.html: 6 pasos, resumen y mensaje final
// por WhatsApp o correo compuesto con las respuestas. Copia en /api/inscripcion.
// ── WIZARD ────────────────────────────────────────────────────────────────
(function() {
    var TOTAL_STEPS = 6;
    var currentStep = 1;
    var isAnimating = false;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var form = document.getElementById('inscripcion-form');
    if (!form) return;
    var container = document.getElementById('wizard-steps-container');
    var $ = function(id) { return document.getElementById(id); };

    // ── Edad a partir de la fecha de nacimiento ──
    function edadActual() {
        var v = $('fecha-nacimiento').value;
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
        if (!m) return null;
        var hoy = new Date();
        var e = hoy.getFullYear() - (+m[1]);
        var mes = hoy.getMonth() + 1 - (+m[2]);
        if (mes < 0 || (mes === 0 && hoy.getDate() < +m[3])) e--;
        return e;
    }
    function esMenor() { var e = edadActual(); return e !== null && e < 18; }
    function esTutor() { return $('para-hijo').checked; }

    // Si el jugador es menor, solo puede enviar la solicitud su padre, madre o tutor.
    function syncHijoFields() {
        var menor = esMenor();
        if (menor) $('para-hijo').checked = true;
        $('para-mi').disabled = menor;
        $('aviso-menor').hidden = !menor;
        $('hint-contacto-menor').hidden = !esTutor();
        var tutor = esTutor();
        $('hijo-fields').classList.toggle('visible', tutor);
        $('tutor-nombre').required = tutor;
        $('tutor-relacion').required = tutor;
        $('tutor-declara').required = tutor;
    }
    document.querySelectorAll('input[name="para_quien"]').forEach(function(r) { r.addEventListener('change', syncHijoFields); });
    $('fecha-nacimiento').addEventListener('change', syncHijoFields);
    $('fecha-nacimiento').addEventListener('input', syncHijoFields);
    // Limites razonables para el selector de fecha
    (function() {
        var hoy = new Date();
        var iso = function(d) { return d.toISOString().slice(0, 10); };
        $('fecha-nacimiento').max = iso(new Date(hoy.getFullYear() - 3, hoy.getMonth(), hoy.getDate()));
        $('fecha-nacimiento').min = iso(new Date(hoy.getFullYear() - 99, 0, 1));
    })();
    syncHijoFields();

    // ── Progreso ──
    function updateProgress(step) {
        $('wizard-progress-fill').style.width = ((step / TOTAL_STEPS) * 100) + '%';
        $('wizard-progress-label').textContent = 'Paso ' + step + ' de ' + TOTAL_STEPS;
        document.querySelectorAll('.wizard-dot').forEach(function(dot) {
            var n = parseInt(dot.getAttribute('data-dot'), 10);
            dot.classList.remove('active', 'done');
            if (n < step) dot.classList.add('done');
            else if (n === step) dot.classList.add('active');
        });
        document.querySelectorAll('.wizard-dot-line').forEach(function(line) {
            var n = parseInt(line.getAttribute('data-line'), 10);
            line.classList.toggle('done', n < step);
        });
    }

    // ── Errores accesibles ──
    function setError(field, errEl, msg) {
        if (field) { field.classList.add('error'); field.setAttribute('aria-invalid', 'true'); }
        if (errEl) { if (msg) errEl.textContent = msg; errEl.classList.add('visible'); }
    }
    function clearError(field, errEl) {
        if (field) { field.classList.remove('error'); field.removeAttribute('aria-invalid'); }
        if (errEl) errEl.classList.remove('visible');
    }

    function validateStep(stepEl) {
        var firstBad = null;
        var step = parseInt(stepEl.getAttribute('data-step'), 10);
        stepEl.querySelectorAll('input[required], select[required], textarea[required]').forEach(function(field) {
            if (field.closest('#hijo-fields') && !esTutor()) return;
            var errEl = $('err-' + field.id);
            var bad = false, msg = null;
            if (field.type === 'checkbox') bad = !field.checked;
            else if (field.value.trim() === '') bad = true;
            else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) { bad = true; msg = 'Introduce un email válido'; }
            else if (field.id === 'fecha-nacimiento') {
                var e = edadActual();
                if (e === null || e < 3 || e > 99) { bad = true; msg = 'Indica una fecha de nacimiento válida'; }
            }
            if (bad) { setError(field, errEl, msg); if (!firstBad) firstBad = field; }
            else clearError(field, errEl);
        });
        if (step === 4) {
            var elegido = form.querySelector('input[name="programa"]:checked');
            var fs = $('programa-fieldset');
            if (!elegido) { fs.setAttribute('aria-invalid', 'true'); $('err-programa').classList.add('visible'); if (!firstBad) firstBad = form.querySelector('input[name="programa"]'); }
            else { fs.removeAttribute('aria-invalid'); $('err-programa').classList.remove('visible'); }
        }
        if (step === 5) {
            var salud = $('lesiones').value.trim();
            var ok = !salud || $('consiente-salud').checked;
            if (!ok) { setError($('consiente-salud'), $('err-consiente-salud')); if (!firstBad) firstBad = $('consiente-salud'); }
            else clearError($('consiente-salud'), $('err-consiente-salud'));
        }
        if (firstBad) firstBad.focus();
        return !firstBad;
    }

    function clearErrors(stepEl) {
        stepEl.querySelectorAll('[aria-invalid]').forEach(function(el) { el.removeAttribute('aria-invalid'); });
        stepEl.querySelectorAll('.error').forEach(function(el) { el.classList.remove('error'); });
        stepEl.querySelectorAll('.field-error.visible').forEach(function(el) { el.classList.remove('visible'); });
    }

    // ── Cambio de paso: animación solo con transform/opacity y el foco
    //    pasa al título del paso nuevo ──
    function goTo(from, to, direction) {
        if (isAnimating) return;
        var fromEl = container.querySelector('[data-step="' + from + '"]');
        var toEl   = container.querySelector('[data-step="' + to + '"]');
        if (to === 6) buildSummary();

        function finish() {
            fromEl.classList.remove('active', 'sliding-out-left', 'sliding-out-right');
            toEl.classList.remove('sliding-in-left', 'sliding-in-right');
            toEl.classList.add('active');
            container.style.height = '';
            currentStep = to;
            updateProgress(to);
            isAnimating = false;
            var title = toEl.querySelector('.wizard-step-title');
            if (title) title.focus({ preventScroll: true });
            var inscEl = $('inscripcion');
            if (inscEl) {
                var top = inscEl.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
            }
        }

        if (reduceMotion) { finish(); return; }
        isAnimating = true;
        container.style.height = fromEl.offsetHeight + 'px';
        fromEl.classList.remove('active');
        fromEl.classList.add(direction === 'next' ? 'sliding-out-left' : 'sliding-out-right');
        toEl.classList.add(direction === 'next' ? 'sliding-in-left' : 'sliding-in-right');
        setTimeout(finish, 330);
    }

    function textOf(id) {
        var el = $(id);
        if (!el) return '';
        if (el.tagName === 'SELECT') return el.value ? el.options[el.selectedIndex].text : '';
        return el.value.trim();
    }
    function programaElegido() {
        var r = form.querySelector('input[name="programa"]:checked');
        return r ? r.getAttribute('data-label') : '';
    }
    function formatFecha(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
    }

    function buildSummary() {
        var rows = [
            ['Solicitud', esTutor() ? 'La hace el padre, madre o tutor/a' : 'La hace el propio jugador/a'],
            ['Jugador/a', textOf('nombre') || '—'],
            ['Nacimiento', formatFecha($('fecha-nacimiento').value) + (edadActual() !== null ? ' (' + edadActual() + ' años)' : '')],
            ['Nivel', textOf('nivel') || '—'],
            ['Programa', programaElegido() || '—'],
            ['Email', textOf('email') || '—'],
            ['Teléfono', textOf('telefono') || '—']
        ];
        if (esTutor()) rows.splice(2, 0, ['Tutor/a', textOf('tutor-nombre') || '—']);
        var box = $('wizard-summary');
        box.textContent = '';
        rows.forEach(function(row) {
            var d = document.createElement('div'); d.className = 'summary-row';
            var l = document.createElement('span'); l.className = 'summary-label'; l.textContent = row[0];
            var v = document.createElement('span'); v.className = 'summary-value'; v.textContent = row[1];
            d.appendChild(l); d.appendChild(v); box.appendChild(d);
        });
        actualizarVistaPrevia();
    }

    // ── Mensaje que la familia nos envía por WhatsApp o correo ──────────
    var DD_WA = '34646794962';
    var DD_EMAIL = 'bbdragonsden@gmail.com';

    function categoria() {
        var m = /^(\d{4})-/.exec($('fecha-nacimiento').value || '');
        if (!m) return '';
        var hoy = new Date();
        var temporada = hoy.getMonth() >= 8 ? hoy.getFullYear() : hoy.getFullYear() - 1;
        var d = temporada - (+m[1]);
        if (d >= 18) return 'S\u00e9nior';
        if (d >= 16) return 'Junior';
        if (d >= 14) return 'Cadete';
        if (d >= 12) return 'Infantil';
        if (d >= 10) return 'Alev\u00edn';
        if (d >= 8) return 'Benjam\u00edn';
        return 'Escuela';
    }

    function programaValor() {
        var r = form.querySelector('input[name="programa"]:checked');
        return r ? r.value : '';
    }

    function precioTier(id, ex) {
        var p = window.DD_PLANES && window.DD_PLANES.servicios_presenciales;
        var respaldo = { tracker: [50, 30], hibrido: [100, 70], pro_vip: [150, 100] }[id];
        var t = p && (p.tiers || []).filter(function(x) { return x.id === id; })[0];
        if (t) return ex ? t.precio_exalumno : t.precio_mes;
        return respaldo ? respaldo[ex ? 1 : 0] : null;
    }

    function componerMensaje(canal) {
        var nombre = textOf('nombre') || '[nombre del jugador]';
        var ex = $('tipo').value === 'anterior';
        var prog = programaValor();
        var L = [];

        if (esTutor()) {
            var rel = ($('tutor-relacion').value === 'tutor') ? 'tutor/a legal' : ($('tutor-relacion').value || 'familiar');
            L.push('Hola Coach! Soy ' + (textOf('tutor-nombre') || '[tu nombre]') + ', ' + rel + ' de ' + nombre + '.');
        } else {
            L.push('Hola Coach! Soy ' + nombre + '.');
        }

        var tierId = { tracker: 'tracker', hibrido: 'hibrido', 'pro-vip': 'pro_vip' }[prog];
        var precio = tierId ? precioTier(tierId, ex) : null;
        var tier = { tracker: 'Tier 1', hibrido: 'Tier 2', 'pro-vip': 'Tier 3' }[prog];
        var detalle = tier ? ' (' + tier + (precio ? ', ' + precio + ' \u20ac/mes' + (ex ? ' como ex-alumno' : '') : '') + ')' : '';
        var para = esTutor() ? ' para ' + nombre : '';
        var frases = {
            tracker: 'Quiero solicitar plaza en el Dragons Tracker' + detalle + para + '.',
            hibrido: 'Quiero reservar una de las 6 plazas en pista del Plan \u00c9lite H\u00edbrido' + detalle + para + '.',
            'pro-vip': 'Quiero solicitar plaza en el Plan PRO VIP' + detalle + para + '.',
            puntual: 'Me interesan las sesiones 1v1 o el Campus vacacional' + para + '.',
            informacion: 'Todav\u00eda no s\u00e9 qu\u00e9 plan elegir: me gustar\u00eda hacer la sesi\u00f3n de evaluaci\u00f3n sin coste' + para + '.'
        };
        L.push(frases[prog] || 'Quiero informaci\u00f3n sobre Dragons Den' + para + '.');
        if ($('tipo').value === 'anterior') L.push('Ya hemos entrenado antes con vosotros.');
        else if ($('tipo').value === 'nuevo') L.push(esTutor() ? 'Ser\u00eda la primera vez que entrena con Dragons Den.' : 'Ser\u00eda la primera vez que entreno con Dragons Den.');

        var datos = [];
        var edad = edadActual(), cat = categoria();
        if (edad !== null) datos.push('Edad: ' + edad + ' a\u00f1os' + (cat ? ' (' + cat + ')' : ''));
        if (textOf('nivel')) datos.push('Nivel: ' + textOf('nivel'));
        if ($('posicion').value && $('posicion').value !== 'no-se') datos.push('Posici\u00f3n: ' + textOf('posicion'));
        if (textOf('club')) datos.push('Club: ' + textOf('club'));
        if (textOf('objetivo')) datos.push('Objetivo: ' + textOf('objetivo'));
        if ($('consiente-salud').checked && textOf('lesiones')) datos.push('A tener en cuenta: ' + textOf('lesiones'));
        if (textOf('origen')) datos.push('Os conocimos por: ' + textOf('origen'));
        if (datos.length) {
            L.push('');
            L.push(canal === 'whatsapp' ? '*Datos*' : 'Datos:');
            datos.forEach(function(d) { L.push('- ' + d); });
        }

        if (textOf('comentarios')) { L.push(''); L.push(textOf('comentarios')); }

        var preguntas = {
            tracker: '\u00bfC\u00f3mo os mando el primer clip de partido?',
            hibrido: '\u00bfQu\u00e9 turnos quedan libres esta semana?',
            'pro-vip': '\u00bfCu\u00e1ndo podemos empezar y qu\u00e9 turnos quedan libres?',
            puntual: '\u00bfQu\u00e9 fechas ten\u00e9is disponibles?',
            informacion: '\u00bfCu\u00e1ndo podr\u00edamos hacer la evaluaci\u00f3n?'
        };
        L.push('');
        L.push(preguntas[prog] || '\u00bfMe cont\u00e1is las opciones?');

        var contacto = canal === 'email' ? textOf('telefono') && ('Mi WhatsApp: ' + textOf('telefono'))
                                         : textOf('email') && ('Mi correo: ' + textOf('email'));
        if (contacto) L.push(contacto);
        L.push('Gracias!');
        return L.join('\n');
    }

    function asuntoCorreo() {
        var etiquetas = { tracker: 'Tier 1 Dragons Tracker', hibrido: 'Tier 2 Plan Elite Hibrido', 'pro-vip': 'Tier 3 Plan PRO VIP', puntual: '1v1 o Campus vacacional', informacion: 'Sesion de evaluacion' };
        return 'Solicitud Dragons Den - ' + (etiquetas[programaValor()] || 'Informacion') + ' - ' + (textOf('nombre') || 'jugador');
    }

    function urlCanal(canal) {
        var texto = componerMensaje(canal);
        if (canal === 'email') {
            return 'mailto:' + DD_EMAIL + '?subject=' + encodeURIComponent(asuntoCorreo()) + '&body=' + encodeURIComponent(texto.replace(/\n/g, '\r\n'));
        }
        return 'https://wa.me/' + DD_WA + '?text=' + encodeURIComponent(texto);
    }

    function actualizarVistaPrevia() {
        var pre = $('dd-msg-texto');
        if (pre) pre.textContent = componerMensaje('whatsapp').replace(/^\*Datos\*$/m, 'Datos');
    }
    ['rgpd', 'acepta-comunicaciones'].forEach(function(id) { var el = $(id); if (el) el.addEventListener('change', actualizarVistaPrevia); });

    document.querySelectorAll('.wizard-btn-next[data-next]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var to = parseInt(btn.getAttribute('data-next'), 10);
            var fromEl = container.querySelector('[data-step="' + currentStep + '"]');
            if (validateStep(fromEl)) goTo(currentStep, to, 'next');
        });
    });
    document.querySelectorAll('.wizard-btn-prev[data-prev]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var to = parseInt(btn.getAttribute('data-prev'), 10);
            clearErrors(container.querySelector('[data-step="' + currentStep + '"]'));
            goTo(currentStep, to, 'prev');
        });
    });

    form.querySelectorAll('input, select, textarea').forEach(function(field) {
        var limpiar = function() { clearError(field, $('err-' + field.id)); };
        field.addEventListener('input', limpiar);
        field.addEventListener('change', limpiar);
    });
    form.querySelectorAll('input[name="programa"]').forEach(function(r) {
        r.addEventListener('change', function() {
            $('programa-fieldset').removeAttribute('aria-invalid');
            $('err-programa').classList.remove('visible');
        });
    });
    $('lesiones').addEventListener('input', function() { clearError($('consiente-salud'), $('err-consiente-salud')); });

    // Los botones "Solicitar" / "Lista de espera" de los precios preseleccionan el programa.
    document.querySelectorAll('a[data-programa]').forEach(function(a) {
        a.addEventListener('click', function() {
            var r = form.querySelector('input[name="programa"][value="' + a.getAttribute('data-programa') + '"]');
            if (r) r.checked = true;
        });
    });

    updateProgress(1);

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var step6 = container.querySelector('[data-step="6"]');
        if (!validateStep(step6)) return;
        if ($('insc-honey').value) return;

        var canal = (e.submitter && e.submitter.getAttribute('data-canal')) || 'whatsapp';
        var otro = canal === 'whatsapp' ? 'email' : 'whatsapp';
        var url = urlCanal(canal);
        var tutor = esTutor();

        // Copia en el panel del entrenador. No bloquea: si falla, el mensaje ya sale igual.
        var payload = {
            _honey:         $('insc-honey').value,
            para_quien:     tutor ? 'Para su hijo/a' : 'Para s\u00ed mismo/a',
            nombre:         textOf('nombre'),
            fecha_nacimiento: $('fecha-nacimiento').value,
            edad:           edadActual(),
            posicion:       textOf('posicion'),
            nivel:          textOf('nivel'),
            club:           textOf('club'),
            tutor_nombre:   tutor ? textOf('tutor-nombre') : '',
            tutor_relacion: tutor ? textOf('tutor-relacion') : '',
            tutor_declara:  tutor && $('tutor-declara').checked,
            email:          textOf('email'),
            telefono:       textOf('telefono'),
            anterior:       textOf('tipo'),
            programa:       programaElegido(),
            objetivo:       textOf('objetivo'),
            consiente_salud: $('consiente-salud').checked,
            lesiones:       $('consiente-salud').checked ? textOf('lesiones') : '',
            origen:         textOf('origen'),
            comentarios:    textOf('comentarios') + (textOf('comentarios') ? ' ' : '') + '[enviado por ' + (canal === 'email' ? 'correo' : 'WhatsApp') + ']',
            acepta_privacidad: $('rgpd').checked,
            acepta_comunicaciones: $('acepta-comunicaciones').checked
        };
        try {
            fetch('/api/inscripcion', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                .catch(function(err) { console.warn('[inscripcion] copia no guardada', err); });
        } catch (err) { /* sin fetch */ }

        // Abrir el canal elegido dentro del mismo clic (si no, el navegador lo bloquea).
        if (canal === 'email') {
            window.location.href = url;
        } else {
            var w = window.open(url, '_blank', 'noopener');
            if (!w) window.location.href = url;
        }

        // Pantalla final con plan B: volver a abrir, copiar el texto o usar el otro canal.
        container.style.display = 'none';
        var barra = document.querySelector('.wizard-progress-bar-wrap'); if (barra) barra.style.display = 'none';
        if ($('wizard-step-dots')) $('wizard-step-dots').style.display = 'none';
        $('form-error').style.display = 'none';
        $('dd-ok-texto').textContent = canal === 'email'
            ? 'Se ha abierto tu correo con el mensaje ya escrito. Env\u00edalo y te contestamos en 24-48 horas para confirmar plaza, horario y precio. El pago solo se hace despu\u00e9s de esa confirmaci\u00f3n.'
            : 'Se ha abierto WhatsApp con tu mensaje ya escrito. Env\u00edalo y te contestamos en 24-48 horas para confirmar plaza, horario y precio. El pago solo se hace despu\u00e9s de esa confirmaci\u00f3n.';
        $('dd-ok-abrir').href = url;
        $('dd-ok-abrir-txt').textContent = canal === 'email' ? 'Abrir el correo otra vez' : 'Abrir WhatsApp otra vez';
        if (canal === 'email') $('dd-ok-abrir').removeAttribute('target'); else $('dd-ok-abrir').setAttribute('target', '_blank');
        $('dd-ok-otro').href = urlCanal(otro);
        $('dd-ok-otro').textContent = otro === 'email' ? 'Enviar por correo' : 'Enviar por WhatsApp';
        if (otro === 'email') $('dd-ok-otro').removeAttribute('target'); else $('dd-ok-otro').setAttribute('target', '_blank');
        $('dd-ok-copiar').onclick = function() {
            var texto = componerMensaje(canal);
            var b = this;
            var hecho = function() { b.textContent = 'Mensaje copiado'; setTimeout(function() { b.textContent = 'Copiar el mensaje'; }, 2200); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(hecho, function() {});
        };
        var ok = $('form-success');
        ok.style.display = 'block';
        ok.focus();
    });
})();



// Los enlaces "reservar.html?plan=hibrido" llegan con el plan ya marcado.
(function () {
    var plan = new URLSearchParams(location.search).get('plan');
    if (!plan) return;
    var r = document.querySelector('input[name="programa"][value="' + plan.replace(/[^a-z-]/g, '') + '"]');
    if (r) r.checked = true;
})();
