// =========================================================
// Noticias del colegio: una sola lista para el blog, la página
// de Comunidad y cualquier otro sitio que muestre novedades.
// ---------------------------------------------------------
// CÓMO AÑADIR UNA NOTICIA
// Añade un objeto al principio de la lista:
//
//   fecha      'AAAA-MM-DD'
//   titulo     Titular.
//   categoria  Una de las claves de NSD_CATEGORIAS.
//   tipo       'reportaje'  → tiene página propia (url obligatoria)
//              'comunicado' → aviso oficial; puede tener url
//              'breve'      → se lee entero aquí; no necesita página
//   resumen    Una o dos frases.
//   texto      Solo en breves: el texto completo (opcional).
//   url        Página del artículo o enlace externo.
//   etapas     Etapas a las que afecta, para filtrar (opcional).
//   webs       A que webs del grupo pertenece la noticia:
//              'colegio', 'infantil', 'campamento', 'dragons'
//              (Dolores Dragons) o 'dragonsden'.
//
//              LA REGLA, EN UNA LINEA: aqui se escriben TODAS las
//              noticias de las cinco webs. La del colegio las enseña
//              todas, siempre, sea cual sea este campo, porque es la
//              principal. Las otras cuatro enseñan solo aquellas en
//              cuyo campo 'webs' aparece su clave.
//
//              Asi, una noticia de la escuela infantil sale en la
//              escuela infantil y, ademas, en la del colegio; y una
//              del colegio sale solo en la del colegio, salvo que se
//              le añada otra web. Una noticia puede pertenecer a
//              varias: ['infantil', 'campamento'].
//
//              Despues de tocar este archivo hay que pasar
//              `node _DISENO/sincronizar.js`, que lo reparte a las
//              cinco webs, y volver a publicarlas.
//   imagen     Portada de la noticia. Si falta, se pinta un color
//              con el icono de su categoria.
//   documento  Opcional. { url, titulo, peso } de un PDF relacionado:
//              la tarjeta lo señala con un icono y el post, si lo
//              tiene, con un botón para verlo o descargarlo.
// =========================================================
window.NSD_CATEGORIAS = {
  cultura:     { nombre: 'Cultura',     icono: 'bi-palette' },
  familias:    { nombre: 'Familias',    icono: 'bi-people' },
  eso:         { nombre: 'ESO',         icono: 'bi-mortarboard' },
  salud:       { nombre: 'Salud',       icono: 'bi-heart-pulse' },
  servicios:   { nombre: 'Servicios',   icono: 'bi-cup-hot' },
  comunicados: { nombre: 'Comunicados', icono: 'bi-megaphone' },
  deporte:     { nombre: 'Deporte',     icono: 'bi-dribbble' },
  academia:    { nombre: 'Academia',    icono: 'bi-trophy' }
};

window.NSD_NOTICIAS = [
  // ── El lanzamiento de las cinco webs ──
  {
    fecha: '2026-09-21',
    titulo: 'Estrenamos web',
    webs: ['colegio', 'infantil', 'campamento'],
    imagen: '/assets/img/fotos/fachada-nsd-800.webp',
    imagenAlt: 'Fachada del Colegio Nuestra Señora de los Dolores',
    categoria: 'familias',
    tipo: 'reportaje',
    resumen: 'El Colegio NSD estrena web, y con ella toda la familia: Escuela Infantil, Campamento Urbano, Dolores Dragons y Dragons Den. Todo en un solo sitio.',
    url: '/blog/estrenamos-web'
  },

  // ── De la web de Dolores Dragons ──
  // Se escribe aqui como todas las demas: sale en su web y, ademas, en
  // la del colegio. La url es absoluta porque el articulo largo vive en
  // su propia web.
  {
    fecha: '2026-03-28',
    titulo: 'Semana Santa y la Copa Primavera',
    webs: ['dragons'],
    imagen: '/assets/img/fotos/dragons-copa-800.webp',
    imagenAlt: 'Canasta de baloncesto vista desde abajo contra el cielo',
    categoria: 'deporte',
    tipo: 'reportaje',
    resumen: 'Las aulas se vacían pero el balón no para. Días para recuperarse antes del desafío que cierra la temporada: la Copa Primavera.',
    url: 'https://dolores-dragons.vercel.app/?noticia=vacaciones-semana-santa-copa-primavera#noticias'
  },
  {
    fecha: '2026-03-22',
    titulo: 'Victoria del Cadete Femenino ante Fundación Balia',
    webs: ['dragons'],
    imagen: '/assets/img/fotos/dragons-cadete-800.webp',
    imagenAlt: 'Jugadoras de baloncesto durante un partido en pista cubierta',
    categoria: 'deporte',
    tipo: 'reportaje',
    resumen: 'Las Dragons se imponen por 37-12 en un partido dominado de principio a fin, con una defensa que dejó al rival sin vías de anotación.',
    url: 'https://dolores-dragons.vercel.app/?noticia=victoria-cadete-femenino-fundacion-balia#noticias'
  },
  {
    fecha: '2025-09-02',
    titulo: 'Inscripción 2025-2026: únete a los Dragons',
    webs: ['dragons', 'colegio'],
    imagen: '/assets/img/fotos/dragons-inscripcion-800.webp',
    imagenAlt: 'Grupo de jóvenes jugando al baloncesto en una pista exterior',
    categoria: 'deporte',
    tipo: 'comunicado',
    resumen: 'Categorías, horarios de entrenamiento y cuotas de la temporada del club de baloncesto del colegio. Las plazas van por orden de inscripción.',
    url: 'https://dolores-dragons.vercel.app/?noticia=inscripcion-2025-2026#inscripcion'
  },
  {
    fecha: '2025-09-01',
    titulo: 'Arranca la temporada 2025-26 de los Dragons',
    webs: ['dragons'],
    imagen: '/assets/img/fotos/dragons-temporada-800.webp',
    imagenAlt: 'Balón de baloncesto entrando en la canasta',
    categoria: 'deporte',
    tipo: 'breve',
    resumen: 'Empieza el curso en el club de baloncesto del colegio: equipos, entrenadores y el calendario de la primera vuelta.',
    texto: 'El club arranca la temporada con todas sus categorías en marcha. Los horarios de entrenamiento de cada equipo y el calendario de la primera vuelta están en la web del club.',
    url: 'https://dolores-dragons.vercel.app/?noticia=bienvenidos-nueva-temporada-2025-26#noticias'
  },
  {
    fecha: '2025-09-01',
    titulo: 'Boletín informativo 2025-2026',
    webs: ['colegio', 'infantil', 'campamento', 'dragons'],
    imagen: '/assets/img/fotos/fachada-color-800.webp',
    imagenAlt: 'Fachada del colegio, con las lamas de colores y el rótulo del centro',
    categoria: 'familias',
    tipo: 'comunicado',
    resumen: 'Toda la información del curso 2025-2026: calendario, horarios, libros de texto, servicios, reuniones de inicio y novedades.',
    url: '/blog/boletin-25-26',
    etapas: ['infantil', 'primaria', 'eso']
  },
  {
    fecha: '2025-03-26',
    titulo: '4.º de ESO + Empresa',
    webs: ['colegio'],
    imagen: '/assets/img/fotos/diplomas-800.webp',
    imagenAlt: 'Alumnos del colegio en el salón de actos con sus diplomas',
    documento: { url: '/assets/docs/4eso-empresa.pdf', titulo: 'Memoria de 4.º ESO + Empresa', peso: '9,3 MB' },
    categoria: 'eso',
    tipo: 'reportaje',
    resumen: 'Los alumnos de 4.º descubren el mundo laboral con estancias formativas en empresas colaboradoras. En qué consiste, qué sectores y cómo se organiza.',
    url: '/blog/4eso-empresa',
    etapas: ['eso']
  },
  {
    fecha: '2025-03-23',
    titulo: 'XXXVI Semana Cultural',
    webs: ['colegio', 'infantil'],
    imagen: '/assets/img/fotos/carnaval-800.webp',
    imagenAlt: 'Alumnos disfrazados sentados en el patio durante la semana cultural',
    categoria: 'cultura',
    tipo: 'reportaje',
    resumen: 'Talleres, conciertos, gymkanas y actividades intercicladas en torno al lema de este año. El resumen, día a día, con galería.',
    url: '/blog/xxxvi-semana-cultural',
    etapas: ['infantil', 'primaria', 'eso']
  },
  {
    fecha: '2025-01-13',
    titulo: 'Programa de Leche y Fruta de la UE',
    webs: ['colegio', 'infantil'],
    imagen: '/assets/img/fotos/programa-frutas-800.webp',
    imagenAlt: 'Cartel del Programa Escolar de Consumo de Frutas, Hortalizas y Leche de la Unión Europea',
    categoria: 'salud',
    tipo: 'breve',
    resumen: 'El colegio vuelve a participar en el programa europeo de consumo de fruta, hortalizas y leche en las escuelas.',
    texto: 'El programa, financiado por la Unión Europea, reparte fruta y lácteos en los centros escolares para promover hábitos de alimentación saludables entre los alumnos.',
    etapas: ['infantil', 'primaria']
  },
  {
    fecha: '2024-04-14',
    titulo: 'Los comunicados a las familias, en Alexia',
    webs: ['colegio', 'infantil', 'campamento'],
    imagen: '/assets/img/fotos/netiqueta-800.webp',
    imagenAlt: 'Cabecera del programa NETiqueta sobre uso responsable de internet',
    categoria: 'comunicados',
    tipo: 'comunicado',
    resumen: 'Las circulares y avisos del colegio se envían a través de la plataforma Alexia. Conviene tener la app instalada y las notificaciones activadas.',
    url: 'https://web2.alexiaedu.com/ACWeb/LogOn.aspx'
  },
  {
    fecha: '2024-04-04',
    titulo: 'XXXV Semana Cultural',
    webs: ['colegio'],
    imagen: '/assets/img/fotos/mural-800.webp',
    imagenAlt: 'Mural colectivo pintado entre todos sobre papel continuo',
    categoria: 'cultura',
    tipo: 'breve',
    resumen: 'La trigésimo quinta edición de la Semana Cultural llenó el colegio de talleres y actividades para todas las etapas.',
    etapas: ['infantil', 'primaria', 'eso']
  },
  {
    fecha: '2023-09-08',
    titulo: 'Vuelven los desayunos escolares',
    webs: ['colegio', 'infantil'],
    imagen: '/assets/img/fotos/patio-800.webp',
    imagenAlt: 'Niños en el patio del colegio a primera hora',
    categoria: 'servicios',
    tipo: 'breve',
    resumen: 'El servicio de desayunos vuelve a estar disponible para todas las familias del centro.',
    texto: 'Los precios del desayuno y de la merienda de este curso están en la página del comedor.',
    url: '/servicios/comedor'
  }
];

// ---------------------------------------------------------
// PORTADA DE CADA NOTICIA
// Si la noticia tiene `imagen` (ruta a una foto real del colegio, con
// `imagenAlt`), se usa esa. Mientras no la haya, se compone una con el
// color y el icono de su categoría: queda visual y coherente, y no
// cuela una foto de banco que no es del centro.
// ---------------------------------------------------------
window.NSD_TONOS = {
  cultura:     ['#7B2D8E', '#C86BD8'],
  familias:    ['#1A7040', '#5EBF78'],
  eso:         ['#1D4E89', '#5A9BD8'],
  salud:       ['#B23A48', '#F08A8A'],
  servicios:   ['#9A5B00', '#F0B95C'],
  comunicados: ['#3C4A54', '#8FA3B0'],
  deporte:     ['#B1420A', '#F2954A'],
  academia:    ['#6B2D8C', '#B37AD1']
};

window.NSD_PORTADA = function (n, clase) {
  const c = window.NSD_CATEGORIAS[n.categoria] || { nombre: 'Colegio', icono: 'bi-newspaper' };
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  if (n.imagen) {
    return `<span class="portada-noticia ${clase || ''}">
      <img src="${esc(n.imagen)}" alt="${esc(n.imagenAlt)}" loading="lazy" decoding="async" width="800" height="520" />
    </span>`;
  }
  const t = window.NSD_TONOS[n.categoria] || ['#10572C', '#5EBF78'];
  return `<span class="portada-noticia portada-noticia--pintada ${clase || ''}" style="--t1:${t[0]};--t2:${t[1]}" aria-hidden="true">
    <i class="bi ${c.icono}"></i>
    <b>${esc(c.nombre)}</b>
  </span>`;
};
