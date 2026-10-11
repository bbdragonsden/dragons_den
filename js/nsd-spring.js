/**
 * nsd-spring.js — motor de muelles minimo, inspirado en las charlas de
 * Apple sobre interfaces fluidas (WWDC 2018, "Designing Fluid Interfaces").
 *
 * En vez de masa/rigidez/friccion se piensa en dos parametros de diseno:
 *   - damping (0-1): 1 = critico, sin rebote. <1 = rebota mas cuanto mas bajo.
 *   - response (segundos): que tan rapido llega al objetivo. No es una
 *     duracion fija: el muelle se puede interrumpir y redirigir en cualquier
 *     instante, y arranca siempre desde el valor visible actual, nunca
 *     desde el valor logico/objetivo (evita el salto visual al interrumpir).
 *
 * Solo anima transform y opacity (propiedades que no disparan layout/paint),
 * y respeta prefers-reduced-motion: en ese caso salta directo al valor final.
 */
(function (global) {
  'use strict';

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Un unico valor animado con muelle. Interrumpible: llamar a .to() de
   * nuevo en cualquier momento retoma desde la posicion y velocidad
   * actuales, sin discontinuidad ("brick wall").
   */
  class Spring {
    constructor(value = 0, { damping = 1, response = 0.35, onUpdate, onSettle } = {}) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.damping = damping;
      this.response = response;
      this.onUpdate = onUpdate;
      this.onSettle = onSettle;
      this._raf = null;
      this._lastT = 0;
    }

    // Redirige el muelle a un nuevo objetivo sin cortar la velocidad actual.
    to(target, velocityBoost = 0) {
      this.target = target;
      if (velocityBoost) this.velocity += velocityBoost;
      if (reduceMotion()) {
        this.value = target;
        this.velocity = 0;
        this.onUpdate && this.onUpdate(this.value);
        this.onSettle && this.onSettle();
        return this;
      }
      if (!this._raf) this._tick();
      return this;
    }

    // Salta al valor sin animar (p.ej. al inicializar).
    jump(value) {
      this.stop();
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.onUpdate && this.onUpdate(this.value);
      return this;
    }

    stop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    _tick(t) {
      if (!this._lastT) this._lastT = t || performance.now();
      const now = t || performance.now();
      let dt = (now - this._lastT) / 1000;
      // Evita saltos si la pestana estuvo en segundo plano. Nunca negativo:
      // el primer fotograma puede traer una marca de tiempo anterior a la
      // del evento que lo lanzo, y un paso negativo mete energia al muelle.
      dt = Math.min(Math.max(dt, 0), 0.032);
      this._lastT = now;

      // Conversion damping/response -> rigidez/friccion (parametrizacion de
      // Apple: response = tiempo hasta el objetivo, damping = forma).
      const angularFreq = (2 * Math.PI) / Math.max(this.response, 0.01);
      const stiffness = angularFreq * angularFreq;
      const dampingCoef = 2 * this.damping * angularFreq;

      const displacement = this.value - this.target;
      // Se integra en pasos de 1/240 s como maximo: con un paso de
      // fotograma entero a 30 fps (modo ahorro, moviles modestos) el muelle
      // rapido de "tacto" se volvia inestable y el boton oscilaba cada vez mas.
      const pasos = Math.max(1, Math.ceil(dt * 240));
      const h = dt / pasos;
      for (let i = 0; i < pasos; i++) {
        const accel = -stiffness * (this.value - this.target) - dampingCoef * this.velocity;
        this.velocity += accel * h;
        this.value += this.velocity * h;
      }

      this.onUpdate && this.onUpdate(this.value);

      const settled = Math.abs(this.velocity) < 0.01 && Math.abs(displacement) < 0.01;
      if (settled) {
        this.value = this.target;
        this.onUpdate && this.onUpdate(this.value);
        this._raf = null;
        this._lastT = 0;
        this.onSettle && this.onSettle();
        return;
      }
      this._raf = requestAnimationFrame((tt) => this._tick(tt));
    }
  }

  // Presets tal cual los usa Apple en sus propios componentes.
  const PRESETS = {
    reposicionar: { damping: 1, response: 0.4 },
    rotacion:      { damping: 0.8, response: 0.4 },
    hoja:          { damping: 0.8, response: 0.3 },
    tacto:         { damping: 1, response: 0.22 },
  };

  // Proyecta donde acabaria un gesto por su velocidad de salida (igual que
  // la deceleracion de scroll de iOS): usado para "lanzar" tarjetas/paneles.
  function proyectarMomentum(velocidadPxSeg, tasaDeceleracion = 0.998) {
    return ((velocidadPxSeg / 1000) * tasaDeceleracion) / (1 - tasaDeceleracion);
  }

  /**
   * Da a un elemento respuesta tactil instantanea: escala al pulsar
   * (pointerdown, no click) y vuelve con un muelle al soltar/salir.
   * No sustituye el CSS :active existente, lo complementa con muelle real.
   */
  function tacto(el, { escala = 0.96, preset = 'tacto' } = {}) {
    if (!el || el.__nsdTactoInit) return;
    el.__nsdTactoInit = true;
    const cfg = PRESETS[preset] || PRESETS.tacto;
    // Se anima la propiedad independiente `scale` (no `transform`): asi el
    // muelle no pisa el transform del :hover de la hoja de estilos (antes,
    // tras el primer clic quedaba un transform en linea que anulaba para
    // siempre la elevacion del hover) ni se mezcla con las transiciones CSS
    // declaradas sobre transform, que suavizaban cada fotograma y hacian la
    // respuesta perezosa. Navegadores sin `scale`: se mantiene transform.
    const usaScale = 'scale' in el.style;
    el.setAttribute('data-tacto', '');
    const s = new Spring(1, {
      ...cfg,
      onUpdate: (v) => {
        if (usaScale) el.style.scale = v === 1 ? '' : String(v);
        else el.style.transform = v === 1 ? '' : `scale(${v})`;
      },
    });
    // Con movimiento reducido no se escala: el :active de color basta.
    const bajar = () => { if (!reduceMotion()) s.to(escala); };
    const soltar = () => s.to(1);
    el.addEventListener('pointerdown', bajar, { passive: true });
    el.addEventListener('pointerup', soltar, { passive: true });
    el.addEventListener('pointercancel', soltar, { passive: true });
    el.addEventListener('pointerleave', soltar, { passive: true });
  }

  global.NSDSpring = { Spring, PRESETS, proyectarMomentum, tacto, reduceMotion };
})(window);
