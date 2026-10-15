/**
 * ui.js
 * ---------------------------------------------------------------
 * Capa de presentación: renderizado del DOM, eventos visuales,
 * ilustración progresiva del ahorcado en SVG, modal de resultado,
 * teclado virtual y efectos de sonido.
 *
 * Expone el espacio de nombres global `UI` y no contiene reglas de
 * negocio: únicamente lee `Juego.estado` y pinta la interfaz.
 */
(function (global) {
  'use strict';

  const LETRAS_TECLADO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

  // Referencias frecuentes del DOM
  const referencias = {};
  let tecladoConstruido = false;
  let focoAnteriorModal = null;

  /* ==========================================================
   * 0. Utilidades de acceso al DOM
   * ========================================================== */

  /**
   * @param {string} id id del elemento
   * @returns {HTMLElement}
   */
  function $(id) {
    if (!referencias[id]) referencias[id] = document.getElementById(id);
    return referencias[id];
  }

  /**
   * Crea un elemento con atributos y texto.
   * @param {string} etiqueta
   * @param {object} opciones { clase, texto, atributos }
   * @returns {HTMLElement}
   */
  function crear(etiqueta, opciones) {
    const opcionesSeguras = opciones || {};
    const elemento = document.createElement(etiqueta);
    if (opcionesSeguras.clase) elemento.className = opcionesSeguras.clase;
    if (opcionesSeguras.texto !== undefined) elemento.textContent = opcionesSeguras.texto;
    if (opcionesSeguras.atributos) {
      Object.keys(opcionesSeguras.atributos).forEach((clave) => {
        elemento.setAttribute(clave, opcionesSeguras.atributos[clave]);
      });
    }
    return elemento;
  }

  /**
   * Publica un mensaje en la región viva para lectores de pantalla.
   * @param {string} texto
   */
  function anunciar(texto) {
    const zona = $('anuncio');
    if (zona) zona.textContent = texto;
  }

  /* ==========================================================
   * 1. Vistas (menú / juego)
   * ========================================================== */

  /**
   * Muestra una vista y oculta las demás.
   * @param {string} idVista 'vista-menu' | 'vista-juego'
   */
  function mostrarVista(idVista) {
    ['vista-menu', 'vista-juego'].forEach((id) => {
      const vista = $(id);
      if (vista) vista.hidden = id !== idVista;
    });
    const vista = $(idVista);
    if (vista) {
      vista.classList.add('vista--entrada');
      setTimeout(() => vista.classList.remove('vista--entrada'), 350);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* ==========================================================
   * 2. Palabra oculta
   * ========================================================== */

  /**
   * Dibuja la capital: cada letra oculta como guion, cada letra
   * descubierta con su carácter original (con tilde si lo tiene).
   * Los espacios de las capitales compuestas se muestran desde el
   * inicio y nunca se adivinan (CP-01, CP-13).
   */
  function renderPalabra() {
    const contenedor = $('palabra');
    if (!contenedor) return;
    const estado = global.Juego.estado;

    contenedor.innerHTML = '';
    const caracteres = estado.palabra.toUpperCase().split('');
    const posiciones = global.Juego.letrasRequeridas(estado.palabra).length;
    let espacios = 0;

    caracteres.forEach((caracter, indice) => {
      if (caracter === ' ') {
        espacios += 1;
        const espacio = crear('span', {
          clase: 'palabra__espacio',
          texto: '\u00A0',
          atributos: { 'aria-hidden': 'true' }
        });
        contenedor.appendChild(espacio);
        return;
      }

      const revelada = estado.letrasAcertadas.includes(global.Juego.normalizar(caracter));
      const celda = crear('span', {
        clase: 'palabra__letra ' + (revelada ? 'palabra__letra--visible' : 'palabra__letra--oculta'),
        texto: revelada ? caracter : '_',
        atributos: {
          'data-indice': String(indice),
          'aria-label': revelada ? caracter : 'letra oculta'
        }
      });
      contenedor.appendChild(celda);
    });

    contenedor.setAttribute(
      'aria-label',
      'Palabra oculta con ' + posiciones + ' letras' + (espacios ? ' y ' + espacios + ' espacios' : '')
    );

    const ficha = $('ficha-letras');
    if (ficha) {
      ficha.textContent = posiciones + ' letras' + (espacios ? ' · ' + espacios + ' espacio' + (espacios > 1 ? 's' : '') : '');
    }
  }

  /* ==========================================================
   * 3. Teclado virtual
   * ========================================================== */

  /**
   * Construye el teclado A-Z + Ñ una sola vez (HU-03 lo complementa
   * con el teclado físico, manejado en app.js).
   */
  function construirTeclado() {
    const contenedor = $('teclado');
    if (!contenedor || tecladoConstruido) return;

    contenedor.innerHTML = '';
    LETRAS_TECLADO.forEach((letra) => {
      const boton = crear('button', {
        clase: 'tecla',
        texto: letra,
        atributos: {
          type: 'button',
          'data-letra': letra,
          'aria-label': 'Letra ' + letra
        }
      });
      contenedor.appendChild(boton);
    });
    tecladoConstruido = true;
  }

  /**
   * Actualiza el estado visual del teclado virtual: letras aciertadas
   * en verde, falladas en rojo y todas las usadas deshabilitadas (CP-04, HU-04).
   */
  function renderTeclado() {
    construirTeclado();
    const estado = global.Juego.estado;
    const botones = document.querySelectorAll('#teclado .tecla');

    botones.forEach((boton) => {
      const letra = boton.getAttribute('data-letra');
      const clave = global.Juego.normalizar(letra);
      const usada = estado.letrasAcertadas.includes(clave) || estado.letrasFalladas.includes(clave);

      boton.disabled = usada || estado.terminado;
      boton.classList.toggle('tecla--acertada', estado.letrasAcertadas.includes(clave));
      boton.classList.toggle('tecla--fallada', estado.letrasFalladas.includes(clave));
      boton.setAttribute(
        'aria-label',
        'Letra ' + letra + (usada ? (estado.letrasAcertadas.includes(clave) ? ', acertada' : ', fallada') : ', disponible')
      );
    });
  }

  /* ==========================================================
   * 4. Dibujo progresivo del ahorcado (6 etapas en SVG)
   * ========================================================== */

  /**
   * Muestra progresivamente la parte del dibujo correspondiente al
   * número de errores cometidos. También actualiza la expresión del
   * personaje y los puntos de error.
   * @param {number} errores 0..6
   */
  function dibujarAhorcado(errores) {
    const total = Number.isFinite(errores) ? errores : 0;

    const pasos = document.querySelectorAll('#dibujo-ahorcado .ahorcado__paso');
    pasos.forEach((paso) => {
      const nivel = Number(paso.getAttribute('data-paso'));
      paso.classList.toggle('ahorcado__paso--visible', nivel <= total);
    });

    const svg = $('dibujo-ahorcado');
    if (svg) {
      svg.classList.toggle('ahorcado--derrota', total >= global.Juego.MAX_ERRORES);
      svg.setAttribute(
        'data-expresion',
        total <= 1 ? 'alegre' : total <= 3 ? 'neutral' : 'triste'
      );
    }

    const puntos = $('intentos-puntos');
    if (puntos) {
      puntos.querySelectorAll('.punto-error').forEach((punto, indice) => {
        punto.classList.toggle('punto-error--activo', indice < total);
      });
      const max = global.Juego.MAX_ERRORES;
      puntos.setAttribute('aria-label', total + ' de ' + max + ' errores cometidos');
    }
  }

  /* ==========================================================
   * 4.1 Mapa real de Colombia con marcadores de capitales
   * ========================================================== */

  /**
   * Dibuja sobre el mapa real los marcadores de las capitales que
   * pertenecen a la región seleccionada (o a todas si es «todas»).
   * @param {string} region clave de región o 'todas'
   */
  function renderMapa(region) {
    const contenedor = $('mapa-marcadores');
    if (!contenedor) return;

    const capitales = global.Palabras.filtrarCapitales(region);
    contenedor.innerHTML = '';
    contenedor.classList.toggle('mapa__marcadores--region', region !== 'todas');

    capitales.forEach((dato) => {
      const posicion = global.Palabras.proyectar(dato.lat, dato.lon);
      const datosRegion = global.Palabras.REGIONES.find((r) => r.nombre === dato.region);
      const punto = document.createElement('span');
      const color = datosRegion ? datosRegion.color : '#2E74B5';

      punto.className = 'mapa__punto';
      punto.style.left = posicion.x.toFixed(2) + '%';
      punto.style.top = posicion.y.toFixed(2) + '%';
      punto.style.setProperty('--color-region', color);
      punto.setAttribute('data-region', dato.region);
      punto.setAttribute('title', dato.capital + ' · ' + dato.departamento);
      contenedor.appendChild(punto);
    });

    const leyenda = $('mapa-leyenda');
    if (leyenda) {
      const total = capitales.length;
      const datos = global.Palabras.REGIONES.find((r) => r.id === region);
      leyenda.textContent =
        total === 32
          ? 'Mapa de Colombia · 32 capitales'
          : (datos ? datos.nombre : region) +
            ' · ' + total + (total === 1 ? ' capital marcada' : ' capitales marcadas');
    }
  }

  /* ==========================================================
   * 5. HUD y fichas de estado
   * ========================================================== */

  /**
   * Formatea segundos como mm:ss.
   * @param {number} segundos
   * @returns {string}
   */
  function formatearTiempo(segundos) {
    const total = Math.max(0, Math.floor(segundos || 0));
    const minutos = Math.floor(total / 60);
    const resto = total % 60;
    return String(minutos).padStart(2, '0') + ':' + String(resto).padStart(2, '0');
  }

  /**
   * Refresca vidas, puntaje, cronómetro, región, nivel y fichas.
   */
  function renderHUD() {
    // El reloj se recalcula contra el tiempo real en cada redibujado:
    // así el HUD nunca muestra segundos inventados (CP-09).
    if (global.Juego.sincronizarTiempo) global.Juego.sincronizarTiempo();

    const estado = global.Juego.estado;
    const configNivel = global.Palabras.NIVELES[estado.nivel];
    const vidas = estado.maxErrores - estado.errores;
    const progreso = global.Juego.progreso();

    const vidasTexto = vidas + ' / ' + estado.maxErrores;
    const vidasEl = $('hud-vidas');
    if (vidasEl) {
      vidasEl.textContent = vidasTexto;
      vidasEl.setAttribute('aria-label', vidas + ' vidas restantes de ' + estado.maxErrores);
      vidasEl.classList.toggle('hud__valor--peligro', vidas <= 2);
    }

    const puntajeEl = $('hud-puntaje');
    if (puntajeEl) puntajeEl.textContent = String(estado.puntaje);

    const tiempoEl = $('hud-tiempo');
    if (tiempoEl) {
      if (estado.tiempoLimite) {
        tiempoEl.textContent = formatearTiempo(estado.tiempoRestante);
        tiempoEl.classList.toggle('hud__valor--peligro', estado.tiempoRestante <= 15);
        tiempoEl.setAttribute('aria-label', 'Tiempo restante: ' + estado.tiempoRestante + ' segundos');
      } else {
        tiempoEl.textContent = '--:--';
        tiempoEl.classList.remove('hud__valor--peligro');
        tiempoEl.setAttribute('aria-label', 'Sin límite de tiempo');
      }
    }

    const regionEl = $('hud-region');
    if (regionEl) regionEl.textContent = estado.regionNombre || '—';

    const nivelEl = $('hud-nivel');
    if (nivelEl) nivelEl.textContent = configNivel.nombre + (configNivel.tiempoLimite ? ' · x' + configNivel.multiplicador : ' · x' + configNivel.multiplicador);

    const intentosNumero = $('intentos-numero');
    if (intentosNumero) intentosNumero.textContent = String(estado.errores);
    const intentosMax = $('intentos-max');
    if (intentosMax) intentosMax.textContent = String(estado.maxErrores);

    const fichaPistas = $('ficha-pistas');
    if (fichaPistas) fichaPistas.textContent = String(estado.pistasDisponibles);

    const fichaProgreso = $('ficha-progreso');
    if (fichaProgreso) fichaProgreso.textContent = progreso.descubiertas + ' / ' + progreso.requeridas;

    const botonPista = $('btn-pista');
    if (botonPista) {
      botonPista.disabled = estado.pistasDisponibles <= 0 || estado.terminado;
      botonPista.textContent = estado.pistasDisponibles > 0
        ? 'Usar pista (' + estado.pistasDisponibles + ' · -15 pts)'
        : 'Sin pistas';
    }
  }

  /* ==========================================================
   * 6. Pistas visibles
   * ========================================================== */

  /**
   * Muestra (o actualiza) el texto de la pista activa.
   * @param {string} texto
   */
  function mostrarPista(texto) {
    const caja = $('caja-pista');
    const cajaTexto = $('caja-pista-texto');
    if (!caja || !cajaTexto) return;
    cajaTexto.textContent = texto;
    caja.hidden = false;
    caja.classList.remove('caja-pista--destello');
    // Reinicia la animación de destello
    void caja.offsetWidth;
    caja.classList.add('caja-pista--destello');
  }

  /**
   * Oculta la caja de pista (al iniciar una partida nueva).
   */
  function ocultarPista() {
    const caja = $('caja-pista');
    if (caja) caja.hidden = true;
  }

  /* ==========================================================
   * 7. Mensajes de turno
   * ========================================================== */

  /**
   * Escribe bajo el dibujo el resultado del último intento.
   * @param {string} texto
   * @param {string} tipo 'acierto' | 'error' | 'neutro'
   */
  function mostrarTurno(texto, tipo) {
    const caja = $('estado-palabra');
    if (!caja) return;
    caja.textContent = texto;
    caja.classList.remove('estado-palabra--acierto', 'estado-palabra--error', 'estado-palabra--neutro');
    caja.classList.add('estado-palabra--' + (tipo || 'neutro'));
  }

  /* ==========================================================
   * 8. Render completo
   * ========================================================== */

  /**
   * Redibuja todo el tablero con el estado actual.
   * @param {object} opciones { dibujo: boolean }
   */
  function refrescar(opciones) {
    const opcionesSeguras = opciones || {};
    const estado = global.Juego.estado;
    renderPalabra();
    renderTeclado();
    renderHUD();
    if (opcionesSeguras.dibujo !== false) dibujarAhorcado(estado.errores);
  }

  /* ==========================================================
   * 9. Modal de resultado
   * ========================================================== */

  /**
   * Abre la ventana modal con el resultado final de la partida.
   * @param {boolean} gano
   * @param {object} resumen resultado de Juego.resumenPartida()
   */
  function mostrarResultado(gano, resumen) {
    const modal = $('modal-resultado');
    if (!modal) return;

    focoAnteriorModal = document.activeElement;

    const insignia = $('modal-insignia');
    const titulo = $('modal-titulo');
    const mensaje = $('modal-mensaje');

    if (insignia) insignia.textContent = gano ? '🏆' : '💀';
    if (titulo) titulo.textContent = gano ? '¡Victoria!' : 'Derrota';
    if (mensaje) {
      if (gano) {
        mensaje.textContent = 'Adivinaste la capital ' + resumen.capital + '. ¡Excelente conocimiento geográfico!';
      } else if (resumen.motivo === 'tiempo') {
        mensaje.textContent = 'Se agotó el tiempo de 90 segundos. La capital era ' + resumen.capital + '.';
      } else {
        mensaje.textContent = 'Se completaron los 6 errores. La capital era ' + resumen.capital + '.';
      }
    }

    setTexto('modal-palabra', resumen.capital);
    setTexto('modal-departamento', resumen.departamento);
    setTexto('modal-region', resumen.region);
    setTexto('modal-nivel', resumen.nivel);
    setTexto('modal-errores', resumen.errores + ' de 6');
    setTexto('modal-tiempo', formatearTiempo(resumen.tiempo));
    setTexto('modal-puntaje', String(resumen.puntaje));
    setTexto(
      'modal-detalle',
      'Subtotal ' + resumen.puntajeBase + ' pts × multiplicador x' + resumen.multiplicador +
      ' · pistas usadas: ' + resumen.pistasUsadas
    );

    const cabecera = $('modal-cabecera');
    if (cabecera) cabecera.classList.toggle('modal__cabecera--derrota', !gano);

    modal.hidden = false;
    document.body.classList.add('modal-abierto');

    const primerBoton = modal.querySelector('.modal__acciones .btn');
    if (primerBoton) primerBoton.focus();

    reproducir(gano ? 'victoria' : 'derrota');
    anunciar((gano ? 'Victoria. ' : 'Derrota. ') + 'La capital era ' + resumen.capital +
      ', departamento de ' + resumen.departamento + '. Puntaje final ' + resumen.puntaje + ' puntos.');
  }

  /**
   * Cierra el modal de resultado y devuelve el foco.
   */
  function ocultarResultado() {
    const modal = $('modal-resultado');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-abierto');
    if (focoAnteriorModal && typeof focoAnteriorModal.focus === 'function') {
      focoAnteriorModal.focus();
    }
  }

  /**
   * @private
   */
  function setTexto(id, texto) {
    const elemento = $(id);
    if (elemento) elemento.textContent = texto;
  }

  /**
   * Devuelve true si el modal está abierto.
   * @returns {boolean}
   */
  function modalAbierto() {
    const modal = $('modal-resultado');
    return Boolean(modal && !modal.hidden);
  }

  /* ==========================================================
   * 10. Tema claro / oscuro
   * ========================================================== */

  /**
   * Aplica el tema en <html data-tema> y actualiza el botón.
   * @param {string} tema 'claro' | 'oscuro'
   */
  function aplicarTema(tema) {
    const elegido = tema === 'oscuro' ? 'oscuro' : 'claro';
    document.documentElement.setAttribute('data-tema', elegido);
    setTexto('btn-tema-texto', 'Tema: ' + elegido);
    const boton = $('btn-tema');
    if (boton) {
      boton.setAttribute('aria-pressed', String(elegido === 'oscuro'));
      boton.title = elegido === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    }
  }

  /**
   * Activa o desactiva el sonido y actualiza el botón.
   * @param {boolean} activo
   */
  function aplicarSonido(activo) {
    sonidoActivo = Boolean(activo);
    setTexto('btn-sonido-texto', 'Sonido: ' + (sonidoActivo ? 'sí' : 'no'));
    const boton = $('btn-sonido');
    if (boton) boton.setAttribute('aria-pressed', String(sonidoActivo));
    const raiz = document.documentElement;
    raiz.classList.toggle('sin-sonido', !sonidoActivo);
  }

  /* ==========================================================
   * 11. Efectos de sonido
   * ----------------------------------------------------------
   * Se intentan reproducir los archivos de assets/sonidos/ y, si el
   * navegador no puede cargarlos, se sintetizan con la Web Audio API.
   * ========================================================== */

  let sonidoActivo = true;
  let audioContexto = null;
  const archivosSonido = {
    acierto: 'assets/sonidos/acierto.wav',
    error: 'assets/sonidos/error.wav',
    victoria: 'assets/sonidos/victoria.wav',
    derrota: 'assets/sonidos/derrota.wav',
    tecla: 'assets/sonidos/tecla.wav'
  };
  const pistasAudio = {};

  function prepararArchivosDeSonido() {
    if (typeof Audio === 'undefined') return;
    Object.keys(archivosSonido).forEach((nombre) => {
      const audio = new Audio(archivosSonido[nombre]);
      audio.preload = 'auto';
      audio.volume = 0.5;
      pistasAudio[nombre] = audio;
    });
  }

  /**
   * Reproduce un efecto de sonido por su nombre.
   * @param {string} nombre 'acierto' | 'error' | 'victoria' | 'derrota' | 'tecla'
   */
  function reproducir(nombre) {
    if (!sonidoActivo) return;

    const pista = pistasAudio[nombre];
    if (pista) {
      try {
        const clon = pista.cloneNode();
        clon.volume = 0.5;
        const promesa = clon.play();
        if (promesa && typeof promesa.then === 'function') {
          promesa.then(null, () => sintetizar(nombre));
        }
        return;
      } catch (error) {
        // Se continúa con la síntesis
      }
    }
    sintetizar(nombre);
  }

  /**
   * Genera el tono correspondiente con la Web Audio API (respaldo).
   * @private
   * @param {string} nombre
   */
  function sintetizar(nombre) {
    try {
      const Contexto = global.AudioContext || global.webkitAudioContext;
      if (!Contexto) return;
      if (!audioContexto) audioContexto = new Contexto();
      if (audioContexto.state === 'suspended') audioContexto.resume();

      const secuencias = {
        acierto: [[660, 0, 0.09], [880, 0.09, 0.12]],
        error: [[220, 0, 0.16], [150, 0.14, 0.2]],
        tecla: [[520, 0, 0.05]],
        victoria: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1046, 0.36, 0.28]],
        derrota: [[392, 0, 0.18], [311, 0.18, 0.18], [233, 0.36, 0.35]]
      };
      const notas = secuencias[nombre] || secuencias.tecla;
      const inicio = audioContexto.currentTime;

      notas.forEach(([frecuencia, retraso, duracion]) => {
        const oscilador = audioContexto.createOscillator();
        const ganancia = audioContexto.createGain();
        oscilador.type = 'triangle';
        oscilador.frequency.value = frecuencia;
        ganancia.gain.setValueAtTime(0.0001, inicio + retraso);
        ganancia.gain.exponentialRampToValueAtTime(0.25, inicio + retraso + 0.02);
        ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + retraso + duracion);
        oscilador.connect(ganancia);
        ganancia.connect(audioContexto.destination);
        oscilador.start(inicio + retraso);
        oscilador.stop(inicio + retraso + duracion + 0.05);
      });
    } catch (error) {
      // El sonido es opcional: nunca debe romper la partida.
    }
  }

  /* ==========================================================
   * 12. Inicialización de la capa de presentación
   * ========================================================== */

  /**
   * Prepara el teclado virtual y los archivos de sonido.
   */
  function inicializar() {
    construirTeclado();
    prepararArchivosDeSonido();

    // Respaldo si el mapa no puede cargarse (archivo dañado / sin red).
    const imagenMapa = $('mapa-imagen');
    if (imagenMapa) {
      const falla = () => {
        imagenMapa.hidden = true;
        const aviso = $('mapa-error');
        if (aviso) aviso.hidden = false;
      };
      imagenMapa.addEventListener('error', falla);
      if (imagenMapa.complete && imagenMapa.naturalWidth === 0) falla();
    }
  }

  /* ==========================================================
   * Espacio de nombres público
   * ========================================================== */
  global.UI = {
    $,
    crear,
    anunciar,
    mostrarVista,
    renderPalabra,
    renderTeclado,
    construirTeclado,
    dibujarAhorcado,
    renderMapa,
    renderHUD,
    refrescar,
    mostrarPista,
    ocultarPista,
    mostrarTurno,
    mostrarResultado,
    ocultarResultado,
    modalAbierto,
    formatearTiempo,
    aplicarTema,
    aplicarSonido,
    reproducir,
    inicializar
  };
})(window);
