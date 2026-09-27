import type { EstadoContenido, EstadoEstudio } from "./tipos";

/**
 * Qué versión de un tema gana al juntar lo de este navegador con lo de la
 * cuenta.
 *
 * Aprendido a las malas (27-09-2026): un navegador nuevo crea los 25 temas
 * vacíos con la fecha del día, y la regla antigua («gana la más reciente,
 * comparando solo el día») dejaba que esos temas vacíos borraran en la cuenta
 * los que se habían subido la víspera. Ahora:
 *
 *   1. Nunca se pierde contenido en una fusión: un tema vacío no pisa uno con
 *      contenido, y uno con contenido no se deja pisar por uno vacío.
 *   2. Si los dos tienen algo, gana el modificado más tarde, con la hora
 *      exacta y no solo el día. En empate, la cuenta.
 *
 * Vaciar un tema a propósito sigue funcionando: eso no pasa por la fusión, se
 * sube como cambio desde el propio navegador.
 */

export type VersionTema = {
  texto: string;
  estadoContenido: EstadoContenido;
  estadoEstudio: EstadoEstudio;
  /** ISO con hora, o solo el día en los guardados antiguos, o vacío si nunca se tocó. */
  actualizadoEn: string;
};

/** Milisegundos de una marca de tiempo; 0 si no hay o no se entiende. */
export function marcaDeTiempo(valor: string): number {
  if (!valor) return 0;
  const t = Date.parse(valor.length === 10 ? `${valor}T00:00:00Z` : valor);
  return Number.isNaN(t) ? 0 : t;
}

/** Si el tema tiene algo que perder: texto, estado de contenido o de estudio. */
export function tieneAlgo(v: VersionTema): boolean {
  return (
    v.texto.trim().length > 0 ||
    v.estadoContenido !== "sin_contenido" ||
    v.estadoEstudio !== "por_estudiar"
  );
}

/** true si la versión de este navegador debe imponerse a la de la cuenta. */
export function ganaLaLocal(local: VersionTema, remoto?: VersionTema): boolean {
  if (!remoto) return true;
  const localTiene = tieneAlgo(local);
  const remotoTiene = tieneAlgo(remoto);
  if (!localTiene && remotoTiene) return false;
  if (localTiene && !remotoTiene) return true;
  return marcaDeTiempo(local.actualizadoEn) > marcaDeTiempo(remoto.actualizadoEn);
}

/** Huella de lo que importa de un tema, para saber si ha cambiado desde la última subida. */
export function huellaDeTema(t: {
  titulo: string;
  texto: string;
  estadoContenido: string;
  estadoEstudio: string;
  vueltas: number;
}): string {
  return JSON.stringify([t.titulo, t.texto, t.estadoContenido, t.estadoEstudio, t.vueltas]);
}
