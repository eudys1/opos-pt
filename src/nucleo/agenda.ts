import type { EventoEstudio, Objetivo, TipoActividad, TipoEvento } from "./tipos";
import { sumarDias, type FechaISO } from "./fechas";
import { progresoDelTema } from "./repasos";

/**
 * La agenda: todo lo que hay en cada día, venga de donde venga.
 *
 * Junta tres cosas que antes vivían separadas y por eso se contradecían:
 *   - lo hecho (los hitos del registro y el resto de eventos de estudio),
 *   - lo previsto (el próximo repaso de cada tema, o el día al que se movió),
 *   - lo que la persona se ha propuesto (sus objetivos).
 */

export type EstadoEntrada = "hecho" | "pendiente" | "atrasado";

export type EntradaAgenda = {
  /** Estable entre renders: sirve de key y para localizar la entrada. */
  clave: string;
  fecha: FechaISO;
  tipo: TipoActividad;
  estado: EstadoEntrada;
  origen: "hito" | "evento" | "previsto" | "objetivo";
  temaId?: string;
  /** En hitos y previstos: 0 = estudiar, 1 = repaso 1… */
  indice?: number;
  eventoId?: string;
  objetivoId?: string;
  /** Solo en objetivos: lo que escribió la persona. */
  texto?: string;
  /** Solo en previstos atrasados: cuántos días lleva de retraso. */
  diasDeRetraso?: number;
  /** Solo en previstos: la fecha en que tocaba, si se ha movido a hoy por retraso. */
  tocabaEn?: FechaISO;
  /** Si es solo de unos apartados del tema (ids). Sin esto, el tema entero. */
  apartados?: string[];
  /**
   * Es un paso del Registro (estudiado, repasos, o el día para empezar un
   * tema) y no un objetivo suelto: se marca igual en los dos sitios.
   */
  delRegistro?: boolean;
};

const TIPO_DE_EVENTO: Record<TipoEvento, TipoActividad> = {
  estudiado: "temario",
  repaso: "repaso",
  practica: "practica",
  supuesto: "supuesto",
  simulacro: "simulacro",
  cantar: "repaso",
};

/** Objetivos que no son objetivos: son repasos movidos de día. */
export function esReprogramacion(o: Objetivo): boolean {
  return Boolean(o.automatico && o.temaId && o.numeroRepaso);
}

/**
 * El día previsto para empezar a estudiar un tema. Es un objetivo más (sale en
 * el planificador y se marca como cualquiera), creado por el Registro y atado
 * al tema; a diferencia de una reprogramación, no lleva número de repaso.
 */
export function esInicioPrevisto(o: Objetivo): boolean {
  return Boolean(o.automatico && o.temaId && !o.numeroRepaso);
}

/** El inicio previsto de un tema, si lo tiene. */
export function inicioPrevistoDe(objetivos: Objetivo[], temaId: string): Objetivo | undefined {
  return objetivos.find((o) => esInicioPrevisto(o) && o.temaId === temaId);
}

/**
 * Si un tema ya está empezado, desde cuándo y por qué. Cuenta lo primero que
 * pase de esto:
 *   - "estudiado": tiene marcado el estudiado (y con él, cualquier repaso, que
 *     no puede existir sin el estudiado antes);
 *   - "practica": has practicado con él (test, cortas, supuestos…);
 *   - "marcado": lo marcaste a mano como empezado desde el Registro.
 * Si lo marcaste a mano, manda tu día: es una corrección tuya (lo empezaste a
 * leer antes de marcarlo, por ejemplo). Si no, el día más temprano de lo demás.
 * null: aún no lo has empezado.
 */
export type Empezado = { fecha: FechaISO; motivo: "estudiado" | "practica" | "marcado" };

export function empezadoDesde(
  temaId: string,
  eventos: EventoEstudio[],
  objetivos: Objetivo[],
): Empezado | null {
  const inicio = inicioPrevistoDe(objetivos, temaId);
  if (inicio?.hecho) {
    // Si coincide con el día de algo hecho, es que se cumplió al marcarlo (el
    // estudiado lo da por cumplido): el motivo es eso, no una fecha puesta a mano.
    const delMismoDia = eventos.find((e) => e.temaId === temaId && e.fecha === inicio.fecha);
    const motivo = !delMismoDia
      ? "marcado"
      : delMismoDia.tipo === "estudiado" || delMismoDia.tipo === "repaso"
        ? "estudiado"
        : "practica";
    return { fecha: inicio.fecha, motivo };
  }
  const candidatos: Empezado[] = [];
  for (const e of eventos) {
    if (e.temaId !== temaId) continue;
    candidatos.push({
      fecha: e.fecha,
      motivo: e.tipo === "estudiado" || e.tipo === "repaso" ? "estudiado" : "practica",
    });
  }
  if (!candidatos.length) return null;
  return candidatos.reduce((a, b) => (b.fecha < a.fecha ? b : a));
}

/** tema → número de repaso → nueva fecha. */
export function reprogramadosPorTema(
  objetivos: Objetivo[],
): Record<string, Record<number, FechaISO>> {
  const mapa: Record<string, Record<number, FechaISO>> = {};
  for (const o of objetivos) {
    if (!esReprogramacion(o)) continue;
    mapa[o.temaId!] ??= {};
    mapa[o.temaId!][o.numeroRepaso!] = o.fecha;
  }
  return mapa;
}

export type DatosAgenda = {
  eventos: EventoEstudio[];
  objetivos: Objetivo[];
  temaIds: string[];
  intervalos: number[];
  hoy: FechaISO;
};

/** Días entre dos fechas, ambas incluidas. */
export function diasDelRango(desde: FechaISO, hasta: FechaISO): FechaISO[] {
  const dias: FechaISO[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

export function agenda(
  desde: FechaISO,
  hasta: FechaISO,
  datos: DatosAgenda,
): Map<FechaISO, EntradaAgenda[]> {
  const mapa = new Map<FechaISO, EntradaAgenda[]>();
  const dentro = (f: FechaISO) => f >= desde && f <= hasta;
  const poner = (e: EntradaAgenda) => {
    if (!dentro(e.fecha)) return;
    const lista = mapa.get(e.fecha) ?? [];
    lista.push(e);
    mapa.set(e.fecha, lista);
  };

  // 1. Lo hecho.
  for (const ev of datos.eventos) {
    const esHito = ev.tipo === "estudiado" || ev.tipo === "repaso";
    poner({
      clave: `ev-${ev.id}`,
      fecha: ev.fecha,
      tipo: TIPO_DE_EVENTO[ev.tipo],
      estado: "hecho",
      origen: esHito ? "hito" : "evento",
      temaId: ev.temaId,
      indice: esHito ? (ev.tipo === "estudiado" ? 0 : (ev.numeroRepaso ?? 0)) : undefined,
      eventoId: ev.id,
      apartados: ev.apartados,
      delRegistro: esHito,
    });
  }

  // 2. Lo previsto: el próximo repaso de cada tema. Si va con retraso, se
  //    enseña hoy, que es cuando se puede hacer, diciendo desde cuándo toca.
  const reprogramados = reprogramadosPorTema(datos.objetivos);
  for (const temaId of datos.temaIds) {
    const { siguiente, diasDeRetraso } = progresoDelTema(datos.eventos, temaId, {
      intervalos: datos.intervalos,
      hoy: datos.hoy,
      reprogramados: reprogramados[temaId],
    });
    if (!siguiente?.tocaEn) continue;
    const atrasado = siguiente.estado === "atrasado";
    poner({
      clave: `prev-${temaId}-${siguiente.indice}`,
      fecha: atrasado ? datos.hoy : siguiente.tocaEn,
      tipo: "repaso",
      estado: atrasado ? "atrasado" : "pendiente",
      origen: "previsto",
      delRegistro: true,
      temaId,
      indice: siguiente.indice,
      diasDeRetraso: atrasado ? diasDeRetraso : undefined,
      tocabaEn: atrasado ? siguiente.tocaEn : undefined,
    });
  }

  // 3. Lo propuesto.
  for (const o of datos.objetivos) {
    if (esReprogramacion(o)) continue;
    poner({
      clave: `obj-${o.id}`,
      fecha: o.fecha,
      tipo: o.tipo ?? "otro",
      estado: o.hecho ? "hecho" : o.fecha < datos.hoy ? "atrasado" : "pendiente",
      origen: "objetivo",
      temaId: o.temaId,
      objetivoId: o.id,
      texto: o.texto,
      apartados: o.apartados,
      delRegistro: esInicioPrevisto(o),
    });
  }

  // Dentro de cada día: primero lo pendiente, luego lo hecho.
  const peso: Record<EstadoEntrada, number> = { atrasado: 0, pendiente: 1, hecho: 2 };
  for (const lista of mapa.values()) lista.sort((a, b) => peso[a.estado] - peso[b.estado]);

  return mapa;
}

/**
 * Por qué no se puede llevar una entrada de la agenda a otro día al arrastrarla:
 *   - "historial": un hito o un evento ya hecho es historia; su fecha se cambia
 *     desde su ventana, donde se comprueba que siga en orden con los demás.
 *   - "pasado": un repaso pendiente no se puede dejar para un día que ya pasó.
 *   - "mismo-dia": se ha soltado donde estaba; no hay nada que hacer.
 * null: se puede mover.
 */
export type CodigoMover = "historial" | "pasado" | "mismo-dia";

export function comoMover(entrada: EntradaAgenda, aDia: FechaISO, hoy: FechaISO): CodigoMover | null {
  if (entrada.origen === "hito" || entrada.origen === "evento") return "historial";
  if (aDia === entrada.fecha) return "mismo-dia";
  if (entrada.origen === "previsto" && aDia < hoy) return "pasado";
  return null;
}

export type ResumenObjetivos ={ total: number; hechos: number; porcentaje: number | null };

/** Objetivos propuestos entre dos fechas y cuántos se han cumplido. */
export function resumenObjetivos(
  objetivos: Objetivo[],
  desde: FechaISO,
  hasta: FechaISO,
): ResumenObjetivos {
  const delRango = objetivos.filter(
    (o) => !esReprogramacion(o) && o.fecha >= desde && o.fecha <= hasta,
  );
  const hechos = delRango.filter((o) => o.hecho).length;
  return {
    total: delRango.length,
    hechos,
    porcentaje: delRango.length ? Math.round((hechos / delRango.length) * 100) : null,
  };
}

export type EstadoDia = "nada" | "parcial" | "completo";

/**
 * Cómo fue un día, para el calendario de actividad:
 *   - nada: no se hizo nada;
 *   - parcial: se hizo algo, pero quedaron objetivos sin cumplir;
 *   - completo: se hizo algo y no quedó nada propuesto sin hacer.
 */
export function estadoDelDia(
  fecha: FechaISO,
  eventos: EventoEstudio[],
  objetivos: Objetivo[],
): EstadoDia {
  const propios = objetivos.filter((o) => o.fecha === fecha && !esReprogramacion(o));
  const hechos =
    eventos.filter((e) => e.fecha === fecha).length + propios.filter((o) => o.hecho).length;
  if (hechos === 0) return "nada";
  return propios.some((o) => !o.hecho) ? "parcial" : "completo";
}

/** Lunes de la semana de una fecha. */
export function lunesDe(fecha: FechaISO): FechaISO {
  const d = new Date(`${fecha}T00:00:00`);
  const diaSemana = (d.getDay() + 6) % 7;
  return sumarDias(fecha, -diaSemana);
}

/**
 * Días que pinta la rejilla de un mes: de lunes a domingo, empezando en el
 * lunes de la semana del día 1 y acabando en el domingo de la del último día.
 */
export function rejillaDelMes(mes: string): FechaISO[] {
  const primero = `${mes}-01`;
  const [anio, numeroMes] = mes.split("-").map(Number);
  const ultimoDia = new Date(anio, numeroMes, 0).getDate();
  const ultimo = `${mes}-${String(ultimoDia).padStart(2, "0")}`;
  const desde = lunesDe(primero);
  const hasta = sumarDias(lunesDe(ultimo), 6);
  return diasDelRango(desde, hasta);
}
