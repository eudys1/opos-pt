import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/** Toda la app habla en fechas locales AAAA-MM-DD, sin horas ni zonas horarias. */
export type FechaISO = string;

export function hoyISO(referencia: Date = new Date()): FechaISO {
  return format(referencia, "yyyy-MM-dd");
}

export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  const d = parseISO(fecha);
  d.setDate(d.getDate() + dias);
  return format(d, "yyyy-MM-dd");
}

export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  return differenceInCalendarDays(parseISO(hasta), parseISO(desde));
}

/** "22 sep" para tablas, "22 de septiembre de 2026" para textos. */
export function fechaCorta(fecha: FechaISO): string {
  return format(parseISO(fecha), "d MMM", { locale: es });
}

export function fechaLarga(fecha: FechaISO): string {
  return format(parseISO(fecha), "d 'de' MMMM 'de' yyyy", { locale: es });
}

/** "hoy", "mañana", "ayer", "en 3 días", "hace 3 días". */
export function cuando(fecha: FechaISO, hoy: FechaISO = hoyISO()): string {
  const dias = diasEntre(hoy, fecha);
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  if (dias > 1) return `en ${dias} días`;
  return `hace ${Math.abs(dias)} días`;
}
