# 🇨🇴 Ahorcado de las Capitales de Colombia

Juego web educativo del **ahorcado** basado en la geografía y las capitales
departamentales de Colombia. Desarrollado únicamente con **HTML5, CSS3 y
JavaScript ES6+**, sin frameworks, sin servidor ni base de datos externa:
se ejecuta abriendo `index.html` en cualquier navegador moderno.

---

## 1. Índice

1. [Descripción y objetivos](#1-descripción-y-objetivos)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Cómo ejecutarlo](#3-cómo-ejecutarlo)
4. [Reglas del juego](#4-reglas-del-juego)
5. [Arquitectura de módulos](#5-arquitectura-de-módulos)
6. [API pública de cada módulo](#6-api-pública-de-cada-módulo)
7. [Estado de la partida](#7-estado-de-la-partida)
8. [Almacenamiento local](#8-almacenamiento-local)
9. [Diseño, temas y accesibilidad](#9-diseño-temas-y-accesibilidad)
10. [Plan de pruebas (CP-01 … CP-14)](#10-plan-de-pruebas-cp-01--cp-14)
11. [Cómo ejecutar las pruebas](#11-cómo-ejecutar-las-pruebas)
12. [Historias de usuario y requisitos](#12-historias-de-usuario-y-requisitos)
13. [Compatibilidad y navegador](#13-compatibilidad-y-navegador)
14. [Decisiones técnicas](#14-decisiones-técnicas)

---

## 1. Descripción y objetivos

| | |
|---|---|
| **Objetivo general** | Aplicar los fundamentos de HTML, CSS y JavaScript (manipulación del DOM, eventos, estructuras de datos y `localStorage`) en un juego intuitivo que refuerce el conocimiento de las capitales y la geografía de Colombia. |
| **Alcance incluido** | Un solo jugador · banco de las 32 capitales · filtro por región y nivel · teclado virtual y físico · dibujo SVG en 6 etapas · pistas · puntuación · cronómetro · estadísticas y ranking local · pantallas de instrucciones y estadísticas · diseño responsive y accesible desde 360 px. |
| **Alcance excluido** | Sin multijugador en línea, sin backend, sin registro/login, sin base de datos externa. |

### Características

- **32 capitales** departamentales con su departamento, región, longitud y nivel.
- **7 filtros de región**: Todas, Andina, Caribe, Pacífica, Orinoquía, Amazonía e Insular.
- **Mapa real de Colombia** (mapa político de Wikimedia Commons) con las capitales
  de la región elegida **marcadas geográficamente** por coordenadas WGS 84.
- **3 niveles**: Fácil (x1), Medio (x2) y Difícil (x3, 90 segundos).
- Dibujo ilustrado del ahorcado **en SVG** (6 etapas con sombras, gradientes,
  un personaje con sombrero vueltiao, expresión dinámica y animaciones de entrada).
- Teclado virtual **A–Z + Ñ** y soporte de `keydown` con teclado físico.
- Sistema de **2 tipos de pista** (departamento / letra oculta).
- **Estadísticas y Top 5** persistidos en `localStorage`.
- Tema **claro/oscuro**, **sonido activado/desactivado**, ambos recordados entre sesiones.
- Efectos de sonido **WAV generados localmente** con respaldo sintetizado vía *Web Audio API*.

---

## 2. Estructura del proyecto

```
ahorcado-web/
├── index.html                  → Menú principal y tablero de juego
├── css/
│   ├── styles.css              → Variables CSS, temas, layout Flexbox/Grid y componentes
│   └── responsive.css          → Media queries desde 360 px hasta escritorio
├── js/
│   ├── app.js                  → Punto de entrada: eventos y orquestación del flujo
│   ├── juego.js                → Estado, validación, puntaje y temporizador
│   ├── palabras.js             → Banco de capitales y filtros por región/nivel
│   ├── ui.js                   → Render del DOM, teclado, modal y dibujo SVG
│   └── almacenamiento.js       → Lectura/escritura en localStorage
├── assets/
│   ├── img/                    → logo.svg, favicon.svg, mapa-colombia.svg (Wikimedia)
│   └── sonidos/                → acierto.wav, error.wav, victoria.wav, derrota.wav,
│                                 tecla.wav (+ generar-sonidos.js para regenerarlos)
├── pages/
│   ├── instrucciones.html      → Reglas, niveles y tabla de puntuación
│   └── estadisticas.html       → Resumen, Top 5 e historial de partidas
└── README.md                   → Esta documentación técnica
```

Fuera de la carpeta del juego (herramientas de desarrollo):

```
pruebas-ahorcado.js             → Arnés de pruebas CP-01…CP-14 en Node.js
```

---

## 3. Cómo ejecutarlo

**Opción A — doble clic (portabilidad RNF-07):** abre `index.html` directamente.
Los módulos se cargan como *scripts clásicos* (no `type="module"`), por lo que
**no se activa la restricción CORS de `file://`** y el juego funciona sin servidor.

**Opción B — servidor estático (recomendado para desarrollo):**

```bash
npx serve ahorcado-web
# o
python -m http.server 8123 --directory ahorcado-web
```

No hay dependencias de `npm`, `package.json` ni pasos de compilación.

---

## 4. Reglas del juego

### Niveles

| Nivel | Letras | Pistas | Tiempo | Multiplicador |
|---|---|---|---|---|
| Fácil | 4 a 6 | 2 | Sin límite | ×1 |
| Medio | 7 a 9 | 1 | Sin límite | ×2 |
| Difícil | 10 o más | 0 | **90 segundos** | ×3 |

### Puntuación

| Concepto | Puntos |
|---|---|
| Letra correcta (por cada aparición) | **+10** |
| Letra incorrecta | **−5** |
| Usar una pista | **−15** |
| Ganar la partida | **+50 + (vidas restantes × 10)** |
| **Puntaje final** | **subtotal acumulado × multiplicador del nivel** |

### Caracteres especiales

- **Tildes:** no son letras distintas. Escribir `o` revela la `Ó` de *QUIBDÓ*
  (la normalización protege la `Ñ`, que sí es una letra propia).
- **Espacios:** las capitales compuestas (*SANTA MARTA*, *SAN JOSÉ DEL GUAVIARE*)
  muestran el espacio desde el inicio y **nunca** se adivina.

### Flujo

1. **Inicio** → `index.html` muestra el menú.
2. **Configuración** → nombre, región y nivel → botón *Jugar*.
3. **Preparación** → se elige la capital y se dibuja el tablero vacío.
4. **Turno** → letra por teclado virtual o físico.
5. **Validación** → acierto (+10) o error (−5 y una etapa del dibujo).
6. **Verificación** → palabra completa (victoria) o 6 errores / 90 s (derrota).
7. **Resultado** → modal con capital, departamento, región, nivel y puntaje;
   se guarda la estadística en `localStorage`.
8. **Fin** → *Jugar otra vez* o *Volver al menú*.

---

## 5. Arquitectura de módulos

```
        ┌────────────┐
        │   app.js   │  eventos + orquestación
        └─────┬──────┘
   ┌──────────┼───────────────┐
   ▼          ▼               ▼
┌────────┐ ┌────────┐ ┌──────────────┐
│ ui.js  │ │juego.js│ │almacenamiento│
│ (DOM)  │ │(reglas)│ │ (localStorage)│
└───┬────┘ └───┬────┘ └──────┬───────┘
    │          ▼             │
    │     ┌──────────┐       │
    └────►│palabras.js│◄─────┘
          │(datos)    │
          └──────────┘
```

- `palabras.js` y `almacenamiento.js` **no dependen** de nada más.
- `juego.js` depende solo de `palabras.js` y **no toca el DOM**.
- `ui.js` solo lee `Juego.estado` y pinta: no contiene reglas de negocio.
- `app.js` es el único que conecta eventos con la lógica y con la interfaz.

Cada archivo se envuelve en un IIFE que publica un espacio de nombres global
(`Palabras`, `Juego`, `UI`, `Almacenamiento`, `AppAhorcado`), manteniendo el
código modular y a la vez compatible con `file://`.

---

## 6. API pública de cada módulo

### `js/palabras.js` → `window.Palabras`

| Miembro | Descripción |
|---|---|
| `CAPITALES` | Arreglo de 32 objetos `{ capital, departamento, region, letras, nivel, lat, lon }` (`lat`/`lon`: WGS 84 para el mapa). |
| `REGIONES` | Catálogo `{ id, nombre, color }` de las 6 regiones + `todas`. |
| `NIVELES` | `{ facil, medio, dificil }` con letras, pistas, tiempo y multiplicador. |
| `LIMITES_MAPA` | Límites geográficos `{ norte, sur, oeste, este }` del mapa SVG. |
| `normalizar(texto)` | Mayúsculas + sin tildes, conservando la `Ñ`. |
| `filtrarCapitales(region)` | Capitales de una región (CP-14). |
| `filtrarPorNivel(lista, nivel)` | Filtra por longitud del nivel. |
| `cumpleFiltros(capital, region, nivel)` | Comprobación de ambas condiciones. |
| `obtenerCapital(region, nivel)` | Capital aleatoria; evita repetir la anterior y aplica *fallback* si la combinación región+nivel está vacía. |
| `contarCapitales(region, nivel)` | Cantidad de coincidencias. |
| `proyectar(lat, lon)` | Convierte coordenadas en porcentajes sobre el mapa equirectangular. |

### `js/juego.js` → `window.Juego`

| Función | Descripción |
|---|---|
| `iniciarPartida(region, nivel, jugador)` | Reinicia el estado, elige la capital e inicia el cronómetro si aplica. |
| `normalizar(texto)` | Delegado en `Palabras.normalizar` (CP-10). |
| `letrasRequeridas(palabra)` | Letras únicas a adivinar (sin espacios). |
| `letraDisponible(letra)` | `true` si la letra no se ha usado. |
| `procesarLetra(letra)` | Valida y puntúa; devuelve `{ accion, ocurrencias, puntaje, errores, estadoJuego }`. |
| `verificarEstado()` | Devuelve `'victoria' | 'derrota' | 'continua'`. |
| `usarPista()` | 1.ª pista: departamento · 2.ª: letra oculta · ambas −15 pts. |
| `configurarTemporizador(cb)` | Registra el callback de tiempo agotado. |
| `iniciarTemporizador()` / `detenerTemporizador()` | Control del cronómetro de 90 s. |
| `resumenPartida()` | Datos para el modal y para `localStorage`. |
| `progreso()` | Letras descubiertas / requeridas. |
| `finalizar()` | Cierra la partida y detiene el reloj. |

### `js/ui.js` → `window.UI`

| Función | Descripción |
|---|---|
| `mostrarVista(id)` | Alterna menú / juego. |
| `renderPalabra()` | Guiones, letras reveladas y espacios (CP-01, CP-13). |
| `construirTeclado()` / `renderTeclado()` | Teclado A–Z + Ñ y sus estados (CP-04). |
| `dibujarAhorcado(errores)` | Muestra las etapas 1…6 del SVG, la expresión y los puntos de error (CP-03). |
| `renderMapa(region)` | Ubica los marcadores de las capitales de la región sobre el mapa real. |
| `renderHUD()` | Vidas, puntaje, cronómetro, región, nivel y fichas. |
| `refrescar()` | Redibuja todo el tablero. |
| `mostrarPista()` / `ocultarPista()` | Caja de pistas. |
| `mostrarTurno(texto, tipo)` | Mensaje del último intento. |
| `mostrarResultado(gano, resumen)` / `ocultarResultado()` | Modal (CP-06, CP-07). |
| `aplicarTema(tema)` / `aplicarSonido(activo)` | Preferencias visuales. |
| `reproducir(nombre)` | Efectos `acierto|error|victoria|derrota|tecla`. |
| `anunciar(texto)` | Región viva para lectores de pantalla. |

### `js/almacenamiento.js` → `window.Almacenamiento`

| Función | Descripción |
|---|---|
| `guardarEstadisticas(resultado)` | Totales, racha, historial y ranking (CP-06/07/11). |
| `obtenerEstadisticas()` | Totales + `porcentajeVictorias`. |
| `obtenerRanking(cantidad)` | Top 5 por puntaje. |
| `obtenerHistorial(cantidad)` | Últimas N partidas. |
| `limpiarEstadisticas()` | Reinicia el historial. |
| `obtenerConfig()` / `guardarConfig(cambios)` | Nombre, región, nivel, tema y sonido. |
| `disponible()` | Prueba de disponibilidad de `localStorage`. |

### `js/app.js` → `window.AppAhorcado`

`iniciarJuego(parametros)`, `manejarLetra(letra)`, `manejarPista()`,
`finalizarPartida(gano, motivo)`, `volverAlMenu()`,
`actualizarResumenFiltro()` — expuestos para pruebas manuales en consola.

---

## 7. Estado de la partida

```javascript
const estado = {
  jugador: 'Jugador1',
  region: 'andina',
  nivel: 'medio',
  capital: { capital: 'Manizales', departamento: 'Caldas', region: 'Andina', letras: 9, nivel: 'Medio' },
  palabra: 'MANIZALES',
  departamento: 'Caldas',
  regionNombre: 'Andina',
  letrasAcertadas: ['A', 'N'],
  letrasFalladas: ['O', 'T'],
  errores: 2,
  maxErrores: 6,
  pistasDisponibles: 1,
  pistaDepartamentoVisible: false,
  puntaje: 40,
  tiempoRestante: null,     // 90 en nivel difícil
  tiempoLimite: null,       // 90 en nivel difícil
  terminado: false,
  gano: false,
  inicio: 1760000000000
};
```

---

## 8. Almacenamiento local

| Clave | Contenido |
|---|---|
| `ahorcado.estadisticas.v1` | `{ total, ganadas, perdidas, porcentajeVictorias, rachaActual, mejorRacha, puntajeAcumulado, historial[≤100] }` |
| `ahorcado.config.v1` | `{ jugador, region, nivel, tema, sonido }` |

- Toda lectura/escritura está envuelta en `try/catch`: si el navegador bloquea
  `localStorage` (modo privado), el juego sigue funcionando.
- El historial se guarda con la más reciente primero; el ranking se ordena por
  puntaje descendente (y fecha como desempate).
- La clave lleva versión (`v1`) para permitir migraciones futuras.

---

## 9. Diseño, temas y accesibilidad

### Paleta (variables CSS)

| Uso | Variable | Valor |
|---|---|---|
| Fondo y encabezados | `--azul-oscuro` | `#1F3864` |
| Botones e interacciones | `--azul` | `#2E74B5` |
| Aciertos | `--verde` | `#2E9E5B` |
| Errores | `--rojo` | `#D64545` |
| Superficies | `--gris-claro` | `#F2F2F2` |

Se añaden derivados `--azul-texto`, `--verde-texto`, `--rojo-texto`,
`--verde-solido` y `--rojo-solido` **exclusivamente para garantizar el
contraste AA (≥ 4.5:1)** cuando el color se usa como texto o como fondo con
texto blanco encima; los tonos originales se conservan para bordes y acentos.

### Temas

- `[data-tema="claro"]` (por defecto) y `[data-tema="oscuro"]` sobre `<html>`.
- El botón de cabecera alterna y persiste la preferencia.
- Se respeta `prefers-reduced-motion` y `forced-colors`.

### Accesibilidad (RNF-05)

- Regiones `aria-live` para anunciar aciertos, errores, pistas y resultado.
- `role="dialog" aria-modal="true"` con foco inicial en la primera acción.
- `radiogroup`/`legend` para región y nivel; nombres accesibles en cada tecla.
- SVG con `<title>`/`<desc>` y `role="img"`.
- Todos los controles tienen **área táctil ≥ 44 px**.
- **Auditoría Lighthouse: Accesibilidad 100 · Buenas prácticas 100 · SEO 100**
  en tema claro y tema oscuro (sin violaciones WCAG 2.0/2.1 A ni AA según axe-core).

### Responsive (RNF-02)

- `styles.css` define el layout base con **Grid** (`tablero`, `hud`, `fichas`)
  y **Flexbox** (`chips`, `acciones`, `teclado`).
- `responsive.css` contempla: ≥1100 px, ≤1024 px, ≤860 px (tablero a una
  columna), ≤640 px, ≤480 px, ≤380 px y una capa final anti-scroll-horizontal.
- Verificado a **360 px sin scroll horizontal** (CP-12).

---

## 10. Plan de pruebas (CP-01 … CP-14)

| CP | Qué verifica | Resultado |
|---|---|---|
| CP-01 | Al iniciar, guiones por letra + espacio visible, contadores en cero. | ✅ |
| CP-02 | Letra existente se revela en todas sus posiciones y suma +10 por aparición. | ✅ |
| CP-03 | Letra inexistente dibuja una etapa y resta 5 puntos. | ✅ |
| CP-04 | Letra ya usada no realiza ninguna acción (botón deshabilitado). | ✅ |
| CP-05 | `keydown` del teclado físico alimenta la misma ruta que el virtual. | ✅ |
| CP-06 | Palabra completa → modal de victoria, bonus y estadística guardada. | ✅ |
| CP-07 | 6 errores → modal de derrota con la palabra correcta y 6 etapas dibujadas. | ✅ |
| CP-08 | Pista: −15 puntos y decremento de pistas disponibles. | ✅ |
| CP-09 | Nivel difícil: 90 s y tiempo agotado = derrota. | ✅ |
| CP-10 | Escribir `o` revela la `Ó` de *QUIBDÓ*. | ✅ |
| CP-11 | Recargar la página conserva estadísticas y ranking. | ✅ |
| CP-12 | A 360 px todos los elementos son utilizables sin scroll horizontal. | ✅ |
| CP-13 | *SANTA MARTA* muestra el espacio sin contarlo como letra. | ✅ |
| CP-14 | Filtrar por región Insular devuelve únicamente *San Andrés*. | ✅ |

Pruebas complementarias incluidas en el arnés: integridad del banco (32 sin
duplicados, longitud y nivel coherentes), *fallback* de filtro para las 21
combinaciones región×nivel, multiplicadores, normalización de `Ñ`/tildes.

### Dónde se verifica cada CP

- **Lógica (Node):** `pruebas-ahorcado.js` → módulos `palabras`, `juego` y `almacenamiento`.
- **Interfaz (navegador):** se ejecutaron flujos E2E sobre el DOM real: render del
  teclado, teclas virtuales/físicas, modal, HUD, cronómetro, recarga, filtros,
  persistencia y auditorías Lighthouse/axe.

---

## 11. Cómo ejecutar las pruebas

```bash
# Desde la carpeta que contiene ahorcado-web/
node pruebas-ahorcado.js
```

Salida esperada:

```
=== Pruebas del Ahorcado de Colombia ===
  ✔ CP-01 — ...
  ...
----------------------------------------
Aprobados: 19 | Fallidos: 0
Todas las pruebas pasaron.
```

El arnés crea un *shim* de `window` y `localStorage` con `vm.createContext`,
por lo que **no requiere navegador ni dependencias**.

### Regenerar los sonidos

```bash
node ahorcado-web/assets/sonidos/generar-sonidos.js
```

Si los archivos WAV no estuvieran disponibles, `UI.reproducir()` sintetiza los
mismos tonos con la *Web Audio API* (el juego nunca falla por audio).

---

## 12. Historias de usuario y requisitos

| ID | Historia | Implementación |
|---|---|---|
| HU-01 | Elegir región (Andina, Caribe, Pacífica, Orinoquía, Amazonía, Insular o Todas). | Chips radio en `index.html` + `Palabras.filtrarCapitales()` + resumen en vivo. |
| HU-02 | Escoger nivel (Fácil, Medio, Difícil). | Radios de nivel + `Palabras.NIVELES`. |
| HU-03 | Soporte de teclado físico (`keydown`). | `app.js → registrarEventos()`. |
| HU-04 | Ver usadas aciertos/errores en pantalla y teclado. | `UI.renderTeclado()` con clases `--acertada`/`--fallada` y deshabilitado. |
| HU-05 | Botón de pista con descuento. | `Juego.usarPista()` + botón *Usar pista*. |
| HU-06 | Pantalla de estadísticas y ranking local. | `pages/estadisticas.html`. |
| HU-07 | 100 % funcional en navegador, sin instalaciones ni servidores. | Scripts clásicos + `localStorage`; funciona con doble clic. |

Requisitos no funcionales: RNF-01 usabilidad · RNF-02 responsive · RNF-03
respuesta < 100 ms (sin cálculos pesados ni reflows innecesarios) · RNF-04
Chrome/Firefox/Edge/Safari · RNF-05 accesibilidad · RNF-06 mantenibilidad
(módulos comentados en español) · RNF-07 portabilidad.

---

## 13. Compatibilidad y navegador

- Uso de API's ampliamente soportadas: `localStorage`, `AudioContext`
  (con prefijos webkit), `classList`, `dataset`, `closest`, `:has()` solo para
  estilos decorativos de selección (degradación elegante en navegadores sin él:
  el control sigue siendo operativo y visible vía `focus-visible`).
- `flex`/`grid`, `clamp()`, `aspect-ratio` y `backdrop-filter` con valores
  respaldados por defecto.
- Probado en navegador Chromium (Escritorio); el código no usa APIs exclusivas
  de ningún motor.

---

## 14. Decisiones técnicas

1. **Scripts clásicos en vez de ES Modules:** garantiza RNF-07 (abrir
   `index.html` con doble clic) evitando el CORS de `file://`. La modularidad se
   logra con IIFE + espacios de nombres.
2. **`normalizar()` conserva la `Ñ`:** si se elimina la tilde de `Ñ` mediante
   Unicode NFD se convertiría en `N` y la `N` revelaría la `Ñ`. Se protege con un
   carácter comodín antes de descomponer.
3. **Copias defensivas en `almacenamiento.js`:** `obtenerEstadisticas()` copia
   el arreglo `historial` para no mutar la plantilla por referencia (bug detectado
   por el arnés de pruebas CP-11).
4. **`fallback` en `obtenerCapital()`:** regiones pequeñas (Insular) no tienen
   capitales en todos los niveles; el filtro se relaja por región para que la
   partida siempre pueda iniciarse, informándolo en el menú.
5. **Separación estricta reglas/interfaz:** `juego.js` no conoce el DOM, lo que
   permitió probar CP-01…CP-14 en Node sin navegador.
6. **Sonido con doble vía:** WAV locales con síntesis Web Audio de respaldo
   (y `catch` en todo) para que el audio jamás rompa la partida.

---

### Créditos

Proyecto académico de **Lenguajes de Programación** — recurso didáctico de
ciencias sociales sobre la geografía de Colombia.

- **Mapa:** *Colombia adm location map (colored).svg*, de Milenioscuro,
  obtenido de Wikimedia Commons y publicado bajo licencia
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Los marcadores
  de las capitales son una superposición propia calculada con `Palabras.proyectar()`.
- **Ilustración del ahorcado:** dibujo SVG original de este proyecto.
