import { Injectable } from '@angular/core';

export interface ProcessedImage {
  /** Archivo listo para subir: siempre WebP, siempre re-codificado. */
  file: File;
  width: number;
  height: number;
  /** Tamaño del archivo original, para poder mostrar cuánto se ahorró. */
  originalBytes: number;
  bytes: number;
}

export interface ProcessOptions {
  /** Lado mayor máximo, en píxeles. */
  maxDimension?: number;
  /** Tamaño objetivo del resultado. Se baja la calidad hasta acercarse. */
  targetBytes?: number;
  /** Calidad inicial de WebP (0-1). */
  quality?: number;
}

const DEFAULTS: Required<ProcessOptions> = {
  maxDimension: 1024,
  targetBytes: 180 * 1024,
  quality: 0.82,
};

// Límite del archivo de ENTRADA, antes de decodificar. Un JPEG de 30 MB es
// legítimo (una foto de celular), pero más allá de eso es abuso.
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

// Techo de píxeles a decodificar. Un PNG de 200 KB puede declarar 30000x30000 y
// reventar la memoria de la pestaña al descomprimirse ("decompression bomb").
const MAX_INPUT_PIXELS = 50_000_000;

// Calidad mínima antes de rendirse: por debajo el producto se ve sucio.
const MIN_QUALITY = 0.4;

/**
 * Firmas binarias de los formatos rasterizados que aceptamos.
 *
 * `file.type` lo pone el navegador a partir de la extensión y es trivial de
 * falsificar renombrando el archivo: no sirve como control de seguridad. Estos
 * son los magic bytes reales del contenido.
 *
 * SVG NO está en la lista a propósito. Es XML, admite <script> y handlers de
 * evento, y sirve como vector de XSS almacenado si llegara a alojarse. Además
 * no tiene firma binaria fija, así que no podría validarse de esta forma.
 */
const SIGNATURES: readonly { name: string; test: (b: Uint8Array) => boolean }[] = [
  { name: 'PNG',  test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { name: 'JPEG', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { name: 'GIF',  test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    name: 'WebP',
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    // AVIF y HEIC comparten la caja ftyp de ISO-BMFF.
    name: 'AVIF/HEIC',
    test: (b) =>
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
  },
];

export class ImageValidationError extends Error {}

/**
 * Convierte cualquier imagen rasterizada a WebP comprimido.
 *
 * Lo importante para la seguridad no es solo lo que rechaza, sino que NUNCA
 * sube el archivo original: decodifica el contenido a un bitmap, lo re-dibuja
 * en un canvas y codifica un WebP nuevo desde esos píxeles. Todo lo que no sea
 * píxel — metadatos EXIF con GPS, perfiles de color, comentarios, payloads
 * escondidos después del marcador de fin de imagen, cualquier cosa inyectada en
 * el contenedor — se pierde en el camino porque no forma parte del bitmap.
 */
@Injectable({ providedIn: 'root' })
export class ImageProcessorService {
  async process(file: File, options: ProcessOptions = {}): Promise<ProcessedImage> {
    const opts = { ...DEFAULTS, ...options };

    if (file.size === 0) {
      throw new ImageValidationError('El archivo está vacío.');
    }
    if (file.size > MAX_INPUT_BYTES) {
      throw new ImageValidationError(
        `La imagen pesa ${formatBytes(file.size)}. El máximo es ${formatBytes(MAX_INPUT_BYTES)}.`,
      );
    }

    await this.assertRasterSignature(file);

    // createImageBitmap decodifica en el decodificador de imágenes del
    // navegador. A diferencia de <img src=blob:...>, no crea un documento, así
    // que un SVG no llegaría a ejecutar scripts ni a resolver referencias
    // externas — y de todos modos ya quedó descartado por la firma.
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new ImageValidationError('No se pudo leer la imagen. ¿El archivo está dañado?');
    }

    try {
      if (bitmap.width * bitmap.height > MAX_INPUT_PIXELS) {
        throw new ImageValidationError(
          `La imagen es de ${bitmap.width}×${bitmap.height} px, demasiado grande para procesar.`,
        );
      }

      const { width, height } = fitWithin(bitmap.width, bitmap.height, opts.maxDimension);
      const canvas = drawToCanvas(bitmap, width, height);

      // El objetivo nunca puede ser mayor que el original. Un PNG de colores
      // planos (un logo, una captura) comprime mejor en PNG que en WebP con
      // pérdida, así que sin este tope el "compresor" devolvería un archivo más
      // pesado que el que entró. El original no se puede conservar tal cual: el
      // bucket solo acepta WebP y re-codificar es lo que limpia el archivo.
      const target = Math.min(opts.targetBytes, file.size);
      const blob = await encodeWebp(canvas, opts.quality, target);

      return {
        file: new File([blob], 'product.webp', { type: 'image/webp' }),
        width,
        height,
        originalBytes: file.size,
        bytes: blob.size,
      };
    } finally {
      // Sin esto el bitmap descomprimido queda vivo hasta el GC; en una tanda
      // de altas seguidas son decenas de MB retenidos sin necesidad.
      bitmap.close();
    }
  }

  /** Lee los primeros bytes y comprueba que el contenido sea una imagen rasterizada. */
  private async assertRasterSignature(file: File): Promise<void> {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());

    if (header.length < 12) {
      throw new ImageValidationError('El archivo es demasiado corto para ser una imagen.');
    }
    if (!SIGNATURES.some((s) => s.test(header))) {
      throw new ImageValidationError(
        'Formato no admitido. Usa PNG, JPG, WebP, GIF o AVIF. Los SVG no se aceptan por seguridad.',
      );
    }
  }
}

/** Escala respetando el aspecto; nunca agranda una imagen chica. */
function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function drawToCanvas(bitmap: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageValidationError('El navegador no permitió procesar la imagen.');

  // Las fotos con transparencia quedarían con fondo negro al pasar a WebP con
  // calidad; se rellena en blanco para que la miniatura del POS se vea limpia.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);

  return canvas;
}

/**
 * Codifica a WebP bajando la calidad hasta acercarse al objetivo.
 *
 * Se para en el primer intento que cumple, y nunca baja de MIN_QUALITY: con
 * imágenes de colores planos el objetivo puede ser inalcanzable sin arruinar
 * el producto, y ahí es preferible entregar algo más pesado que borroso.
 */
async function encodeWebp(
  canvas: HTMLCanvasElement,
  startQuality: number,
  targetBytes: number,
): Promise<Blob> {
  let quality = startQuality;
  let best = await toBlob(canvas, quality);

  while (best.size > targetBytes && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.12);
    best = await toBlob(canvas, quality);
  }
  return best;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Si el navegador no soporta WebP devuelve PNG silenciosamente, y el
        // bucket lo rechazaría con un error opaco al subir. Mejor cortar acá.
        if (!blob) {
          reject(new ImageValidationError('No se pudo comprimir la imagen.'));
          return;
        }
        if (blob.type !== 'image/webp') {
          reject(new ImageValidationError('Tu navegador no puede generar WebP. Prueba con otro.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
