import { describe, expect, it } from "vitest";
import {
  ACIERTOS_PARA_SUPERAR,
  colaDelDia,
  registrarFallo,
  resumenFallos,
  trasResponder,
  type Fallo,
} from "./fallos";

const HOY = "2026-09-20";

function falloDe(parcial: Partial<Fallo> = {}): Fallo {
  return {
    itemId: "i1",
    temaId: "t1",
    proximaFecha: HOY,
    aciertosSeguidos: 0,
    vecesFallado: 1,
    ...parcial,
  };
}

describe("registrarFallo", () => {
  it("programa el primer repaso para mañana", () => {
    const fallo = registrarFallo(undefined, { itemId: "i1", temaId: "t1" }, HOY);
    expect(fallo.proximaFecha).toBe("2026-09-21");
    expect(fallo.vecesFallado).toBe(1);
  });

  it("reabre uno superado y suma una vez más fallado", () => {
    const previo = falloDe({ vecesFallado: 2, resueltoEn: "2026-09-01", aciertosSeguidos: 3 });
    const fallo = registrarFallo(previo, { itemId: "i1", temaId: "t1" }, HOY);
    expect(fallo.vecesFallado).toBe(3);
    expect(fallo.aciertosSeguidos).toBe(0);
    expect(fallo.resueltoEn).toBeUndefined();
  });
});

describe("trasResponder", () => {
  it("espacia cada vez más con los aciertos seguidos", () => {
    let fallo = falloDe();
    fallo = trasResponder(fallo, true, HOY);
    expect(fallo.proximaFecha).toBe("2026-09-23"); // +3
    fallo = trasResponder(fallo, true, "2026-09-23");
    expect(fallo.proximaFecha).toBe("2026-09-30"); // +7
  });

  it("se da por superado a los tres aciertos seguidos", () => {
    let fallo = falloDe();
    for (let i = 0; i < ACIERTOS_PARA_SUPERAR; i += 1) {
      fallo = trasResponder(fallo, true, HOY);
    }
    expect(fallo.resueltoEn).toBe(HOY);
    expect(fallo.aciertosSeguidos).toBe(3);
  });

  it("un fallo lo devuelve al principio", () => {
    let fallo = falloDe({ aciertosSeguidos: 2 });
    fallo = trasResponder(fallo, false, HOY);
    expect(fallo.aciertosSeguidos).toBe(0);
    expect(fallo.proximaFecha).toBe("2026-09-21");
    expect(fallo.vecesFallado).toBe(2);
  });

  it("volver a fallar uno superado lo reabre", () => {
    const superado = falloDe({ aciertosSeguidos: 3, resueltoEn: "2026-09-10" });
    const reabierto = trasResponder(superado, false, HOY);
    expect(reabierto.resueltoEn).toBeUndefined();
  });
});

describe("colaDelDia", () => {
  it("saca lo vencido y lo de hoy, lo más antiguo primero", () => {
    const fallos = [
      falloDe({ itemId: "hoy", proximaFecha: HOY }),
      falloDe({ itemId: "manana", proximaFecha: "2026-09-21" }),
      falloDe({ itemId: "atrasado", proximaFecha: "2026-09-15" }),
      falloDe({ itemId: "superado", proximaFecha: "2026-09-01", resueltoEn: "2026-09-02" }),
    ];
    expect(colaDelDia(fallos, HOY).map((f) => f.itemId)).toEqual(["atrasado", "hoy"]);
  });
});

describe("resumenFallos", () => {
  it("cuenta abiertos, superados y los que tocan hoy", () => {
    const fallos = [
      falloDe({ itemId: "a", proximaFecha: HOY }),
      falloDe({ itemId: "b", proximaFecha: "2026-10-01" }),
      falloDe({ itemId: "c", resueltoEn: "2026-09-05" }),
    ];
    expect(resumenFallos(fallos, HOY)).toEqual({ abiertos: 2, superados: 1, tocanHoy: 1 });
  });
});
