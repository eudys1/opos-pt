import type { EstadoEstudio, EventoEstudio } from "./tipos";
import type { FechaISO } from "./fechas";

/**
 * Los hitos de estudio de un tema —estudiado, repaso 1, repaso 2…— y las
 * reglas para editarlos.
 *
 * El registro y el planificador leen y escriben estos mismos eventos. Por eso
 * no hace falta "sincronizarlos": cambiar una fecha en uno la cambia en el otro
 * porque es el mismo dato.
 *
 * Aquí no hay textos: se devuelven códigos y la pantalla redacta la frase.
 */

export type Hito = {
  /** 0 = estudiado, 1 = repaso 1… */
  indice: number;
  evento: EventoEstudio;
};

export type CodigoEdicion =
  | "no-existe"
  | "en-el-futuro"
  | "antes-del-anterior"
  | "despues-del-siguiente"
  | "sin-estudiar"
  | "vuelta-completa";

export type ResultadoEdicion =
  | { ok: true; eventos: EventoEstudio[] }
  | { ok: false; codigo: CodigoEdicion };

function indiceDe(evento: EventoEstudio): number {
  return evento.tipo === "estudiado" ? 0 : (evento.numeroRepaso ?? 0);
}

export function hitosDelTema(eventos: EventoEstudio[], temaId: string): Hito[] {
  return eventos
    .filter((e) => e.temaId === temaId && (e.tipo === "estudiado" || e.tipo === "repaso"))
    .map((evento) => ({ indice: indiceDe(evento), evento }))
    .sort((a, b) => a.indice - b.indice);
}

/**
 * Entre qué fechas puede ir un hito: no antes del hito anterior, no después del
 * siguiente y nunca en el futuro, porque es algo que ya se ha hecho.
 */
export function limitesDeFecha(
  eventos: EventoEstudio[],
  temaId: string,
  indice: number,
  hoy: FechaISO,
): { min?: FechaISO; max: FechaISO } {
  const hitos = hitosDelTema(eventos, temaId);
  const anterior = hitos.filter((h) => h.indice < indice).at(-1);
  const siguiente = hitos.find((h) => h.indice > indice);
  const max = siguiente && siguiente.evento.fecha < hoy ? siguiente.evento.fecha : hoy;
  return { min: anterior?.evento.fecha, max };
}

function comprobarFecha(
  eventos: EventoEstudio[],
  temaId: string,
  indice: number,
  fecha: FechaISO,
  hoy: FechaISO,
): CodigoEdicion | null {
  if (fecha > hoy) return "en-el-futuro";
  const { min, max } = limitesDeFecha(eventos, temaId, indice, hoy);
  if (min && fecha < min) return "antes-del-anterior";
  if (fecha > max) return "despues-del-siguiente";
  return null;
}

/** Cambia el día en que se hizo un hito ya marcado. */
export function cambiarFechaHito(
  eventos: EventoEstudio[],
  temaId: string,
  indice: number,
  fecha: FechaISO,
  hoy: FechaISO,
): ResultadoEdicion {
  const hito = hitosDelTema(eventos, temaId).find((h) => h.indice === indice);
  if (!hito) return { ok: false, codigo: "no-existe" };
  const problema = comprobarFecha(eventos, temaId, indice, fecha, hoy);
  if (problema) return { ok: false, codigo: problema };
  return {
    ok: true,
    eventos: eventos.map((e) => (e.id === hito.evento.id ? { ...e, fecha } : e)),
  };
}

/**
 * Qué se quitaría al desmarcar un hito: él y todos los posteriores, porque cada
 * repaso se cuenta desde el anterior. Sirve para avisar antes de hacerlo.
 */
export function hitosQueSeQuitan(eventos: EventoEstudio[], temaId: string, indice: number): Hito[] {
  return hitosDelTema(eventos, temaId).filter((h) => h.indice >= indice);
}

export function desmarcarHito(
  eventos: EventoEstudio[],
  temaId: string,
  indice: number,
): EventoEstudio[] {
  const fuera = new Set(hitosQueSeQuitan(eventos, temaId, indice).map((h) => h.evento.id));
  return eventos.filter((e) => !fuera.has(e.id));
}

/**
 * Marca el siguiente hito del tema en la fecha que se diga, no solo hoy: así se
 * puede apuntar un repaso que se hizo ayer y se olvidó marcar.
 */
export function marcarSiguienteHito(
  eventos: EventoEstudio[],
  temaId: string,
  fecha: FechaISO,
  opciones: {
    hoy: FechaISO;
    totalRepasos: number;
    nuevoId: () => string;
    /** Si solo se hizo una parte del tema: los apartados. Vacío es el tema entero. */
    apartados?: string[];
  },
): ResultadoEdicion {
  const hitos = hitosDelTema(eventos, temaId);
  const indice = hitos.length === 0 ? 0 : (hitos.at(-1)?.indice ?? 0) + 1;
  if (indice > opciones.totalRepasos) return { ok: false, codigo: "vuelta-completa" };

  if (fecha > opciones.hoy) return { ok: false, codigo: "en-el-futuro" };
  const anterior = hitos.at(-1);
  if (anterior && fecha < anterior.evento.fecha) return { ok: false, codigo: "antes-del-anterior" };

  const parte = opciones.apartados?.length ? { apartados: opciones.apartados } : {};
  const nuevo: EventoEstudio =
    indice === 0
      ? { id: opciones.nuevoId(), temaId, tipo: "estudiado", fecha, ...parte }
      : { id: opciones.nuevoId(), temaId, tipo: "repaso", numeroRepaso: indice, fecha, ...parte };

  return { ok: true, eventos: [...eventos, nuevo] };
}

/** El estado de estudio se deduce de los hitos, así nunca se desincroniza. */
export function estadoEstudioDe(
  eventos: EventoEstudio[],
  temaId: string,
  totalRepasos: number,
): EstadoEstudio {
  const hitos = hitosDelTema(eventos, temaId);
  if (!hitos.some((h) => h.indice === 0)) return "por_estudiar";
  const repasos = hitos.filter((h) => h.indice > 0).length;
  if (repasos === 0) return "estudiado";
  return repasos >= totalRepasos ? "dominado" : "en_repaso";
}

/**
 * Cambia qué apartados cubrió un hito ya hecho. Vacío es el tema entero. No
 * mueve fechas ni cambia el orden: solo anota de qué fue ese repaso.
 */
export function apartadosDeHito(
  eventos: EventoEstudio[],
  temaId: string,
  indice: number,
  apartados: string[],
): EventoEstudio[] {
  const hito = hitosDelTema(eventos, temaId).find((h) => h.indice === indice);
  if (!hito) return eventos;
  return eventos.map((e) =>
    e.id === hito.evento.id ? { ...e, apartados: apartados.length ? apartados : undefined } : e,
  );
}
