import { hoyISO, sumarDias, type FechaISO } from "./fechas";

/**
 * Cola de repaso de fallos.
 *
 * Cada vez que se acierta una pregunta fallada, vuelve más tarde; a los tres
 * aciertos seguidos se da por superada. Un fallo la devuelve al principio, pero
 * se recuerda cuántas veces se ha fallado, que es lo que señala los puntos flojos.
 */

export const INTERVALOS_FALLOS = [1, 3, 7, 14, 30];
export const ACIERTOS_PARA_SUPERAR = 3;

export type Fallo = {
  itemId: string;
  temaId: string;
  proximaFecha: FechaISO;
  aciertosSeguidos: number;
  vecesFallado: number;
  /** Fecha en la que se dio por superado. Sin valor mientras siga en la cola. */
  resueltoEn?: FechaISO;
};

/** Alta de un fallo nuevo, o reapertura de uno que ya se había superado. */
export function registrarFallo(
  previo: Fallo | undefined,
  datos: { itemId: string; temaId: string },
  hoy: FechaISO = hoyISO(),
): Fallo {
  return {
    itemId: datos.itemId,
    temaId: datos.temaId,
    proximaFecha: sumarDias(hoy, INTERVALOS_FALLOS[0]),
    aciertosSeguidos: 0,
    vecesFallado: (previo?.vecesFallado ?? 0) + 1,
    resueltoEn: undefined,
  };
}

/** Qué pasa con un fallo de la cola después de volver a responderlo. */
export function trasResponder(
  fallo: Fallo,
  acierto: boolean,
  hoy: FechaISO = hoyISO(),
): Fallo {
  if (!acierto) {
    return {
      ...fallo,
      proximaFecha: sumarDias(hoy, INTERVALOS_FALLOS[0]),
      aciertosSeguidos: 0,
      vecesFallado: fallo.vecesFallado + 1,
      resueltoEn: undefined,
    };
  }

  const aciertosSeguidos = fallo.aciertosSeguidos + 1;

  if (aciertosSeguidos >= ACIERTOS_PARA_SUPERAR) {
    return { ...fallo, aciertosSeguidos, resueltoEn: hoy };
  }

  // El intervalo crece con cada acierto seguido.
  const intervalo = INTERVALOS_FALLOS[Math.min(aciertosSeguidos, INTERVALOS_FALLOS.length - 1)];
  return {
    ...fallo,
    aciertosSeguidos,
    proximaFecha: sumarDias(hoy, intervalo),
    resueltoEn: undefined,
  };
}

/** Los que tocan hoy o se han quedado atrás, lo más atrasado primero. */
export function colaDelDia(fallos: Fallo[], hoy: FechaISO = hoyISO()): Fallo[] {
  return fallos
    .filter((f) => !f.resueltoEn && f.proximaFecha <= hoy)
    .sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha));
}

/** Cuántos quedan abiertos y cuántos se han superado. */
export function resumenFallos(fallos: Fallo[], hoy: FechaISO = hoyISO()) {
  const abiertos = fallos.filter((f) => !f.resueltoEn);
  return {
    abiertos: abiertos.length,
    superados: fallos.length - abiertos.length,
    tocanHoy: colaDelDia(fallos, hoy).length,
  };
}
