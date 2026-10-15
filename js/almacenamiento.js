/**
 * almacenamiento.js
 * ---------------------------------------------------------------
 * Capa de persistencia local del juego (sin servidor ni base de datos
 * externa). Todo se guarda en `localStorage` con claves versionadas.
 *
 * Expone el espacio de nombres global `Almacenamiento` con:
 *  - guardarEstadisticas(resultado) : registra una partida (CP-06, CP-07, CP-11)
 *  - obtenerEstadisticas()          : totales, porcentaje y rachas
 *  - obtenerRanking(cantidad)       : Top 5 de puntajes
 *  - limpiarEstadisticas()          : reinicia el historial
 *  - obtenerConfig() / guardarConfig() : preferencias (nombre, tema, sonido)
 *
 * Todas las operaciones son defensivas: si el navegador bloquea el
 * almacenamiento (modo privado, file:// restringido), el juego sigue
 * funcionando en memoria sin lanzar errores.
 */
(function (global) {
  'use strict';

  const CLAVE_ESTADISTICAS = 'ahorcado.estadisticas.v1';
  const CLAVE_CONFIG = 'ahorcado.config.v1';
  const LIMITE_HISTORIAL = 100;

  const ESTRUCTURA_VACIA = {
    total: 0,
    ganadas: 0,
    perdidas: 0,
    rachaActual: 0,
    mejorRacha: 0,
    puntajeAcumulado: 0,
    historial: []
  };

  /* ----------------------------------------------------------
   * Lectura / escritura segura
   * -------------------------------------------------------- */

  function leer(clave, defecto) {
    try {
      const crudo = global.localStorage.getItem(clave);
      if (!crudo) return defecto;
      return JSON.parse(crudo);
    } catch (error) {
      console.warn('[Almacenamiento] No se pudo leer "' + clave + '":', error);
      return defecto;
    }
  }

  function escribir(clave, valor) {
    try {
      global.localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (error) {
      console.warn('[Almacenamiento] No se pudo guardar "' + clave + '":', error);
      return false;
    }
  }

  /* ----------------------------------------------------------
   * Estadísticas
   * -------------------------------------------------------- */

  /**
   * Devuelve las estadísticas normalizadas (siempre con la forma completa).
   * @returns {object}
   */
  function obtenerEstadisticas() {
    const guardadas = leer(CLAVE_ESTADISTICAS, null);
    const datos = Object.assign({}, ESTRUCTURA_VACIA, guardadas || {});
    // Se copia el arreglo para no mutar la plantilla ESTRUCTURA_VACIA.
    datos.historial = Array.isArray(guardadas && guardadas.historial)
      ? guardadas.historial.slice()
      : [];

    datos.total = datos.ganadas + datos.perdidas;
    datos.porcentajeVictorias = datos.total > 0
      ? Math.round((datos.ganadas / datos.total) * 100)
      : 0;
    return datos;
  }

  /**
   * Registra el resultado de una partida (victoria o derrota) y actualiza
   * la racha y el ranking local. Se invoca desde el modal de resultado.
   * @param {object} resultado { jugador, capital, departamento, region, nivel,
   *                             gano, puntaje, tiempo, fecha }
   * @returns {object} estadísticas actualizadas
   */
  function guardarEstadisticas(resultado) {
    const datos = obtenerEstadisticas();
    const registro = {
      jugador: (resultado.jugador || 'Jugador1').toString().slice(0, 24),
      capital: resultado.capital || '',
      departamento: resultado.departamento || '',
      region: resultado.region || '',
      nivel: resultado.nivel || '',
      gano: Boolean(resultado.gano),
      puntaje: Number(resultado.puntaje) || 0,
      tiempo: Number(resultado.tiempo) || 0,
      fecha: resultado.fecha || new Date().toISOString()
    };

    if (registro.gano) {
      datos.ganadas += 1;
      datos.rachaActual += 1;
      datos.mejorRacha = Math.max(datos.mejorRacha, datos.rachaActual);
    } else {
      datos.perdidas += 1;
      datos.rachaActual = 0;
    }

    datos.puntajeAcumulado += registro.puntaje;
    datos.historial.unshift(registro);
    if (datos.historial.length > LIMITE_HISTORIAL) {
      datos.historial.length = LIMITE_HISTORIAL;
    }

    datos.total = datos.ganadas + datos.perdidas;
    datos.porcentajeVictorias = datos.total > 0
      ? Math.round((datos.ganadas / datos.total) * 100)
      : 0;

    escribir(CLAVE_ESTADISTICAS, datos);
    return datos;
  }

  /**
   * Devuelve el ranking de mejores puntajes ordenado de mayor a menor.
   * @param {number} cantidad cuántos registros devolver (5 por defecto)
   * @returns {Array<object>}
   */
  function obtenerRanking(cantidad) {
    const limite = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 5;
    const datos = obtenerEstadisticas();
    return datos.historial
      .slice()
      .sort((a, b) => {
        if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
        return new Date(b.fecha) - new Date(a.fecha);
      })
      .slice(0, limite);
  }

  /**
   * Borra todas las estadísticas guardadas (botón "Reiniciar historial").
   * @returns {object} estadísticas vacías
   */
  function limpiarEstadisticas() {
    const vacio = JSON.parse(JSON.stringify(ESTRUCTURA_VACIA));
    escribir(CLAVE_ESTADISTICAS, vacio);
    return Object.assign({}, vacio, { porcentajeVictorias: 0 });
  }

  /**
   * Devuelve las últimas N partidas jugadas (la más reciente primero).
   * @param {number} cantidad
   * @returns {Array<object>}
   */
  function obtenerHistorial(cantidad) {
    const limite = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 10;
    return obtenerEstadisticas().historial.slice(0, limite);
  }

  /* ----------------------------------------------------------
   * Configuración / preferencias del jugador
   * -------------------------------------------------------- */

  const CONFIG_POR_DEFECTO = {
    jugador: 'Jugador1',
    region: 'todas',
    nivel: 'medio',
    tema: 'claro',
    sonido: true
  };

  /**
   * Lee la configuración del jugador (nombre, región, nivel, tema, sonido).
   * @returns {object}
   */
  function obtenerConfig() {
    return Object.assign({}, CONFIG_POR_DEFECTO, leer(CLAVE_CONFIG, {}));
  }

  /**
   * Mezcla la configuración parcial con la guardada y la persiste.
   * @param {object} cambios
   * @returns {object} configuración resultante
   */
  function guardarConfig(cambios) {
    const actual = obtenerConfig();
    const nueva = Object.assign({}, actual, cambios || {});
    escribir(CLAVE_CONFIG, nueva);
    return nueva;
  }

  /**
   * Prueba rápida de disponibilidad de localStorage (RNF-04).
   * @returns {boolean}
   */
  function disponible() {
    try {
      const prueba = '__ahorcado_prueba__';
      global.localStorage.setItem(prueba, '1');
      global.localStorage.removeItem(prueba);
      return true;
    } catch (error) {
      return false;
    }
  }

  /* ----------------------------------------------------------
   * Espacio de nombres público
   * -------------------------------------------------------- */
  global.Almacenamiento = {
    CLAVE_ESTADISTICAS,
    CLAVE_CONFIG,
    disponible,
    obtenerEstadisticas,
    guardarEstadisticas,
    obtenerRanking,
    obtenerHistorial,
    limpiarEstadisticas,
    obtenerConfig,
    guardarConfig
  };
})(window);
