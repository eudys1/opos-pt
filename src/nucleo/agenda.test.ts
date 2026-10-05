import { describe, expect, it } from "vitest";
import {
  agenda,
  comoMover,
  empezadoDesde,
  esInicioPrevisto,
  esReprogramacion,
  estadoDelDia,
  inicioPrevistoDe,
  rejillaDelMes,
  reprogramadosPorTema,
  resumenObjetivos,
} from "./agenda";
import { progresoDelTema } from "./repasos";
import type { EventoEstudio, Objetivo } from "./tipos";

const HOY = "2026-09-27";
const INTERVALOS = [1, 3, 7];

const eventos: EventoEstudio[] = [
  // Tema 3: estudiado el 20, repaso 1 el 21 → el repaso 2 toca el 24: va tarde.
  { id: "a", temaId: "t3", tipo: "estudiado", fecha: "2026-09-20" },
  { id: "b", temaId: "t3", tipo: "repaso", numeroRepaso: 1, fecha: "2026-09-21" },
  // Tema 4: estudiado hoy → el repaso 1 toca mañana.
  { id: "c", temaId: "t4", tipo: "estudiado", fecha: HOY },
];

const objetivos: Objetivo[] = [
  { id: "o1", fecha: HOY, texto: "Leer tema 5", hecho: false, tipo: "temario" },
  { id: "o2", fecha: HOY, texto: "Un supuesto", hecho: true, tipo: "supuesto" },
  { id: "o3", fecha: "2026-09-22", texto: "Test", hecho: true, tipo: "practica" },
];

const datos = { eventos, objetivos, temaIds: ["t3", "t4"], intervalos: INTERVALOS, hoy: HOY };

describe("agenda", () => {
  it("junta lo hecho, lo previsto y lo propuesto", () => {
    const mapa = agenda("2026-09-21", "2026-09-28", datos);
    const hoy = mapa.get(HOY)!;
    expect(hoy.map((e) => e.origen).sort()).toEqual(["hito", "objetivo", "objetivo", "previsto"]);
    expect(mapa.get("2026-09-28")!.map((e) => e.clave)).toEqual(["prev-t4-1"]);
  });

  it("un repaso atrasado se enseña hoy, diciendo desde cuándo tocaba", () => {
    const previsto = agenda(HOY, HOY, datos)
      .get(HOY)!
      .find((e) => e.origen === "previsto")!;
    expect(previsto).toMatchObject({
      temaId: "t3",
      indice: 2,
      estado: "atrasado",
      tocabaEn: "2026-09-24",
      diasDeRetraso: 3,
    });
  });

  it("lo pendiente va antes que lo hecho", () => {
    const estados = agenda(HOY, HOY, datos).get(HOY)!.map((e) => e.estado);
    expect(estados.indexOf("hecho")).toBeGreaterThan(estados.indexOf("pendiente"));
  });

  it("un repaso movido de día aparece en el día nuevo y en el registro", () => {
    const mover: Objetivo = {
      id: "r",
      fecha: "2026-09-30",
      texto: "",
      hecho: false,
      automatico: true,
      temaId: "t4",
      numeroRepaso: 1,
    };
    const conMovido = { ...datos, objetivos: [...objetivos, mover] };
    const mapa = agenda("2026-09-27", "2026-10-03", conMovido);
    expect(mapa.get("2026-09-28")?.some((e) => e.origen === "previsto")).toBeFalsy();
    expect(mapa.get("2026-09-30")!.map((e) => e.clave)).toEqual(["prev-t4-1"]);

    // El registro lee lo mismo: el repaso 1 del tema 4 toca el 30.
    const { siguiente } = progresoDelTema(eventos, "t4", {
      intervalos: INTERVALOS,
      hoy: HOY,
      reprogramados: reprogramadosPorTema(conMovido.objetivos).t4,
    });
    expect(siguiente?.tocaEn).toBe("2026-09-30");
  });

  it("el inicio previsto de un tema es un objetivo que sale en su día, no un repaso movido", () => {
    const inicio: Objetivo = {
      id: "i",
      fecha: "2026-09-29",
      texto: "Empezar el tema 7",
      hecho: false,
      automatico: true,
      temaId: "t7",
      tipo: "temario",
    };
    expect(esInicioPrevisto(inicio)).toBe(true);
    expect(esReprogramacion(inicio)).toBe(false);
    expect(inicioPrevistoDe([...objetivos, inicio], "t7")?.id).toBe("i");
    expect(inicioPrevistoDe([...objetivos, inicio], "t4")).toBeUndefined();
    const dia = agenda("2026-09-29", "2026-09-29", { ...datos, objetivos: [...objetivos, inicio] }).get(
      "2026-09-29",
    );
    expect(dia?.find((e) => e.objetivoId === "i")?.origen).toBe("objetivo");
  });

  it("la reprogramación no cuenta como objetivo", () => {
    const mover: Objetivo = {
      id: "r",
      fecha: "2026-09-30",
      texto: "",
      hecho: false,
      automatico: true,
      temaId: "t4",
      numeroRepaso: 1,
    };
    expect(resumenObjetivos([...objetivos, mover], "2026-09-21", "2026-09-30").total).toBe(3);
  });
});

describe("resumen de objetivos", () => {
  it("cuenta semana y mes por separado", () => {
    expect(resumenObjetivos(objetivos, "2026-09-21", "2026-09-27")).toEqual({
      total: 3,
      hechos: 2,
      porcentaje: 67,
    });
    expect(resumenObjetivos(objetivos, "2026-10-01", "2026-10-31").porcentaje).toBeNull();
  });
});

describe("estado del día", () => {
  it("gris si no se hizo nada", () => {
    expect(estadoDelDia("2026-09-23", eventos, objetivos)).toBe("nada");
  });
  it("amarillo si se hizo algo pero quedó algo sin hacer", () => {
    expect(estadoDelDia(HOY, eventos, objetivos)).toBe("parcial");
  });
  it("verde si se hizo todo", () => {
    expect(estadoDelDia("2026-09-22", eventos, objetivos)).toBe("completo");
    expect(estadoDelDia("2026-09-21", eventos, objetivos)).toBe("completo");
  });
  it("proponerse algo y no hacer nada sigue siendo gris", () => {
    const solo: Objetivo[] = [{ id: "z", fecha: "2026-09-25", texto: "x", hecho: false }];
    expect(estadoDelDia("2026-09-25", [], solo)).toBe("nada");
  });
});

describe("rejilla del mes", () => {
  it("empieza en lunes y acaba en domingo", () => {
    const dias = rejillaDelMes("2026-09");
    expect(dias[0]).toBe("2026-08-31");
    expect(dias.at(-1)).toBe("2026-10-04");
    expect(dias.length % 7).toBe(0);
  });
});

describe("comoMover", () => {
  const base = { clave: "x", tipo: "otro" as const, estado: "pendiente" as const };
  const HOY_M = "2026-10-04";

  it("un objetivo se mueve a cualquier día, también a uno pasado", () => {
    const e = { ...base, fecha: "2026-10-05", origen: "objetivo" as const, objetivoId: "o" };
    expect(comoMover(e, "2026-10-09", HOY_M)).toBeNull();
    expect(comoMover(e, "2026-10-01", HOY_M)).toBeNull();
  });

  it("un repaso pendiente no se deja para un día que ya pasó", () => {
    const e = { ...base, fecha: HOY_M, origen: "previsto" as const, temaId: "t", indice: 2 };
    expect(comoMover(e, "2026-10-06", HOY_M)).toBeNull();
    expect(comoMover(e, "2026-10-03", HOY_M)).toBe("pasado");
  });

  it("lo ya hecho no se arrastra, y soltar en el mismo día no hace nada", () => {
    const hito = { ...base, estado: "hecho" as const, fecha: "2026-10-01", origen: "hito" as const };
    expect(comoMover(hito, "2026-10-02", HOY_M)).toBe("historial");
    const obj = { ...base, fecha: "2026-10-05", origen: "objetivo" as const };
    expect(comoMover(obj, "2026-10-05", HOY_M)).toBe("mismo-dia");
  });
});

describe("empezadoDesde", () => {
  const inicio = (hecho: boolean, fecha = "2026-10-10"): Objetivo => ({
    id: "i", fecha, texto: "Empezar el tema 7", hecho, automatico: true, temaId: "t7", tipo: "temario",
  });
  const ev = (tipo: EventoEstudio["tipo"], fecha: string, numeroRepaso?: number): EventoEstudio => ({
    id: `${tipo}-${fecha}`, temaId: "t7", tipo, fecha, numeroRepaso,
  });

  it("sin nada, no está empezado; con solo un día previsto, tampoco", () => {
    expect(empezadoDesde("t7", [], [])).toBeNull();
    expect(empezadoDesde("t7", [], [inicio(false)])).toBeNull();
  });

  it("estudiado o con repasos cuenta como empezado, con el día real y no el previsto", () => {
    expect(empezadoDesde("t7", [ev("estudiado", "2026-10-12")], [inicio(true)])).toEqual({
      fecha: "2026-10-10",
      motivo: "marcado",
    });
    expect(empezadoDesde("t7", [ev("estudiado", "2026-10-12"), ev("repaso", "2026-10-13", 1)], [])).toEqual({
      fecha: "2026-10-12",
      motivo: "estudiado",
    });
  });

  it("haber practicado con el tema también es haberlo empezado", () => {
    expect(empezadoDesde("t7", [ev("practica", "2026-10-08")], [inicio(false)])).toEqual({
      fecha: "2026-10-08",
      motivo: "practica",
    });
  });

  it("el día que pones a mano manda, aunque sea después del estudiado", () => {
    expect(empezadoDesde("t7", [ev("estudiado", "2026-10-12")], [inicio(true, "2026-10-15")])).toEqual({
      fecha: "2026-10-15",
      motivo: "marcado",
    });
  });

  it("si el día marcado coincide con el estudiado, el motivo es el estudiado", () => {
    expect(empezadoDesde("t7", [ev("estudiado", "2026-10-12")], [inicio(true, "2026-10-12")])).toEqual({
      fecha: "2026-10-12",
      motivo: "estudiado",
    });
  });

  it("lo de otros temas no cuenta", () => {
    expect(empezadoDesde("t4", [ev("estudiado", "2026-10-12")], [inicio(true)])).toBeNull();
  });
});
