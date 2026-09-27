/**
 * Compresión en el navegador, antes de subir nada.
 *
 * Una foto del móvil pesa entre 3 y 6 MB y la API de Claude la reduce de todos
 * modos a unos 1.568 px de lado para leerla. Mandar más resolución solo hace la
 * subida más lenta y el almacén más grande. A 2.000 px y calidad 0,82 la letra
 * se sigue leyendo bien y la foto se queda en unos 300 a 600 KB.
 *
 * Si algo no se puede comprimir (un PDF, un HEIC que el navegador no sabe
 * abrir, o una imagen que ya era pequeña), se sube tal cual: comprimir es una
 * mejora, nunca un motivo para que falle una subida.
 */

export const LADO_MAXIMO = 2000;
export const CALIDAD = 0.82;

export async function comprimirImagen(
  archivo: File,
  opciones: { ladoMaximo?: number; calidad?: number } = {},
): Promise<File> {
  const ladoMaximo = opciones.ladoMaximo ?? LADO_MAXIMO;
  const calidad = opciones.calidad ?? CALIDAD;

  if (!archivo.type.startsWith("image/")) return archivo;

  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
    const ancho = Math.round(imagen.width * escala);
    const alto = Math.round(imagen.height * escala);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(imagen, 0, 0, ancho, alto);
    imagen.close();

    const blob = await new Promise<Blob | null>((resolver) =>
      lienzo.toBlob(resolver, "image/jpeg", calidad),
    );
    if (!blob || blob.size >= archivo.size) return archivo;

    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return archivo;
  }
}

/** Formato de audio para grabar voz: Opus si el navegador lo sabe hacer. */
export function formatoDeGrabacion(): { tipo: string; extension: string } {
  const candidatos = [
    { tipo: "audio/webm;codecs=opus", extension: "webm" },
    { tipo: "audio/ogg;codecs=opus", extension: "ogg" },
    { tipo: "audio/mp4", extension: "m4a" },
  ];
  if (typeof MediaRecorder === "undefined") return candidatos[0];
  return candidatos.find((c) => MediaRecorder.isTypeSupported(c.tipo)) ?? candidatos[2];
}

/**
 * 24 kbps en mono: es voz, no música. Opus a esa tasa suena natural, y un tema
 * de unos 17 minutos se queda en unos 3 MB.
 */
export const BITS_POR_SEGUNDO_VOZ = 24_000;
