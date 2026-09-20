import type { EventoEstudio } from "./tipos";
import { diasEntre, hoyISO, sumarDias, type FechaISO } from "./fechas";

/**
 * Racha de días estudiando.
 *
 * Un día cuenta si hay cualquier evento de estudio. La racha admite unos pocos
 * "días libres" al mes: un hueco los consume en vez de romper la racha, para que
 * descansar un domingo no castigue. Si se acaban los días libres, la racha se corta.
 */
export type Racha = {
  dias: number;
  diasLibresUsados: number;
  diasLibresRestantes: number;
  /** true si hoy todavía no hay ningún evento registrado. */
  hoyPendiente: boolean;
  ultimoDiaActivo?: FechaISO;
};

export function calcularRacha(
  eventos: EventoEstudio[],
  opciones: { hoy?: FechaISO; diasLibresAlMes?: number } = {},
): Racha {
  const hoy = opciones.hoy ?? hoyISO();
  const permitidos = opciones.diasLibresAlMes ?? 2;
  const activos = new Set(eventos.map((e) => e.fecha));

  if (activos.size === 0) {
    return { dias: 0, diasLibresUsados: 0, diasLibresRestantes: permitidos, hoyPendiente: true };
  }

  const hoyPendiente = !activos.has(hoy);
  // Si hoy aún no se ha estudiado, la racha se cuenta hasta ayer y no se penaliza:
  // el día no ha terminado.
  let cursor = hoyPendiente ? sumarDias(hoy, -1) : hoy;

  let dias = 0;
  let libresUsados = 0;
  let ultimoDiaActivo: FechaISO | undefined;

  // Un mes hacia atrás como mucho: más allá la racha ya no aporta información útil.
  const limite = 400;
  for (let i = 0; i < limite; i += 1) {
    if (activos.has(cursor)) {
      dias += 1;
      ultimoDiaActivo = ultimoDiaActivo ?? cursor;
      cursor = sumarDias(cursor, -1);
      continue;
    }

    // Hueco. Solo tiene sentido gastar un día libre si la racha continúa antes
    // del hueco: si ya no hay nada anterior, la racha simplemente terminó ahí.
    const laRachaSigueAntes = [...activos].some((f) => f < cursor);
    if (!laRachaSigueAntes) break;

    const dentroDelMismoMes = Math.abs(diasEntre(cursor, hoy)) <= 31;
    if (dentroDelMismoMes && libresUsados < permitidos) {
      libresUsados += 1;
      cursor = sumarDias(cursor, -1);
      continue;
    }
    break;
  }

  return {
    dias,
    diasLibresUsados: libresUsados,
    diasLibresRestantes: Math.max(0, permitidos - libresUsados),
    hoyPendiente,
    ultimoDiaActivo,
  };
}

/** Días naturales que faltan para el examen. Negativo si ya pasó. */
export function diasParaExamen(fechaExamen?: FechaISO, hoy: FechaISO = hoyISO()): number | null {
  if (!fechaExamen) return null;
  return diasEntre(hoy, fechaExamen);
}
