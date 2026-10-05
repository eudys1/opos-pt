import { describe, expect, it } from "vitest";
import {
  apartadosDeHito,
  cambiarFechaHito,
  desmarcarHito,
  estadoEstudioDe,
  hitosQueSeQuitan,
  limitesDeFecha,
  marcarSiguienteHito,
} from "./hitos";
import type { EventoEstudio } from "./tipos";

const HOY = "2026-09-27";

const eventos: EventoEstudio[] = [
  { id: "e0", temaId: "t3", tipo: "estudiado", fecha: "2026-09-01" },
  { id: "e1", temaId: "t3", tipo: "repaso", numeroRepaso: 1, fecha: "2026-09-02" },
  { id: "e2", temaId: "t3", tipo: "repaso", numeroRepaso: 2, fecha: "2026-09-06" },
  { id: "x0", temaId: "t4", tipo: "estudiado", fecha: "2026-09-10" },
];

let contador = 0;
const nuevoId = () => `n${++contador}`;

describe("cambiar la fecha de un hito", () => {
  it("mueve el repaso 1 dentro de su hueco", () => {
    const r = cambiarFechaHito(eventos, "t3", 1, "2026-09-04", HOY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventos.find((e) => e.id === "e1")?.fecha).toBe("2026-09-04");
  });

  it("no deja poner un repaso antes del hito anterior", () => {
    const r = cambiarFechaHito(eventos, "t3", 1, "2026-08-30", HOY);
    expect(r).toEqual({ ok: false, codigo: "antes-del-anterior" });
  });

  it("no deja pasar por delante del hito siguiente", () => {
    const r = cambiarFechaHito(eventos, "t3", 1, "2026-09-08", HOY);
    expect(r).toEqual({ ok: false, codigo: "despues-del-siguiente" });
  });

  it("no deja fechas futuras: es algo ya hecho", () => {
    const r = cambiarFechaHito(eventos, "t4", 0, "2026-10-01", HOY);
    expect(r).toEqual({ ok: false, codigo: "en-el-futuro" });
  });

  it("los límites del último hito llegan hasta hoy", () => {
    expect(limitesDeFecha(eventos, "t3", 2, HOY)).toEqual({ min: "2026-09-02", max: HOY });
  });

  it("se puede cambiar tantas veces como se quiera", () => {
    let actuales = eventos;
    for (const fecha of ["2026-09-03", "2026-09-05", "2026-09-02"]) {
      const r = cambiarFechaHito(actuales, "t3", 1, fecha, HOY);
      expect(r.ok).toBe(true);
      if (r.ok) actuales = r.eventos;
    }
    expect(actuales.find((e) => e.id === "e1")?.fecha).toBe("2026-09-02");
  });
});

describe("desmarcar", () => {
  it("quita el hito y los posteriores, que dependen de él", () => {
    expect(hitosQueSeQuitan(eventos, "t3", 1).map((h) => h.evento.id)).toEqual(["e1", "e2"]);
    const quedan = desmarcarHito(eventos, "t3", 1);
    expect(quedan.map((e) => e.id)).toEqual(["e0", "x0"]);
  });

  it("desmarcar el último solo quita ese", () => {
    expect(desmarcarHito(eventos, "t3", 2).map((e) => e.id)).toEqual(["e0", "e1", "x0"]);
  });

  it("no toca otros temas", () => {
    expect(desmarcarHito(eventos, "t4", 0).map((e) => e.id)).toEqual(["e0", "e1", "e2"]);
  });
});

describe("marcar con fecha", () => {
  it("marca el siguiente repaso en un día pasado", () => {
    const r = marcarSiguienteHito(eventos, "t3", "2026-09-20", { hoy: HOY, totalRepasos: 5, nuevoId });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const nuevo = r.eventos.at(-1)!;
      expect(nuevo).toMatchObject({ tipo: "repaso", numeroRepaso: 3, fecha: "2026-09-20" });
    }
  });

  it("un tema sin empezar se marca como estudiado", () => {
    const r = marcarSiguienteHito(eventos, "t9", HOY, { hoy: HOY, totalRepasos: 5, nuevoId });
    expect(r.ok && r.eventos.at(-1)?.tipo).toBe("estudiado");
  });

  it("no deja marcar antes del hito anterior ni en el futuro", () => {
    expect(
      marcarSiguienteHito(eventos, "t3", "2026-09-01", { hoy: HOY, totalRepasos: 5, nuevoId }),
    ).toEqual({ ok: false, codigo: "antes-del-anterior" });
    expect(
      marcarSiguienteHito(eventos, "t3", "2026-12-01", { hoy: HOY, totalRepasos: 5, nuevoId }),
    ).toEqual({ ok: false, codigo: "en-el-futuro" });
  });

  it("con la vuelta completa no hay más que marcar", () => {
    expect(
      marcarSiguienteHito(eventos, "t3", HOY, { hoy: HOY, totalRepasos: 2, nuevoId }),
    ).toEqual({ ok: false, codigo: "vuelta-completa" });
  });
});

describe("estado del tema", () => {
  it("se deduce de los hitos", () => {
    expect(estadoEstudioDe(eventos, "t9", 5)).toBe("por_estudiar");
    expect(estadoEstudioDe(eventos, "t4", 5)).toBe("estudiado");
    expect(estadoEstudioDe(eventos, "t3", 5)).toBe("en_repaso");
    expect(estadoEstudioDe(eventos, "t3", 2)).toBe("dominado");
  });
});

describe("apartados de un hito", () => {
  it("marcar solo unos apartados los guarda en el hito; sin ellos es el tema entero", () => {
    let n = 0;
    const r = marcarSiguienteHito([], "t1", "2026-10-01", {
      hoy: "2026-10-05",
      totalRepasos: 5,
      nuevoId: () => `id${++n}`,
      apartados: ["1.1", "2"],
    });
    expect(r.ok && r.eventos[0].apartados).toEqual(["1.1", "2"]);
    const entero = marcarSiguienteHito([], "t1", "2026-10-01", { hoy: "2026-10-05", totalRepasos: 5, nuevoId: () => "x" });
    expect(entero.ok && "apartados" in entero.eventos[0]).toBe(false);
  });

  it("se pueden cambiar después, y vaciarlos vuelve al tema entero", () => {
    const eventos = [{ id: "e", temaId: "t1", tipo: "estudiado" as const, fecha: "2026-10-01" }];
    const con = apartadosDeHito(eventos, "t1", 0, ["3"]);
    expect(con[0].apartados).toEqual(["3"]);
    expect(apartadosDeHito(con, "t1", 0, [])[0].apartados).toBeUndefined();
    expect(apartadosDeHito(eventos, "t1", 4, ["3"])).toBe(eventos);
  });
});
