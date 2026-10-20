// Motor de consejos del check-in. Reglas propias, sin IA ni coste.
// Entrada: el check-in recién guardado y el historial del jugador (más reciente
// primero). Salida: un consejo principal, hasta dos secundarios, alertas para
// el entrenador y el resumen de la semana.
//
// Las reglas siguen data/checkin.json → base_cientifica. Los umbrales son
// prudentes: el consejo orienta, no diagnostica.

'use strict';

const DIA = 86400000;

function carga(c) {
  return (Number(c.rpe) || 0) * (Number(c.duracion_min) || 0);
}

function lunes(d) {
  const x = new Date(d);
  const dia = (x.getUTCDay() + 6) % 7;
  x.setUTCHours(0, 0, 0, 0);
  return new Date(x.getTime() - dia * DIA);
}

// Carga de la semana actual frente a la media de las 3 anteriores (relación
// aguda/crónica simplificada). Solo se usa como aviso orientativo.
function resumenSemana(historial, ahora) {
  const ini = lunes(ahora || new Date()).getTime();
  const semanas = [0, 0, 0, 0];
  const sesiones = [0, 0, 0, 0];
  for (const c of historial) {
    const t = new Date(c.fecha + 'T12:00:00Z').getTime();
    const idx = t >= ini ? 0 : Math.floor((ini - t) / (7 * DIA)) + 1;
    if (idx >= 0 && idx < 4) { semanas[idx] += carga(c); sesiones[idx]++; }
  }
  const previas = semanas.slice(1).filter((v, i) => sesiones[i + 1] > 0);
  const media = previas.length ? previas.reduce((a, b) => a + b, 0) / previas.length : 0;
  return {
    carga_semana: semanas[0],
    sesiones_semana: sesiones[0],
    media_semanas_previas: Math.round(media),
    relacion: media > 0 ? Math.round((semanas[0] / media) * 100) / 100 : null,
  };
}

function cuenta(lista, fn) { return lista.reduce((n, x) => n + (fn(x) ? 1 : 0), 0); }

function aspectoTexto(catalogo, id) {
  const a = (catalogo.aspectos || []).find((x) => x.id === id);
  return a ? a.t.toLowerCase() : id;
}

function generar(c, historialPrevio, catalogo, ahora, extra) {
  extra = extra || {};
  const todos = [c].concat(historialPrevio || []);
  const ult5 = todos.slice(0, 5);
  const semana = resumenSemana(todos, ahora);
  const consejos = [];
  const alertas = [];
  const add = (prioridad, id, texto) => consejos.push({ prioridad, id, texto });

  // 1. Molestias que limitan: seguridad primero.
  if (c.dolor === 2) {
    const zona = (c.dolor_zona || []).join(', ');
    add(100, 'dolor', 'Cuéntaselo hoy a tu familia y a tu entrenador. Si te duele al apoyar, se hincha o sigue mañana, que lo vea un profesional antes de volver a entrenar fuerte.');
    alertas.push({ tipo: 'dolor', nivel: 'alta', texto: 'Molestia que le ha limitado' + (zona ? ' (' + zona + ')' : '') });
  } else if (c.dolor === 1 && cuenta(ult5, (x) => x.dolor >= 1) >= 3) {
    add(70, 'dolor_repetido', 'Es la tercera sesión seguida con alguna molestia. Coméntalo con tu entrenador para ajustar la carga.');
    alertas.push({ tipo: 'dolor', nivel: 'media', texto: 'Molestias en 3 de las últimas 5 sesiones' });
  }
  if ((c.dolor_zona || []).includes('cabeza')) {
    alertas.push({ tipo: 'dolor', nivel: 'alta', texto: 'Ha marcado molestia en la cabeza: confirmar que no hubo golpe' });
  }

  // 2. Ánimo bajo mantenido. Mensaje de apoyo, nunca de diagnóstico.
  if (c.animo != null && cuenta(ult5, (x) => x.animo != null && x.animo <= 2) >= 3) {
    add(90, 'animo', 'Llevas varios días sin sentirte bien. Hablarlo con alguien de confianza (tu familia, tu entrenador) ayuda más de lo que parece. No tienes que llevarlo solo.');
    alertas.push({ tipo: 'animo', nivel: 'media', texto: 'Ánimo bajo en 3 de las últimas 5 sesiones' });
  }

  // 3. Carga semanal muy por encima de lo habitual.
  if (semana.relacion && semana.relacion >= 1.5 && semana.sesiones_semana >= 3) {
    add(80, 'carga', 'Esta semana llevas bastante más carga de lo normal (' + semana.relacion + ' veces tu media). Prioriza dormir bien y no añadas entrenos extra hasta el lunes.');
    alertas.push({ tipo: 'carga', nivel: 'media', texto: 'Carga semanal ' + semana.relacion + 'x su media' });
  }

  // 4. Sueño corto repetido.
  if (c.sueno && cuenta(todos.slice(0, 3), (x) => x.sueno === 'menos7' || x.sueno === '7a8') >= 2) {
    add(60, 'sueno', 'Duermes menos de 8 horas. A tu edad el cuerpo mejora mientras duermes: intenta 8 a 10 horas, sobre todo antes de los días de partido.');
  }

  // 5. Nervios que bloquean en partido.
  if (c.nervios === 'bloquearon') {
    add(55, 'nervios', 'Prueba una rutina corta antes del salto inicial: tres respiraciones lentas y una palabra clave que te devuelva a tu primera tarea en pista.');
  }

  // 6. Causa externa: devolver la atención a lo que sí depende de él.
  if (c.causa === 'externo') {
    add(50, 'externo', 'El árbitro, el rival o la suerte no los controlas. Lo que sí: tu esfuerzo y la siguiente jugada. Para la próxima sesión, céntrate en eso.');
  } else if (c.causa === 'cansancio' && c.rpe >= 7) {
    add(45, 'cansancio', 'Sesión dura y te faltó fuelle. Hidrátate, come algo en la hora siguiente y duerme bien hoy.');
  } else if (c.causa === 'concentracion') {
    add(40, 'concentracion', 'Elige una palabra clave (por ejemplo «siguiente») para volver a la jugada cuando desconectes.');
  }

  // 7. Foco cumplido varias veces: toca subir el listón.
  const focoSi = cuenta(todos.slice(0, 3), (x) => x.foco_cumplido === 2);
  if (focoSi >= 3) {
    add(35, 'foco_nuevo', 'Has cumplido tu foco tres sesiones seguidas. Es momento de elegir uno nuevo y algo más difícil.');
  } else if (c.foco_cumplido === 0 && historialPrevio && historialPrevio[0] && historialPrevio[0].foco_cumplido === 0) {
    add(30, 'foco_dificil', 'Dos sesiones sin cumplir el foco: hazlo más pequeño. Un detalle concreto que puedas repetir en cada jugada.');
  }

  // 9. Disfrute bajo mantenido: es lo que más predice que un jugador abandone.
  if (c.disfrute != null && cuenta(ult5, (x) => x.disfrute != null && x.disfrute <= 2) >= 3) {
    add(85, 'disfrute', 'Últimamente estás disfrutando poco. Es normal tener rachas, pero cuéntaselo a tu entrenador: se puede cambiar el tipo de trabajo para que vuelva a ser tuyo.');
    alertas.push({ tipo: 'animo', nivel: 'media', texto: 'Disfrute bajo en 3 de las últimas 5 sesiones' });
  }

  // 10. Horas de deporte organizado por semana por encima de la edad (Jayanthi et al.).
  if (extra.edad) {
    const ini = lunes(ahora || new Date()).getTime();
    const minutos = todos.filter((x) => new Date(x.fecha + 'T12:00:00Z').getTime() >= ini).reduce((s, x) => s + (Number(x.duracion_min) || 0), 0);
    const horas = Math.round((minutos / 60) * 10) / 10;
    if (horas > extra.edad) {
      add(75, 'horas', 'Llevas ' + horas + ' horas de entreno y partido esta semana y tienes ' + extra.edad + ' años. Por encima de tu edad en horas a la semana sube el riesgo de lesión por sobrecarga: guarda un día de descanso completo.');
      alertas.push({ tipo: 'carga', nivel: 'media', texto: horas + ' h de deporte organizado esta semana (' + extra.edad + ' años)' });
    }
  }

  // 11. Estirón: crecer rápido aumenta el riesgo de lesión.
  if (extra.crecimiento != null && extra.crecimiento >= 7) {
    add(72, 'estiron', 'Estás creciendo rápido (unos ' + extra.crecimiento + ' cm al año). En el estirón el cuerpo es más vulnerable: más técnica y coordinación, menos saltos repetidos, y avisa si te duele la rodilla o el talón.');
    alertas.push({ tipo: 'crecimiento', nivel: 'media', texto: 'Estirón: ' + extra.crecimiento + ' cm/año' });
  }

  // 12. Calentamiento: 10 minutos de trabajo neuromuscular reducen las lesiones de tobillo y rodilla.
  if (c.calentamiento === 0) {
    add(65, 'calentamiento', 'Hoy no has calentado. Los 10 minutos del Calentamiento Dragons (equilibrio, saltos y aterrizajes, fuerza y cambios de dirección) reducen alrededor de un tercio las lesiones de tobillo y rodilla.');
  } else if (c.calentamiento === 1 && cuenta(todos.slice(0, 3), (x) => x.calentamiento != null && x.calentamiento < 2) >= 2) {
    add(40, 'calentamiento_medias', 'Varias sesiones calentando a medias. La parte de equilibrio y aterrizajes es la que más protege: no te la saltes.');
  }

  // 8. Siempre: refuerzo de lo bueno y conexión con la próxima sesión.
  if (c.mejor) {
    add(10, 'refuerzo', 'Lo mejor de hoy ha sido tu ' + aspectoTexto(catalogo, c.mejor) + '. Apúntatelo: es una base para la próxima sesión.');
  }

  consejos.sort((a, b) => b.prioridad - a.prioridad);
  return {
    principal: consejos[0] || null,
    otros: consejos.slice(1, 3),
    alertas,
    semana,
  };
}

// Forma del jugador para el entrenador: media de energía, concentración y
// foco cumplido de los últimos check-ins (escala 0 a 5). No es una nota.
function forma(historial, ventana) {
  const ult = historial.slice(0, ventana || 5);
  const vals = [];
  for (const c of ult) {
    const partes = [];
    if (c.energia != null) partes.push(c.energia);
    if (c.concentracion != null) partes.push(c.concentracion);
    if (c.foco_cumplido != null) partes.push(1 + c.foco_cumplido * 2);
    if (partes.length) vals.push(partes.reduce((a, b) => a + b, 0) / partes.length);
  }
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

module.exports = { generar, forma, resumenSemana, carga, lunes };
