/**
 * El reloj de un simulacro, con pausas.
 *
 * Todo sale de datos del servidor: la hora de inicio, lo que se ha pausado en
 * total y, si está en pausa ahora, desde cuándo. Recargar, cerrar la página o
 * cambiar la hora del ordenador no da ni quita tiempo.
 *
 * En un simulacro real no hay pausas, así que `pausadoTotalS` es 0 y
 * `pausadoEn` no existe: sale la cuenta de siempre.
 */

export type RelojSimulacro = {
  iniciadoEn: string;
  duracionS: number;
  pausadoTotalS: number;
  /** Si está en pausa ahora mismo, desde cuándo. */
  pausadoEn?: string | null;
};

export type LecturaReloj = {
  /** Segundos de trabajo efectivo, sin contar pausas. */
  transcurridoS: number;
  restanteS: number;
  enPausa: boolean;
  agotado: boolean;
};

export function leerReloj(r: RelojSimulacro, ahoraMs: number): LecturaReloj {
  const inicio = new Date(r.iniciadoEn).getTime();
  // Si está en pausa, el tiempo se congela en el momento en que se pausó.
  const referencia = r.pausadoEn ? new Date(r.pausadoEn).getTime() : ahoraMs;
  const bruto = Math.max(0, Math.floor((referencia - inicio) / 1000));
  const transcurridoS = Math.max(0, bruto - r.pausadoTotalS);
  const restanteS = r.duracionS - transcurridoS;
  return {
    transcurridoS,
    restanteS: Math.max(0, restanteS),
    enPausa: Boolean(r.pausadoEn),
    agotado: restanteS <= 0,
  };
}

/** Segundos que suma una pausa al reanudarla. */
export function segundosDePausa(pausadoEn: string, ahoraMs: number): number {
  return Math.max(0, Math.floor((ahoraMs - new Date(pausadoEn).getTime()) / 1000));
}
