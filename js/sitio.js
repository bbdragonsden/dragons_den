// Comportamiento común de todas las páginas de Dragons Den.
// Navegación suave — todos los links con href="#id"
(function() {
    var NAV_HEIGHT = 80;
    document.querySelectorAll('a[href^="#"]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            var target = document.querySelector(link.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            var top = target.getBoundingClientRect().top + window.pageYOffset - NAV_HEIGHT;
            window.scrollTo({ top: top, behavior: 'smooth' });
        });
    });
})();

// Menú móvil: panel que se abre desde la barra inferior.
(function() {
    var panel = document.getElementById('dd-menu');
    var abrir = document.getElementById('dd-menu-abrir');
    if (!panel || !abrir) return;
    var hoja = panel.querySelector('.dd-menu-hoja');
    var ultimoFoco = null;

    function enfocables() {
        return Array.prototype.slice.call(hoja.querySelectorAll('a[href], button:not([disabled])'));
    }
    function abrirMenu() {
        ultimoFoco = document.activeElement;
        panel.hidden = false;
        requestAnimationFrame(function() { panel.classList.add('is-abierto'); });
        abrir.setAttribute('aria-expanded', 'true');
        document.documentElement.style.overflow = 'hidden';
        var primero = hoja.querySelector('.dd-menu-lista a');
        if (primero) primero.focus({ preventScroll: true });
    }
    function cerrarMenu(devolverFoco) {
        if (panel.hidden) return;
        panel.classList.remove('is-abierto');
        abrir.setAttribute('aria-expanded', 'false');
        document.documentElement.style.overflow = '';
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(function() { panel.hidden = true; }, reduce ? 0 : 280);
        if (devolverFoco && ultimoFoco) ultimoFoco.focus({ preventScroll: true });
    }
    abrir.addEventListener('click', function() { panel.hidden ? abrirMenu() : cerrarMenu(true); });
    panel.querySelectorAll('[data-menu-cerrar]').forEach(function(el) {
        el.addEventListener('click', function() { cerrarMenu(true); });
    });
    // Un enlace del menú cierra el panel y deja que el navegador (o el modal de inscripción) haga su trabajo.
    hoja.querySelectorAll('a').forEach(function(a) {
        a.addEventListener('click', function() { cerrarMenu(false); });
    });
    document.addEventListener('keydown', function(e) {
        if (panel.hidden) return;
        if (e.key === 'Escape') { cerrarMenu(true); return; }
        if (e.key !== 'Tab') return;
        var els = enfocables(); if (!els.length) return;
        var primero = els[0], ultimo = els[els.length - 1];
        if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    });
    // Si se pasa a escritorio con el panel abierto, se cierra.
    window.addEventListener('resize', function() { if (window.innerWidth > 900) cerrarMenu(false); });
})();

// ── Animaciones de aparicion (nativas, sin libreria externa) ────────────
// Antes dependia de cargar GSAP + ScrollTrigger en cadena desde /vendor/;
// si esa doble carga se retrasaba o se desincronizaba con el layout (
// imagenes/fuentes aun cargando), el texto se quedaba a medio desvanecer
// en vez de llegar a opacidad 1. Con IntersectionObserver nativo no hay
// esa dependencia de red ni ese recalculo de posiciones de scroll.
(function() {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Hero: aparece una vez, sin depender de scroll.
    var heroEls = document.querySelectorAll('.hero-eyebrow, .hero-title, .hero-subtitle, .hero-description, .hero-cta, .hero-right');
    heroEls.forEach(function(el) { el.classList.add('is-hero-reveal'); });
    if (reduceMotion) {
        heroEls.forEach(function(el) { el.classList.add('is-visible'); });
    } else {
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                heroEls.forEach(function(el) { el.classList.add('is-visible'); });
            });
        });
    }

    // Resto de la pagina: [data-reveal] y los hijos de [data-reveal-stagger].
    var piezas = Array.from(document.querySelectorAll('[data-reveal]'));
    document.querySelectorAll('[data-reveal-stagger]').forEach(function(parent) {
        Array.from(parent.children).forEach(function(hijo, i) {
            hijo.classList.add('is-reveal-child');
            hijo.style.transitionDelay = reduceMotion ? '0s' : (Math.min(i, 6) * 0.07) + 's';
            piezas.push(hijo);
        });
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
        piezas.forEach(function(el) { el.classList.add('is-visible'); });
        return;
    }
    var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    piezas.forEach(function(el) { io.observe(el); });
})();

// Aviso informativo de cookies (clave "dd_aviso_cookies" en localStorage,
// descrita en cookies.html; se borra desde esa misma página).
(function() {
    var aviso = document.getElementById('aviso-cookies');
    var visto = null;
    try { visto = localStorage.getItem('dd_aviso_cookies'); } catch(e) {}
    if (!visto) aviso.hidden = false;
    document.getElementById('aviso-cookies-ok').addEventListener('click', function() {
        try { localStorage.setItem('dd_aviso_cookies', '1'); } catch(e) {}
        aviso.hidden = true;
    });
})();


// Respuesta táctil de botones y tarjetas (solo transform; respeta movimiento reducido).
document.addEventListener('DOMContentLoaded', function () {
    if (!window.NSDSpring) return;
    document.querySelectorAll('.btn-primary, .btn-secondary, .dd-tier, .dd-enlace-grande').forEach(function (el) {
        window.NSDSpring.tacto(el, { escala: el.matches('.dd-tier, .dd-enlace-grande') ? 0.985 : 0.96 });
    });
});
