/**
 * Genera los efectos de sonido del ahorcado (WAV PCM 16 bits, mono 22050 Hz)
 * en assets/sonidos/. Uso: node generar-sonidos.js
 */
const fs = require('fs');
const path = require('path');

const FRECUENCIA_MUESTREO = 22050;
const SALIDA = __dirname;

function crearWav(muestras) {
  const bytesMuestra = 2;
  const datos = Buffer.alloc(muestras.length * bytesMuestra);
  for (let i = 0; i < muestras.length; i++) {
    const limite = Math.max(-1, Math.min(1, muestras[i]));
    datos.writeInt16LE(Math.round(limite * 32767), i * bytesMuestra);
  }
  const cabecera = Buffer.alloc(44);
  cabecera.write('RIFF', 0);
  cabecera.writeUInt32LE(36 + datos.length, 4);
  cabecera.write('WAVE', 8);
  cabecera.write('fmt ', 12);
  cabecera.writeUInt32LE(16, 16);          // tamaño del subchunk fmt
  cabecera.writeUInt16LE(1, 20);           // PCM
  cabecera.writeUInt16LE(1, 22);           // mono
  cabecera.writeUInt32LE(FRECUENCIA_MUESTREO, 24);
  cabecera.writeUInt32LE(FRECUENCIA_MUESTREO * 2, 28); // byte rate
  cabecera.writeUInt16LE(2, 32);           // block align
  cabecera.writeUInt16LE(16, 34);          // bits por muestra
  cabecera.write('data', 36);
  cabecera.writeUInt32LE(datos.length, 40);
  return Buffer.concat([cabecera, datos]);
}

/**
 * @param {Array<{f:number, t:number, d:number}>} notas frecuencia, retraso, duración
 */
function sintetizar(notas) {
  const ultima = notas.reduce((max, n) => Math.max(max, n.t + n.d), 0);
  const total = Math.round((ultima + 0.08) * FRECUENCIA_MUESTREO);
  const salida = new Float32Array(total);

  notas.forEach(({ f, t, d }) => {
    const inicio = Math.round(t * FRECUENCIA_MUESTREO);
    const largo = Math.round(d * FRECUENCIA_MUESTREO);
    for (let i = 0; i < largo; i++) {
      const posicion = inicio + i;
      if (posicion >= total) break;
      const tiempo = i / FRECUENCIA_MUESTREO;
      const envolvente = Math.exp(-4 * (tiempo / d)) * Math.min(1, i / 120);
      const onda = Math.sin(2 * Math.PI * f * tiempo) * 0.7 +
                   Math.sin(2 * Math.PI * f * 2 * tiempo) * 0.3;
      salida[posicion] += onda * envolvente * 0.6;
    }
  });

  return Array.from(salida);
}

const efectos = {
  acierto: [{ f: 660, t: 0, d: 0.1 }, { f: 880, t: 0.1, d: 0.16 }],
  error: [{ f: 220, t: 0, d: 0.16 }, { f: 150, t: 0.15, d: 0.24 }],
  tecla: [{ f: 520, t: 0, d: 0.06 }],
  victoria: [
    { f: 523, t: 0, d: 0.14 }, { f: 659, t: 0.14, d: 0.14 },
    { f: 784, t: 0.28, d: 0.14 }, { f: 1046, t: 0.42, d: 0.34 }
  ],
  derrota: [
    { f: 392, t: 0, d: 0.2 }, { f: 311, t: 0.2, d: 0.2 },
    { f: 233, t: 0.4, d: 0.4 }
  ]
};

fs.mkdirSync(SALIDA, { recursive: true });
Object.keys(efectos).forEach((nombre) => {
  const archivo = path.join(SALIDA, nombre + '.wav');
  fs.writeFileSync(archivo, crearWav(sintetizar(efectos[nombre])));
  console.log('Generado:', archivo);
});
