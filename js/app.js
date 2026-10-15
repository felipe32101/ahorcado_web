/**
 * app.js
 * ---------------------------------------------------------------
 * Punto de entrada de la aplicación. Conecta los módulos:
 *  - Palabras         : banco de datos y filtros
 *  - Juego            : reglas y estado de la partida
 *  - UI               : render del DOM, SVG, modal y sonido
 *  - Almacenamiento   : estadísticas y preferencias en localStorage
 *
 * Responsabilidades:
 *  1. Restaurar preferencias (nombre, región, nivel, tema, sonido).
 *  2. Escuchar los eventos del formulario, teclado virtual y físico.
 *  3. Orquestar el flujo completo: configurar → jugar → resultado.
 */
(function (global) {
  'use strict';

  const doc = document;

  /* ==========================================================
   * Utilidades locales
   * ========================================================== */

  /**
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  function porId(id) {
    return doc.getElementById(id);
  }

  /**
   * Lee el valor del radio seleccionado dentro de un grupo.
   * @param {string} nombre
   * @returns {string}
   */
  function radioSeleccionado(nombre) {
    const elegido = doc.querySelector('input[name="' + nombre + '"]:checked');
    return elegido ? elegido.value : '';
  }

  /**
   * Marca un radio concreto dentro de un grupo.
   * @param {string} nombre
   * @param {string} valor
   */
  function marcarRadio(nombre, valor) {
    const objetivo = doc.querySelector('input[name="' + nombre + '"][value="' + valor + '"]');
    if (objetivo) objetivo.checked = true;
  }

  /* ==========================================================
   * 1. Preferencias iniciales
   * ========================================================== */

  /**
   * Carga la configuración guardada y la aplica a la interfaz.
   * @returns {object} configuración vigente
   */
  function restaurarPreferencias() {
    const config = global.Almacenamiento.obtenerConfig();

    const input = porId('input-jugador');
    if (input) input.value = config.jugador || 'Jugador1';

    marcarRadio('region', config.region);
    marcarRadio('nivel', config.nivel);

    global.UI.aplicarTema(config.tema);
    global.UI.aplicarSonido(config.sonido);
    return config;
  }

  /**
   * Persiste las preferencias actuales del formulario.
   */
  function guardarPreferenciasDeFormulario() {
    const input = porId('input-jugador');
    global.Almacenamiento.guardarConfig({
      jugador: input && input.value.trim() ? input.value.trim() : 'Jugador1',
      region: radioSeleccionado('region') || 'todas',
      nivel: radioSeleccionado('nivel') || 'medio'
    });
  }

  /**
   * Actualiza el número de capitales que muestra cada chip de región,
   * tomando el dato directamente del banco (evita desfases de datos).
   */
  function actualizarConteosRegiones() {
    global.Palabras.REGIONES.forEach((region) => {
      const chip = doc.querySelector('.chip[data-region="' + region.id + '"]');
      if (!chip) return;
      const total = global.Palabras.filtrarCapitales(region.id).length;
      const insignia = chip.querySelector('.chip__info');
      const control = chip.querySelector('input');
      if (insignia) insignia.textContent = String(total);
      if (control) {
        control.setAttribute(
          'aria-label',
          region.nombre + ', ' + total + (total === 1 ? ' capital' : ' capitales')
        );
      }
    });
  }

  /**
   * Actualiza el texto que indica cuántas capitales cumple el filtro
   * región + nivel elegido (ayuda inmediata al usuario, RNF-01).
   */
  function actualizarResumenFiltro() {
    const caja = porId('resumen-filtro');
    if (!caja) return;

    const region = radioSeleccionado('region') || 'todas';
    const nivel = radioSeleccionado('nivel') || 'medio';
    const listaRegion = global.Palabras.filtrarCapitales(region);
    const exactas = global.Palabras.filtrarPorNivel(listaRegion, nivel);
    const datosRegion = global.Palabras.REGIONES.find((r) => r.id === region);
    const nombreRegion = region === 'todas'
      ? 'todas las regiones'
      : 'región ' + (datosRegion ? datosRegion.nombre : region);
    const nombreNivel = global.Palabras.NIVELES[nivel].nombre;

    if (exactas.length > 0) {
      caja.textContent = exactas.length === 1
        ? '1 capital disponible con este filtro (' + nombreRegion + ', nivel ' + nombreNivel + ').'
        : exactas.length + ' capitales disponibles con este filtro (' + nombreRegion + ', nivel ' + nombreNivel + ').';
    } else {
      caja.textContent = 'En ' + nombreRegion + ' no hay capitales de nivel ' + nombreNivel +
        ': se usará cualquier capital de la región.';
    }
  }

  /* ==========================================================
   * 2. Flujo de la partida
   * ========================================================== */

  /**
   * Inicia una partida con los datos del formulario o con los
   * parámetros recibidos (reintento).
   * @param {object} [parametros] { region, nivel, jugador }
   */
  function iniciarJuego(parametros) {
    const opciones = parametros || {};
    const input = porId('input-jugador');
    const jugador = opciones.jugador ||
      (input && input.value.trim() ? input.value.trim() : 'Jugador1');
    const region = opciones.region || radioSeleccionado('region') || 'todas';
    const nivel = opciones.nivel || radioSeleccionado('nivel') || 'medio';

    if (input) input.value = jugador;
    marcarRadio('region', region);
    marcarRadio('nivel', nivel);
    global.Almacenamiento.guardarConfig({ jugador, region, nivel });

    global.Juego.iniciarPartida(region, nivel, jugador);

    global.UI.ocultarResultado();
    global.UI.ocultarPista();
    global.UI.mostrarVista('vista-juego');
    global.UI.refrescar();
    global.UI.mostrarTurno('Elige una letra para comenzar.', 'neutro');

    const estado = global.Juego.estado;
    global.UI.anunciar(
      'Nueva partida. Nivel ' + global.Palabras.NIVELES[nivel].nombre +
      ', región ' + region + '. Palabra de ' +
      global.Juego.letrasRequeridas(estado.palabra).length + ' letras.'
    );
  }

  /**
   * Procesa una letra elegida por teclado virtual o físico.
   * @param {string} letra
   */
  function manejarLetra(letra) {
    if (global.UI.modalAbierto()) return;
    // Si el cronómetro ya venció (incluso sin haberse refrescado el HUD),
    // la partida queda bloqueada y se muestra el resultado.
    if (global.Juego.sincronizarTiempo) global.Juego.sincronizarTiempo();
    if (global.Juego.bloqueada()) return;

    const resultado = global.Juego.procesarLetra(letra);

    // CP-04: una letra ya usada no realiza ninguna acción visible.
    if (resultado.accion === 'repetida') {
      global.UI.anunciar('La letra ' + resultado.letra + ' ya fue utilizada.');
      return;
    }
    if (resultado.accion === 'invalida' || resultado.accion === 'terminada') return;

    if (resultado.accion === 'acierto') {
      const veces = resultado.ocurrencias;
      global.UI.reproducir('acierto');
      global.UI.mostrarTurno(
        '¡Correcto! La letra ' + resultado.letra + ' aparece ' + veces +
        (veces === 1 ? ' vez.' : ' veces.'),
        'acierto'
      );
      global.UI.anunciar('Acierto. La letra ' + resultado.letra + ' se reveló.');
    } else {
      global.UI.reproducir('error');
      global.UI.mostrarTurno(
        'La letra ' + resultado.letra + ' no está en la palabra. ' +
        'Errores: ' + resultado.errores + ' de ' + global.Juego.MAX_ERRORES + '.',
        'error'
      );
      global.UI.anunciar('Error. La letra ' + resultado.letra + ' no existe. ' +
        'Quedan ' + resultado.vidasRestantes + ' vidas.');
    }

    global.UI.refrescar();

    if (resultado.estadoJuego === 'victoria') finalizarPartida(true);
    if (resultado.estadoJuego === 'derrota') finalizarPartida(false);
  }

  /**
   * Usa una pista disponible (HU-05, CP-08).
   */
  function manejarPista() {
    if (global.UI.modalAbierto()) return;
    if (global.Juego.sincronizarTiempo) global.Juego.sincronizarTiempo();
    if (global.Juego.bloqueada()) return;

    const resultado = global.Juego.usarPista();

    if (resultado.accion === 'agotada' || resultado.accion === 'terminada') {
      global.UI.mostrarTurno(resultado.texto, 'neutro');
      global.UI.anunciar(resultado.texto);
      global.UI.renderHUD();
      return;
    }

    if (resultado.accion === 'sinletras') {
      global.UI.mostrarTurno(resultado.texto, 'neutro');
      global.UI.anunciar(resultado.texto);
      return;
    }

    global.UI.reproducir('tecla');
    global.UI.mostrarPista(resultado.texto);
    global.UI.anunciar(resultado.texto + ' Puntaje actual: ' + resultado.puntaje + ' puntos.');
    global.UI.refrescar();

    if (resultado.estadoJuego === 'victoria') finalizarPartida(true);
  }

  /**
   * Finaliza la partida: guarda estadísticas y abre el modal.
   * @param {boolean} gano
   * @param {object} [motivo] motivo adicional ('tiempo')
   */
  function finalizarPartida(gano, motivo) {
    const resumen = global.Juego.resumenPartida();
    if (motivo) resumen.motivo = motivo;

    // CP-06 / CP-07 / CP-11: el resultado siempre queda en localStorage.
    global.Almacenamiento.guardarEstadisticas(resumen);
    global.UI.refrescar();

    setTimeout(function () {
      global.UI.mostrarResultado(gano, resumen);
    }, 400);
  }

  /**
   * Se acabó el cronómetro de 90 s en nivel difícil (CP-09).
   */
  function alAgotarTiempo() {
    if (global.UI.modalAbierto()) return;
    global.UI.mostrarTurno('¡Se agotó el tiempo!', 'error');
    global.UI.refrescar();
    finalizarPartida(false, 'tiempo');
  }

  /**
   * Abandona la partida actual y vuelve al menú principal.
   */
  function volverAlMenu() {
    global.Juego.finalizar();
    global.UI.ocultarResultado();
    global.UI.mostrarVista('vista-menu');
    actualizarResumenFiltro();
    const input = porId('input-jugador');
    if (input) input.focus();
  }

  /* ==========================================================
   * 3. Tema y sonido
   * ========================================================== */

  function alternarTema() {
    const actual = doc.documentElement.getAttribute('data-tema');
    const siguiente = actual === 'oscuro' ? 'claro' : 'oscuro';
    global.UI.aplicarTema(siguiente);
    global.Almacenamiento.guardarConfig({ tema: siguiente });
    global.UI.reproducir('tecla');
  }

  function alternarSonido() {
    const config = global.Almacenamiento.obtenerConfig();
    const siguiente = !config.sonido;
    global.UI.aplicarSonido(siguiente);
    global.Almacenamiento.guardarConfig({ sonido: siguiente });
    if (siguiente) global.UI.reproducir('tecla');
  }

  /* ==========================================================
   * 4. Registro de eventos
   * ========================================================== */

  function registrarEventos() {
    // --- Formulario de configuración ---
    const formulario = porId('form-config');
    if (formulario) {
      formulario.addEventListener('submit', function (evento) {
        evento.preventDefault();
        iniciarJuego();
      });
    }

    // Cambios de región o nivel → resumen del filtro y mapa
    doc.querySelectorAll('input[name="region"], input[name="nivel"]').forEach((radio) => {
      radio.addEventListener('change', function () {
        guardarPreferenciasDeFormulario();
        actualizarResumenFiltro();
        if (radio.name === 'region') {
          global.UI.renderMapa(radioSeleccionado('region') || 'todas');
        }
      });
    });

    // --- Teclado virtual (HU-03, CP-04) ---
    const teclado = porId('teclado');
    if (teclado) {
      teclado.addEventListener('click', function (evento) {
        const boton = evento.target.closest('.tecla');
        if (!boton || boton.disabled) return;
        manejarLetra(boton.getAttribute('data-letra'));
      });
    }

    // --- Teclado físico (HU-03, CP-05) ---
    doc.addEventListener('keydown', function (evento) {
      if (global.UI.modalAbierto()) return;

      const destino = evento.target;
      const escribiendo = destino &&
        (destino.tagName === 'INPUT' || destino.tagName === 'TEXTAREA' || destino.isContentEditable);

      // Dentro del formulario se permite escribir el nombre sin disparar el juego.
      if (escribiendo) {
        if (evento.key === 'Enter' && destino.id === 'input-jugador') {
          evento.preventDefault();
          iniciarJuego();
        }
        return;
      }

      if (global.Juego.estado.terminado && global.Juego.estado.inicio === null) return;

      const esLetra = evento.key && evento.key.length === 1 && /[a-záéíóúñü]/i.test(evento.key);
      if (!esLetra) return;

      // La vista de menú no debe capturar letras.
      if (porId('vista-juego') && porId('vista-juego').hidden) return;

      evento.preventDefault();
      manejarLetra(evento.key);
    });

    // --- Acciones de la partida ---
    const btnPista = porId('btn-pista');
    if (btnPista) btnPista.addEventListener('click', manejarPista);

    const btnNueva = porId('btn-nueva');
    if (btnNueva) {
      btnNueva.addEventListener('click', function () {
        iniciarJuego();
      });
    }

    const btnMenu = porId('btn-menu');
    if (btnMenu) {
      btnMenu.addEventListener('click', function (evento) {
        evento.preventDefault();
        volverAlMenu();
      });
    }

    // --- Modal de resultado ---
    const btnReintentar = porId('btn-reintentar');
    if (btnReintentar) {
      btnReintentar.addEventListener('click', function () {
        global.UI.ocultarResultado();
        iniciarJuego();
      });
    }

    const btnIrMenu = porId('btn-ir-menu');
    if (btnIrMenu) {
      btnIrMenu.addEventListener('click', volverAlMenu);
    }

    const modal = porId('modal-resultado');
    if (modal) {
      modal.addEventListener('click', function (evento) {
        if (evento.target.hasAttribute('data-cerrar-modal')) {
          global.UI.ocultarResultado();
        }
      });
    }

    // --- Preferencias de cabecera ---
    const btnTema = porId('btn-tema');
    if (btnTema) btnTema.addEventListener('click', alternarTema);

    const btnSonido = porId('btn-sonido');
    if (btnSonido) btnSonido.addEventListener('click', alternarSonido);
  }

  /* ==========================================================
   * 5. Arranque
   * ========================================================== */

  function iniciar() {
    restaurarPreferencias();
    global.UI.inicializar();
    global.Juego.configurarTemporizador(alAgotarTiempo, function () {
      // Cada segundo transcurrido se refleja en el cronómetro del HUD.
      global.UI.renderHUD();
    });
    actualizarConteosRegiones();
    actualizarResumenFiltro();
    global.UI.renderMapa(radioSeleccionado('region') || 'todas');
    registrarEventos();
    global.UI.refrescar();
    global.UI.anunciar('Juego del ahorcado de las capitales de Colombia listo.');
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  // Espacio de nombres para pruebas manuales en la consola (CP-01..CP-14).
  global.AppAhorcado = {
    iniciarJuego,
    manejarLetra,
    manejarPista,
    finalizarPartida,
    volverAlMenu,
    actualizarResumenFiltro
  };
})(window);
