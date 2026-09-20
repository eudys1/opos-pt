import type { EventoEstudio } from "./tipos";
import { INTERVALOS_POR_DEFECTO } from "./tipos";
import { diasEntre, hoyISO, sumarDias, type FechaISO } from "./fechas";

/**
 * Repasos espaciados del registro de estudio.
 *
 * La regla es deliberadamente simple y predecible, porque la usuaria tiene que
 * poder anticiparla: al marcar "estudiado" quedan fijados el repaso 1, 2, 3…
 * a los intervalos configurados, contados SIEMPRE desde el último repaso hecho.
 * Si un repaso se hace tarde, el siguiente se recalcula desde ese día, no desde
 * la fecha teórica: así un retraso no arrastra toda la cadena.
 */

export type EstadoRepaso = "sin_empezar" | "hecho" | "hoy" | "atrasado" | "pendiente";

export type CasillaRepaso = {
  /** 0 = estudiado, 1 = repaso 1, 2 = repaso 2… */
  indice: number;
  estado: EstadoRepaso;
  /** Fecha en la que se hizo, si se hizo. */
  hechoEn?: FechaISO;
  /** Fecha en la que toca, si aún no se ha hecho. */
  tocaEn?: FechaISO;
};

export type ProgresoTema = {
  casillas: CasillaRepaso[];
  /** Primer repaso pendiente, si lo hay. */
  siguiente?: CasillaRepaso;
  diasDeRetraso: number;
};

function eventosDelTema(eventos: EventoEstudio[], temaId: string): EventoEstudio[] {
  return eventos
    .filter((e) => e.temaId === temaId && (e.tipo === "estudiado" || e.tipo === "repaso"))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Construye la fila del registro para un tema: una casilla por cada hito
 * (estudiado + un repaso por intervalo) con su estado y su fecha.
 */
export function progresoDelTema(
  eventos: EventoEstudio[],
  temaId: string,
  opciones: { intervalos?: number[]; hoy?: FechaISO } = {},
): ProgresoTema {
  const intervalos = opciones.intervalos ?? INTERVALOS_POR_DEFECTO;
  const hoy = opciones.hoy ?? hoyISO();
  const propios = eventosDelTema(eventos, temaId);

  const estudiado = propios.find((e) => e.tipo === "estudiado");
  const repasos = propios.filter((e) => e.tipo === "repaso");

  const casillas: CasillaRepaso[] = [];

  if (!estudiado) {
    casillas.push({ indice: 0, estado: "sin_empezar" });
    for (let i = 0; i < intervalos.length; i += 1) {
      casillas.push({ indice: i + 1, estado: "sin_empezar" });
    }
    return { casillas, diasDeRetraso: 0 };
  }

  casillas.push({ indice: 0, estado: "hecho", hechoEn: estudiado.fecha });

  let ultimaFechaHecha: FechaISO = estudiado.fecha;
  let pendienteYaMarcado = false;

  for (let i = 0; i < intervalos.length; i += 1) {
    const hecho = repasos.find((r) => (r.numeroRepaso ?? 0) === i + 1);

    if (hecho) {
      casillas.push({ indice: i + 1, estado: "hecho", hechoEn: hecho.fecha });
      ultimaFechaHecha = hecho.fecha;
      continue;
    }

    const tocaEn = sumarDias(ultimaFechaHecha, intervalos[i]);

    // Solo el primer repaso no hecho tiene fecha activa: los siguientes
    // dependen de cuándo se haga este, así que se muestran como pendientes.
    if (pendienteYaMarcado) {
      casillas.push({ indice: i + 1, estado: "pendiente" });
      continue;
    }

    pendienteYaMarcado = true;
    const dias = diasEntre(hoy, tocaEn);
    const estado: EstadoRepaso = dias === 0 ? "hoy" : dias < 0 ? "atrasado" : "pendiente";
    casillas.push({ indice: i + 1, estado, tocaEn });
  }

  const siguiente = casillas.find(
    (c) => c.estado === "hoy" || c.estado === "atrasado" || (c.estado === "pendiente" && c.tocaEn),
  );

  const diasDeRetraso =
    siguiente?.estado === "atrasado" && siguiente.tocaEn ? -diasEntre(hoy, siguiente.tocaEn) : 0;

  return { casillas, siguiente, diasDeRetraso };
}

/** Repasos que tocan hoy o que se han quedado atrás, ordenados por urgencia. */
export function repasosDelDia(
  eventos: EventoEstudio[],
  temaIds: string[],
  opciones: { intervalos?: number[]; hoy?: FechaISO } = {},
): { temaId: string; casilla: CasillaRepaso; diasDeRetraso: number }[] {
  return temaIds
    .map((temaId) => ({ temaId, ...progresoDelTema(eventos, temaId, opciones) }))
    .filter((p) => p.siguiente?.estado === "hoy" || p.siguiente?.estado === "atrasado")
    .map((p) => ({ temaId: p.temaId, casilla: p.siguiente!, diasDeRetraso: p.diasDeRetraso }))
    .sort((a, b) => b.diasDeRetraso - a.diasDeRetraso);
}

/** Número del próximo repaso a registrar para un tema (1, 2, 3…). */
export function proximoNumeroDeRepaso(eventos: EventoEstudio[], temaId: string): number {
  const repasos = eventosDelTema(eventos, temaId).filter((e) => e.tipo === "repaso");
  return repasos.length + 1;
}
