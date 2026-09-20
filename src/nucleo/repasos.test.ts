import { describe, expect, it } from "vitest";
import { progresoDelTema, proximoNumeroDeRepaso, repasosDelDia } from "./repasos";
import type { EventoEstudio } from "./tipos";

const INTERVALOS = [1, 3, 7, 15, 30];

function evento(parcial: Partial<EventoEstudio> & { fecha: string; tipo: EventoEstudio["tipo"] }): EventoEstudio {
  return { id: Math.random().toString(16), temaId: "t1", ...parcial };
}

describe("progresoDelTema", () => {
  it("deja todo sin empezar mientras el tema no se ha estudiado", () => {
    const progreso = progresoDelTema([], "t1", { intervalos: INTERVALOS, hoy: "2026-09-20" });
    expect(progreso.casillas).toHaveLength(INTERVALOS.length + 1);
    expect(progreso.casillas.every((c) => c.estado === "sin_empezar")).toBe(true);
    expect(progreso.siguiente).toBeUndefined();
  });

  it("programa el primer repaso al día siguiente de estudiar", () => {
    const eventos = [evento({ tipo: "estudiado", fecha: "2026-09-19" })];
    const progreso = progresoDelTema(eventos, "t1", { intervalos: INTERVALOS, hoy: "2026-09-20" });
    expect(progreso.casillas[0].estado).toBe("hecho");
    expect(progreso.casillas[1]).toMatchObject({ estado: "hoy", tocaEn: "2026-09-20" });
  });

  it("marca como atrasado lo que se ha pasado de fecha y cuenta los días", () => {
    const eventos = [evento({ tipo: "estudiado", fecha: "2026-09-10" })];
    const progreso = progresoDelTema(eventos, "t1", { intervalos: INTERVALOS, hoy: "2026-09-20" });
    expect(progreso.casillas[1].estado).toBe("atrasado");
    expect(progreso.diasDeRetraso).toBe(9);
  });

  it("cuenta el siguiente intervalo desde el repaso hecho, no desde la fecha teórica", () => {
    // Estudiado el 1, repaso 1 hecho con retraso el 10: el repaso 2 toca el 13, no el 5.
    const eventos = [
      evento({ tipo: "estudiado", fecha: "2026-09-01" }),
      evento({ tipo: "repaso", numeroRepaso: 1, fecha: "2026-09-10" }),
    ];
    const progreso = progresoDelTema(eventos, "t1", { intervalos: INTERVALOS, hoy: "2026-09-11" });
    expect(progreso.casillas[2]).toMatchObject({ estado: "pendiente", tocaEn: "2026-09-13" });
  });

  it("solo da fecha al primer repaso pendiente: los siguientes dependen de él", () => {
    const eventos = [evento({ tipo: "estudiado", fecha: "2026-09-19" })];
    const progreso = progresoDelTema(eventos, "t1", { intervalos: INTERVALOS, hoy: "2026-09-20" });
    expect(progreso.casillas[2].tocaEn).toBeUndefined();
    expect(progreso.casillas[2].estado).toBe("pendiente");
  });

  it("completa la vuelta cuando están todos los repasos", () => {
    const eventos = [
      evento({ tipo: "estudiado", fecha: "2026-01-01" }),
      ...INTERVALOS.map((_, i) =>
        evento({ tipo: "repaso", numeroRepaso: i + 1, fecha: `2026-02-0${i + 1}` }),
      ),
    ];
    const progreso = progresoDelTema(eventos, "t1", { intervalos: INTERVALOS, hoy: "2026-09-20" });
    expect(progreso.casillas.every((c) => c.estado === "hecho")).toBe(true);
    expect(progreso.siguiente).toBeUndefined();
  });

  it("ignora los eventos de otros temas", () => {
    const eventos = [evento({ tipo: "estudiado", fecha: "2026-09-19", temaId: "otro" })];
    const progreso = progresoDelTema(eventos, "t1", { intervalos: INTERVALOS, hoy: "2026-09-20" });
    expect(progreso.casillas[0].estado).toBe("sin_empezar");
  });
});

describe("repasosDelDia", () => {
  it("devuelve lo de hoy y lo atrasado, lo más atrasado primero", () => {
    const eventos = [
      evento({ tipo: "estudiado", fecha: "2026-09-19", temaId: "a" }),
      evento({ tipo: "estudiado", fecha: "2026-09-10", temaId: "b" }),
      evento({ tipo: "estudiado", fecha: "2026-09-20", temaId: "c" }),
    ];
    const cola = repasosDelDia(eventos, ["a", "b", "c"], {
      intervalos: INTERVALOS,
      hoy: "2026-09-20",
    });
    expect(cola.map((c) => c.temaId)).toEqual(["b", "a"]);
    expect(cola[0].diasDeRetraso).toBe(9);
  });
});

describe("proximoNumeroDeRepaso", () => {
  it("empieza en 1 y avanza con cada repaso registrado", () => {
    expect(proximoNumeroDeRepaso([], "t1")).toBe(1);
    const eventos = [
      evento({ tipo: "estudiado", fecha: "2026-09-01" }),
      evento({ tipo: "repaso", numeroRepaso: 1, fecha: "2026-09-02" }),
    ];
    expect(proximoNumeroDeRepaso(eventos, "t1")).toBe(2);
  });
});
