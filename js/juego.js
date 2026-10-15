/**
 * juego.js
 * ---------------------------------------------------------------
 * Núcleo de reglas y estado de la partida del Ahorcado.
 *
 * Expone el espacio de nombres global `Juego` con:
 *  - estado            : objeto mutable con la partida en curso
 *  - iniciarPartida()  : reinicia el estado y selecciona la capital
 *  - normalizar()      : mayúsculas + sin tildes (CP-10)
 *  - procesarLetra()   : valida la letra, puntúa y dibuja errores (CP-02/03/04)
 *  - verificarEstado() : victoria / derrota / continua (CP-06/07)
 *  - usarPista()       : departamento o letra oculta, -15 pts (CP-08, HU-05)
 *  - iniciarTemporizador() : 90 s únicamente en nivel difícil (CP-09)
 *  - sincronizarTiempo()   : recalcula el reloj contra el tiempo real
 *  - resumenPartida()  : datos para el modal y para localStorage
 *
 * Este módulo NO toca el DOM: la presentación vive en ui.js.
 */
(function (global) {
  'use strict';

  const PUNTOS_ACIERTO = 10;      // por cada aparición de la letra
  const PUNTOS_ERROR = -5;        // letra incorrecta
  const PUNTOS_PISTA = -15;       // por cada pista usada
  const PUNTOS_VICTORIA = 50;     // bonus por ganar
  const PUNTOS_VIDA = 10;         // bonus por cada vida restante
  const MAX_ERRORES = 6;

  /**
   * Estado por defecto de una partida (ver Sección 4 del documento).
   */
  function crearEstado() {
    return {
      jugador: 'Jugador1',
      region: 'todas',
      nivel: 'medio',
      capital: null,
      palabra: '',
      departamento: '',
      regionNombre: '',
      letrasAcertadas: [],
      letrasFalladas: [],
      errores: 0,
      maxErrores: MAX_ERRORES,
      pistasDisponibles: 0,
      pistaDepartamentoVisible: false,
      puntaje: 0,
      tiempoRestante: null,
      tiempoLimite: null,
      tiempoTranscurrido: 0,
      terminado: false,
      gano: false,
      inicio: null
    };
  }

  const estado = crearEstado();

  // Callbacks opcionales que registra app.js (no rompe la modularidad).
  let alAgotarTiempo = null;   // se ejecuta cuando llega a 0
  let alCambiarTiempo = null;  // se ejecuta en cada segundo transcurrido
  let intervalo = null;
  let marcaFin = null;         // instante (ms) en que se agota el tiempo

  /* ----------------------------------------------------------
   * Utilidades de texto
   * -------------------------------------------------------- */

  /**
   * Convierte a mayúsculas y elimina las tildes conservando la Ñ.
   * Escribir «o» revela la «Ó» de QUIBDÓ (CP-10).
   * @param {string} texto
   * @returns {string}
   */
  function normalizar(texto) {
    return global.Palabras.normalizar(texto);
  }

  /**
   * Letras únicas (sin tildes, sin espacios) que hay que adivinar.
   * Los espacios de las capitales compuestas nunca se adivinan (CP-13).
   * @param {string} palabra
   * @returns {Array<string>}
   */
  function letrasRequeridas(palabra) {
    const unicas = [];
    for (const caracter of String(palabra || '').toUpperCase()) {
      if (caracter === ' ' || caracter === '-' || caracter === '.') continue;
      const letra = normalizar(caracter);
      if (letra && !unicas.includes(letra)) unicas.push(letra);
    }
    return unicas;
  }

  /**
   * Devuelve true si la letra todavía no ha sido utilizada.
   * @param {string} letra
   * @returns {boolean}
   */
  function letraDisponible(letra) {
    const limpia = normalizar(letra);
    if (!limpia) return false;
    return (
      !estado.letrasAcertadas.includes(limpia) &&
      !estado.letrasFalladas.includes(limpia)
    );
  }

  /**
   * Indica si la partida ya no admite más letras.
   * @returns {boolean}
   */
  function bloqueada() {
    return estado.terminado;
  }

  /* ----------------------------------------------------------
   * Inicio de la partida
   * -------------------------------------------------------- */

  /**
   * Reinicia el estado, selecciona la capital según región y nivel,
   * y deja el tablero listo para renderizar (CP-01).
   * @param {string} region id de la región ('todas', 'andina', ...)
   * @param {string} nivel   id del nivel ('facil', 'medio', 'dificil')
   * @param {string} jugador nombre del jugador
   * @returns {object} estado de la nueva partida
   */
  function iniciarPartida(region, nivel, jugador) {
    detenerTemporizador();

    const regionElegida = region || 'todas';
    const nivelElegido = global.Palabras.NIVELES[nivel] ? nivel : 'medio';
    const configNivel = global.Palabras.NIVELES[nivelElegido];
    const capital = global.Palabras.obtenerCapital(regionElegida, nivelElegido);

    const nuevo = crearEstado();
    nuevo.jugador = (jugador || 'Jugador1').toString().trim() || 'Jugador1';
    nuevo.region = regionElegida;
    nuevo.nivel = nivelElegido;
    nuevo.capital = capital;
    nuevo.palabra = capital.capital.toUpperCase();
    nuevo.departamento = capital.departamento;
    nuevo.regionNombre = capital.region;
    nuevo.letrasAcertadas = [];
    nuevo.letrasFalladas = [];
    nuevo.errores = 0;
    nuevo.maxErrores = MAX_ERRORES;
    nuevo.pistasDisponibles = configNivel.pistasIniciales;
    nuevo.pistaDepartamentoVisible = false;
    nuevo.puntaje = 0;
    nuevo.tiempoLimite = configNivel.tiempoLimite;
    nuevo.tiempoRestante = configNivel.tiempoLimite;
    nuevo.tiempoTranscurrido = 0;
    nuevo.terminado = false;
    nuevo.gano = false;
    nuevo.inicio = Date.now();

    // Se copian los campos al objeto estado exportado (referencia estable).
    Object.assign(estado, nuevo);

    if (estado.tiempoLimite) iniciarTemporizador();
    return estado;
  }

  /* ----------------------------------------------------------
   * Temporizador (nivel difícil: 90 segundos) — CP-09
   *
   * La cuenta regresiva NO depende de cuántos intervalos se disparen:
   * se calcula siempre a partir de la marca de tiempo real
   * (`Date.now()`), de modo que si el navegador ralentiza el
   * temporizador (pestaña en segundo plano) el reloj sigue siendo
   * exacto, termina la partida al agotarse y se pone al día al
   * volver a la pestaña.
   * -------------------------------------------------------- */

  function detenerTemporizador() {
    if (intervalo !== null) {
      clearInterval(intervalo);
      intervalo = null;
    }
    marcaFin = null;
  }

  /**
   * Recalcula el tiempo restante a partir de la marca de tiempo real
   * y finaliza la partida si el plazo se agotó.
   */
  function actualizarTiempo() {
    if (estado.terminado || !estado.tiempoLimite || marcaFin === null) {
      detenerTemporizador();
      return;
    }

    const restante = Math.max(0, Math.ceil((marcaFin - Date.now()) / 1000));

    if (restante !== estado.tiempoRestante) {
      estado.tiempoRestante = restante;
      estado.tiempoTranscurrido = estado.tiempoLimite - restante;
      if (typeof alCambiarTiempo === 'function') alCambiarTiempo(restante);
    }

    if (restante <= 0) {
      estado.tiempoRestante = 0;
      estado.terminado = true;
      estado.gano = false;
      detenerTemporizador();
      if (typeof alAgotarTiempo === 'function') alAgotarTiempo();
    }
  }

  /**
   * Fuerza una sincronización del reloj (se usa al redibujar el HUD y
   * al recibir una letra, garantizando un cronómetro honesto aunque
   * el navegador haya ralentizado los intervalos).
   */
  function sincronizarTiempo() {
    if (!estado.tiempoLimite || marcaFin === null) return;
    actualizarTiempo();
  }

  /**
   * Inicia la cuenta regresiva si el nivel tiene tiempo límite.
   * Al llegar a 0 se finaliza la partida en derrota.
   */
  function iniciarTemporizador() {
    detenerTemporizador();
    if (!estado.tiempoLimite) return;

    estado.tiempoRestante = estado.tiempoLimite;
    estado.tiempoTranscurrido = 0;
    marcaFin = Date.now() + estado.tiempoLimite * 1000;
    intervalo = setInterval(actualizarTiempo, 250);
  }

  /**
   * Registra los callbacks del cronómetro.
   * @param {Function|null} alTerminar se ejecuta al agotarse el tiempo
   * @param {Function|null} [alTranscurrir] se ejecuta por cada segundo
   */
  function configurarTemporizador(alTerminar, alTranscurrir) {
    alAgotarTiempo = typeof alTerminar === 'function' ? alTerminar : null;
    alCambiarTiempo = typeof alTranscurrir === 'function' ? alTranscurrir : null;
  }

  // Al regresar a la pestaña el reloj se pone al día de inmediato
  // (en Node no existe `document`, por eso se protege el registro).
  if (global.document && typeof global.document.addEventListener === 'function') {
    global.document.addEventListener('visibilitychange', function () {
      if (global.document.visibilityState === 'visible') actualizarTiempo();
    });
  }

  /* ----------------------------------------------------------
   * Turno del jugador
   * -------------------------------------------------------- */

  /**
   * Valida la letra elegida (teclado físico o virtual):
   *  - repetida         → no hace nada (CP-04)
   *  - acierto          → revela todas sus posiciones y suma +10 c/u (CP-02)
   *  - error            → dibuja una parte y resta -5 (CP-03)
   * Finaliza con verificarEstado().
   * @param {string} letra
   * @returns {object} { accion, letra, ocurrencias, puntaje, errores, estadoJuego }
   */
  function procesarLetra(letra) {
    const limpia = normalizar(letra);

    if (estado.terminado) {
      return resultadoAccion('terminada', limpia, 0);
    }
    if (limpia.length !== 1) {
      return resultadoAccion('invalida', limpia, 0);
    }
    if (!letraDisponible(limpia)) {
      return resultadoAccion('repetida', limpia, 0);
    }

    // Se comparan las posiciones de la palabra usando la forma normalizada,
    // de modo que «O» coincide con la «Ó» de QUIBDÓ y con la «O» de BOGOTÁ.
    const posiciones = [];
    const letras = estado.palabra.toUpperCase().split('');
    letras.forEach((caracter, indice) => {
      if (caracter === ' ') return;
      if (normalizar(caracter) === limpia) posiciones.push(indice);
    });

    if (posiciones.length > 0) {
      estado.letrasAcertadas.push(limpia);
      estado.puntaje += PUNTOS_ACIERTO * posiciones.length;
    } else {
      estado.letrasFalladas.push(limpia);
      estado.errores += 1;
      estado.puntaje += PUNTOS_ERROR;
    }

    const estadoJuego = verificarEstado();
    return resultadoAccion(
      posiciones.length > 0 ? 'acierto' : 'error',
      limpia,
      posiciones.length,
      posiciones,
      estadoJuego
    );
  }

  /**
   * Construye la respuesta estándar de procesarLetra.
   * @private
   */
  function resultadoAccion(accion, letra, ocurrencias, posiciones, estadoJuego) {
    return {
      accion,
      letra,
      ocurrencias: ocurrencias || 0,
      posiciones: posiciones || [],
      puntaje: estado.puntaje,
      errores: estado.errores,
      vidasRestantes: estado.maxErrores - estado.errores,
      pistasDisponibles: estado.pistasDisponibles,
      estadoJuego: estadoJuego || (estado.terminado ? (estado.gano ? 'victoria' : 'derrota') : 'continua')
    };
  }

  /**
   * Determina si la partida terminó en victoria, derrota o continúa.
   * Victoria: todas las letras (sin espacios) descubiertas → +50 + vidas x 10.
   * Derrota : 6 errores (CP-07) o tiempo agotado (CP-09).
   * @returns {string} 'victoria' | 'derrota' | 'continua'
   */
  function verificarEstado() {
    if (estado.terminado) return estado.gano ? 'victoria' : 'derrota';

    const requeridas = letrasRequeridas(estado.palabra);
    const completas = requeridas.every((letra) => estado.letrasAcertadas.includes(letra));

    if (completas) {
      estado.terminado = true;
      estado.gano = true;
      const vidasRestantes = estado.maxErrores - estado.errores;
      estado.puntaje += PUNTOS_VICTORIA + vidasRestantes * PUNTOS_VIDA;
      detenerTemporizador();
      return 'victoria';
    }

    if (estado.errores >= estado.maxErrores) {
      estado.terminado = true;
      estado.gano = false;
      detenerTemporizador();
      return 'derrota';
    }

    if (estado.tiempoLimite && estado.tiempoRestante !== null && estado.tiempoRestante <= 0) {
      estado.terminado = true;
      estado.gano = false;
      detenerTemporizador();
      return 'derrota';
    }

    return 'continua';
  }

  /* ----------------------------------------------------------
   * Sistema de pistas (HU-05)
   * -------------------------------------------------------- */

  /**
   * Usa una pista disponible (-15 pts, CP-08).
   *  1.ª pista: revela el departamento de la capital.
   *  2.ª pista: revela una letra que todavía esté oculta.
   * @returns {object} { accion, tipo, texto, letra, puntaje, pistasDisponibles }
   */
  function usarPista() {
    if (estado.terminado) {
      return pistaRespuesta('terminada', null, 'La partida ya finalizó.');
    }
    if (estado.pistasDisponibles <= 0) {
      return pistaRespuesta('agotada', null, 'No te quedan pistas disponibles.');
    }

    estado.pistasDisponibles -= 1;
    estado.puntaje += PUNTOS_PISTA;

    if (!estado.pistaDepartamentoVisible) {
      estado.pistaDepartamentoVisible = true;
      return pistaRespuesta(
        'departamento',
        'departamento',
        'Pista: la capital pertenece al departamento de ' + estado.departamento + '.'
      );
    }

    // 2.ª pista: se revela al azar una letra que aún esté oculta.
    const ocultas = letrasRequeridas(estado.palabra)
      .filter((letra) => !estado.letrasAcertadas.includes(letra));

    if (ocultas.length === 0) {
      return pistaRespuesta('sinletras', null, 'No quedan letras ocultas por revelar.');
    }

    const letraRevelada = ocultas[Math.floor(Math.random() * ocultas.length)];
    estado.letrasAcertadas.push(letraRevelada);

    const estadoJuego = verificarEstado();
    return pistaRespuesta(
      'letra',
      'letra',
      'Pista: se reveló la letra ' + letraRevelada + '.',
      letraRevelada,
      estadoJuego
    );
  }

  /**
   * @private
   */
  function pistaRespuesta(accion, tipo, texto, letra, estadoJuego) {
    return {
      accion,
      tipo,
      texto,
      letra: letra || null,
      puntaje: estado.puntaje,
      pistasDisponibles: estado.pistasDisponibles,
      estadoJuego: estadoJuego || (estado.terminado ? (estado.gano ? 'victoria' : 'derrota') : 'continua')
    };
  }

  /* ----------------------------------------------------------
   * Resumen de la partida (modal + localStorage)
   * -------------------------------------------------------- */

  /**
   * Devuelve los datos normalizados de la partida finalizada.
   * @returns {object}
   */
  function resumenPartida() {
    const multiplicador = global.Palabras.NIVELES[estado.nivel].multiplicador;
    const puntajeFinal = estado.puntaje * multiplicador;
    const tiempoUsado = estado.tiempoLimite
      ? estado.tiempoLimite - (estado.tiempoRestante || 0)
      : Math.round((Date.now() - (estado.inicio || Date.now())) / 1000);

    return {
      jugador: estado.jugador,
      capital: estado.palabra,
      departamento: estado.departamento,
      region: estado.regionNombre,
      regionId: estado.region,
      nivel: global.Palabras.NIVELES[estado.nivel].nombre,
      nivelId: estado.nivel,
      gano: estado.gano,
      motivo: !estado.gano && estado.tiempoRestante === 0 ? 'tiempo' : (estado.gano ? 'victoria' : 'errores'),
      puntajeBase: estado.puntaje,
      multiplicador,
      puntaje: puntajeFinal,
      errores: estado.errores,
      vidasRestantes: estado.maxErrores - estado.errores,
      pistasUsadas: global.Palabras.NIVELES[estado.nivel].pistasIniciales - estado.pistasDisponibles,
      tiempo: tiempoUsado
    };
  }

  /* ----------------------------------------------------------
   * Reinicio / apoyo
   * -------------------------------------------------------- */

  /**
   * Detiene temporizadores al salir de la partida.
   */
  function finalizar() {
    detenerTemporizador();
    estado.terminado = true;
  }

  /**
   * Cuenta de letras descubiertas vs. requeridas (para indicadores).
   * @returns {object} { descubiertas, requeridas }
   */
  function progreso() {
    const requeridas = letrasRequeridas(estado.palabra);
    const descubiertas = requeridas.filter((l) => estado.letrasAcertadas.includes(l)).length;
    return { descubiertas, requeridas: requeridas.length };
  }

  /* ----------------------------------------------------------
   * Espacio de nombres público
   * -------------------------------------------------------- */
  global.Juego = {
    estado,
    PUNTOS_ACIERTO,
    PUNTOS_ERROR,
    PUNTOS_PISTA,
    PUNTOS_VICTORIA,
    PUNTOS_VIDA,
    MAX_ERRORES,
    iniciarPartida,
    normalizar,
    letrasRequeridas,
    letraDisponible,
    bloqueada,
    procesarLetra,
    verificarEstado,
    usarPista,
    iniciarTemporizador,
    detenerTemporizador,
    sincronizarTiempo,
    configurarTemporizador,
    resumenPartida,
    finalizar,
    progreso
  };
})(window);
