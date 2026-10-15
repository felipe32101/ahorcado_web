/**
 * palabras.js
 * ---------------------------------------------------------------
 * Banco de datos del juego: las 32 capitales departamentales de
 * Colombia junto con las regiones y niveles disponibles.
 *
 * Expone el espacio de nombres global `Palabras` con:
 *  - CAPITALES          : arreglo de objetos { capital, departamento, region, letras, nivel }
 *  - REGIONES           : catálogo de regiones geográficas (HU-01)
 *  - NIVELES            : configuración de dificultad (HU-02)
 *  - normalizar()       : convierte a mayúsculas y elimina las tildes
 *  - filtrarCapitales() : filtra el banco por región (CP-14)
 *  - filtrarPorNivel()  : filtra por longitud según el nivel
 *  - obtenerCapital()   : selecciona una capital aleatoria (región + nivel)
 *
 * Se usa un IIFE con scripts clásicos (sin `type="module"`) para
 * garantizar la portabilidad RNF-07: el juego funciona abriendo
 * index.html directamente con doble clic (file://).
 */
(function (global) {
  'use strict';

  /* ----------------------------------------------------------
   * 1. Banco de las 32 capitales
   *    `lat` / `lon` son coordenadas decimales usadas para ubicar
   *    la capital sobre el mapa real de Colombia (WGS 84).
   * -------------------------------------------------------- */
  const CAPITALES = [
    { capital: 'Leticia',              departamento: 'Amazonas',               region: 'Amazonía',   letras: 7,  nivel: 'Medio',    lat: -4.2140, lon: -73.3580 },
    { capital: 'Medellín',             departamento: 'Antioquia',              region: 'Andina',     letras: 8,  nivel: 'Medio',    lat:  6.2476, lon: -75.5658 },
    { capital: 'Arauca',               departamento: 'Arauca',                 region: 'Orinoquía',  letras: 6,  nivel: 'Fácil',    lat:  7.0840, lon: -70.7590 },
    { capital: 'Barranquilla',         departamento: 'Atlántico',              region: 'Caribe',     letras: 12, nivel: 'Difícil',  lat: 10.9685, lon: -74.7813 },
    { capital: 'Cartagena',            departamento: 'Bolívar',                region: 'Caribe',     letras: 9,  nivel: 'Medio',    lat: 10.3910, lon: -75.4794 },
    { capital: 'Tunja',                departamento: 'Boyacá',                 region: 'Andina',     letras: 5,  nivel: 'Fácil',    lat:  5.5350, lon: -73.3670 },
    { capital: 'Manizales',            departamento: 'Caldas',                 region: 'Andina',     letras: 9,  nivel: 'Medio',    lat:  5.0680, lon: -75.5170 },
    { capital: 'Florencia',            departamento: 'Caquetá',                region: 'Amazonía',   letras: 9,  nivel: 'Medio',    lat:  1.6140, lon: -75.6070 },
    { capital: 'Yopal',                departamento: 'Casanare',               region: 'Orinoquía',  letras: 5,  nivel: 'Fácil',    lat:  5.3370, lon: -72.3950 },
    { capital: 'Popayán',              departamento: 'Cauca',                  region: 'Andina',     letras: 7,  nivel: 'Medio',    lat:  2.4440, lon: -76.6140 },
    { capital: 'Valledupar',           departamento: 'Cesar',                  region: 'Caribe',     letras: 10, nivel: 'Difícil',  lat: 10.4630, lon: -73.2530 },
    { capital: 'Quibdó',               departamento: 'Chocó',                  region: 'Pacífica',   letras: 6,  nivel: 'Fácil',    lat:  5.6910, lon: -76.6570 },
    { capital: 'Montería',             departamento: 'Córdoba',                region: 'Caribe',     letras: 8,  nivel: 'Medio',    lat:  8.7470, lon: -75.8860 },
    { capital: 'Bogotá',               departamento: 'Cundinamarca',           region: 'Andina',     letras: 6,  nivel: 'Fácil',    lat:  4.7110, lon: -74.0721 },
    { capital: 'Inírida',              departamento: 'Guainía',                region: 'Amazonía',   letras: 7,  nivel: 'Medio',    lat:  3.8650, lon: -67.9060 },
    { capital: 'San José del Guaviare', departamento: 'Guaviare',              region: 'Amazonía',   letras: 18, nivel: 'Difícil',  lat:  2.5730, lon: -72.6460 },
    { capital: 'Neiva',                departamento: 'Huila',                  region: 'Andina',     letras: 5,  nivel: 'Fácil',    lat:  2.9270, lon: -75.2810 },
    { capital: 'Riohacha',             departamento: 'La Guajira',             region: 'Caribe',     letras: 8,  nivel: 'Medio',    lat: 11.5440, lon: -72.9070 },
    { capital: 'Santa Marta',          departamento: 'Magdalena',              region: 'Caribe',     letras: 10, nivel: 'Difícil',  lat: 11.2408, lon: -74.1990 },
    { capital: 'Villavicencio',        departamento: 'Meta',                   region: 'Orinoquía',  letras: 13, nivel: 'Difícil',  lat:  4.1420, lon: -73.6266 },
    { capital: 'Pasto',                departamento: 'Nariño',                 region: 'Andina',     letras: 5,  nivel: 'Fácil',    lat:  1.2130, lon: -77.2810 },
    { capital: 'Cúcuta',               departamento: 'Norte de Santander',     region: 'Andina',     letras: 6,  nivel: 'Fácil',    lat:  7.8890, lon: -72.4920 },
    { capital: 'Mocoa',                departamento: 'Putumayo',               region: 'Amazonía',   letras: 5,  nivel: 'Fácil',    lat:  2.4410, lon: -76.9160 },
    { capital: 'Armenia',              departamento: 'Quindío',                region: 'Andina',     letras: 7,  nivel: 'Medio',    lat:  4.5330, lon: -75.6810 },
    { capital: 'Pereira',              departamento: 'Risaralda',              region: 'Andina',     letras: 7,  nivel: 'Medio',    lat:  4.8140, lon: -75.6940 },
    { capital: 'San Andrés',           departamento: 'San Andrés y Providencia', region: 'Insular',   letras: 9,  nivel: 'Medio',    lat: 12.5847, lon: -81.7006 },
    { capital: 'Bucaramanga',          departamento: 'Santander',              region: 'Andina',     letras: 11, nivel: 'Difícil',  lat:  7.1240, lon: -73.1190 },
    { capital: 'Sincelejo',            departamento: 'Sucre',                  region: 'Caribe',     letras: 9,  nivel: 'Medio',    lat:  9.3040, lon: -75.3970 },
    { capital: 'Ibagué',               departamento: 'Tolima',                 region: 'Andina',     letras: 6,  nivel: 'Fácil',    lat:  4.4380, lon: -75.2320 },
    { capital: 'Cali',                 departamento: 'Valle del Cauca',        region: 'Pacífica',   letras: 4,  nivel: 'Fácil',    lat:  3.4516, lon: -76.5320 },
    { capital: 'Mitú',                 departamento: 'Vaupés',                 region: 'Amazonía',   letras: 4,  nivel: 'Fácil',    lat:  1.2530, lon: -70.2340 },
    { capital: 'Puerto Carreño',       departamento: 'Vichada',                region: 'Orinoquía',  letras: 13, nivel: 'Difícil',  lat:  6.1870, lon: -67.4730 }
  ];

  /* ----------------------------------------------------------
   * 1.1 Límites geográficos del mapa de Colombia utilizado
   *     (proyección equirectangular, ver README → Créditos).
   * -------------------------------------------------------- */
  const LIMITES_MAPA = {
    norte: 16.78333,      // latitud máxima
    sur: -4.45,           // latitud mínima
    oeste: -85.2,         // longitud mínima
    este: -66.53333       // longitud máxima
  };

  /* ----------------------------------------------------------
   * 2. Regiones geográficas (HU-01)
   * -------------------------------------------------------- */
  const REGIONES = [
    { id: 'todas',     nombre: 'Todas las regiones', color: '#1F3864' },
    { id: 'andina',    nombre: 'Andina',             color: '#2E74B5' },
    { id: 'caribe',    nombre: 'Caribe',             color: '#D64545' },
    { id: 'pacifica',  nombre: 'Pacífica',           color: '#2E9E5B' },
    { id: 'orinoquia', nombre: 'Orinoquía',          color: '#C88A2E' },
    { id: 'amazonia',  nombre: 'Amazonía',           color: '#1E7A8C' },
    { id: 'insular',   nombre: 'Insular',            color: '#7A4FB5' }
  ];

  /* ----------------------------------------------------------
   * 3. Niveles de dificultad (HU-02)
   *  - Fácil    : 4 a 6 letras, 2 pistas, sin tiempo, x1
   *  - Medio    : 7 a 9 letras, 1 pista,  sin tiempo, x2
   *  - Difícil  : 10 o más letras, 0 pistas, 90 s,    x3
   * -------------------------------------------------------- */
  const NIVELES = {
    facil: {
      id: 'facil',
      nombre: 'Fácil',
      letrasMinimas: 4,
      letrasMaximas: 6,
      pistasIniciales: 2,
      tiempoLimite: null,
      multiplicador: 1,
      descripcion: 'Palabras de 4 a 6 letras · 2 pistas · sin límite de tiempo · puntaje x1'
    },
    medio: {
      id: 'medio',
      nombre: 'Medio',
      letrasMinimas: 7,
      letrasMaximas: 9,
      pistasIniciales: 1,
      tiempoLimite: null,
      multiplicador: 2,
      descripcion: 'Palabras de 7 a 9 letras · 1 pista · sin límite de tiempo · puntaje x2'
    },
    dificil: {
      id: 'dificil',
      nombre: 'Difícil',
      letrasMinimas: 10,
      letrasMaximas: Infinity,
      pistasIniciales: 0,
      tiempoLimite: 90,
      multiplicador: 3,
      descripcion: 'Palabras de 10 o más letras · sin pistas · 90 segundos · puntaje x3'
    }
  };

  /* ----------------------------------------------------------
   * 4. Utilidades de texto
   * -------------------------------------------------------- */

  /**
   * Convierte el texto a mayúsculas y elimina las tildes (á, é, í, ó, ú, ü)
   * conservando la Ñ. Así escribir «o» revela la «Ó» de QUIBDÓ (CP-10)
   * y la «N» no revela la «Ñ» de forma errónea.
   * @param {string} texto
   * @returns {string}
   */
  function normalizar(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .toUpperCase()
      // Se protege la Ñ para que la descomposición Unicode no la convierta en N.
      .replace(/Ñ/g, '\uE000')
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/g, '')
      .replace(/\uE000/g, 'Ñ')
      .normalize('NFC');
  }

  /**
   * Elimina tildes y espacios extra; útil para comparar identificadores.
   * @param {string} texto
   * @returns {string}
   */
  function clave(texto) {
    return normalizar(texto).trim().replace(/\s+/g, ' ');
  }

  /* ----------------------------------------------------------
   * 5. Filtros del banco
   * -------------------------------------------------------- */

  /**
   * Filtra las capitales por región geográfica.
   * Con 'todas' devuelve el banco completo.
   * CP-14: filtrarCapitales('insular') devuelve únicamente San Andrés.
   * @param {string} region id de la región (ej. 'andina')
   * @returns {Array<object>}
   */
  function filtrarCapitales(region) {
    const id = clave(region || 'todas').toLowerCase();
    if (id === 'todas' || id === '') return CAPITALES.slice();
    return CAPITALES.filter((c) => clave(c.region).toLowerCase() === id);
  }

  /**
   * Filtra una lista de capitales por la longitud que corresponde al nivel.
   * @param {Array<object>} lista
   * @param {string} nivel id del nivel: 'facil' | 'medio' | 'dificil'
   * @returns {Array<object>}
   */
  function filtrarPorNivel(lista, nivel) {
    const config = NIVELES[nivel] || NIVELES.medio;
    return lista.filter(
      (c) => c.letras >= config.letrasMinimas && c.letras <= config.letrasMaximas
    );
  }

  /**
   * Devuelve true si la capital cumple con la región y el nivel pedidos.
   * @param {object} capital
   * @param {string} region
   * @param {string} nivel
   * @returns {boolean}
   */
  function cumpleFiltros(capital, region, nivel) {
    const enRegion = filtrarCapitales(region).some((c) => c.capital === capital.capital);
    return enRegion && filtrarPorNivel([capital], nivel).length === 1;
  }

  // Evita repetir la misma capital en partidas consecutivas.
  let ultimaCapital = null;

  /**
   * Selecciona una capital aleatoria según región y nivel.
   * Si la combinación región + nivel no tiene resultados (p. ej. la región
   * Insular solo tiene San Andrés, de nivel medio), se relaja el filtro de
   * nivel para que la partida siempre pueda iniciarse.
   * @param {string} region
   * @param {string} nivel
   * @returns {object} capital
   */
  function obtenerCapital(region, nivel) {
    const porRegion = filtrarCapitales(region);
    let candidatas = filtrarPorNivel(porRegion, nivel);

    if (candidatas.length === 0) {
      // Fallback 1: toda la región sin importar el nivel.
      candidatas = porRegion.length > 0 ? porRegion : CAPITALES.slice();
    }

    const sinRepetir = candidatas.filter((c) => c.capital !== ultimaCapital);
    const bolsa = sinRepetir.length > 0 ? sinRepetir : candidatas;

    const posicion = Math.floor(Math.random() * bolsa.length);
    const elegida = bolsa[posicion];
    ultimaCapital = elegida.capital;
    return elegida;
  }

  /**
   * Devuelve la cantidad de capitales que cumplen región + nivel.
   * @param {string} region
   * @param {string} nivel
   * @returns {number}
   */
  function contarCapitales(region, nivel) {
    return filtrarPorNivel(filtrarCapitales(region), nivel).length;
  }

  /* ----------------------------------------------------------
   * 6. Proyección geográfica para el mapa (posición en %)
   * -------------------------------------------------------- */

  /**
   * Convierte una coordenada WGS 84 en porcentajes sobre el mapa
   * equirectangular de Colombia (assets/img/mapa-colombia.svg).
   * @param {number} lat latitud en grados decimales
   * @param {number} lon longitud en grados decimales
   * @returns {{ x: number, y: number }} porcentajes 0–100
   */
  function proyectar(lat, lon) {
    const anchoGrados = LIMITES_MAPA.este - LIMITES_MAPA.oeste;
    const altoGrados = LIMITES_MAPA.norte - LIMITES_MAPA.sur;
    const bruto = {
      x: ((lon - LIMITES_MAPA.oeste) / anchoGrados) * 100,
      y: ((LIMITES_MAPA.norte - lat) / altoGrados) * 100
    };
    // Se mantiene el marcador dentro del marco (p. ej. Leticia, al sur
    // del cuadro del mapa, se recorta al límite inferior visible).
    return {
      x: Math.min(99, Math.max(1, bruto.x)),
      y: Math.min(99, Math.max(1, bruto.y))
    };
  }

  /* ----------------------------------------------------------
   * 6. Espacio de nombres público
   * -------------------------------------------------------- */
  global.Palabras = {
    CAPITALES,
    REGIONES,
    NIVELES,
    LIMITES_MAPA,
    normalizar,
    clave,
    filtrarCapitales,
    filtrarPorNivel,
    cumpleFiltros,
    obtenerCapital,
    contarCapitales,
    proyectar
  };
})(window);
