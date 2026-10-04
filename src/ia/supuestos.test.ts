import { describe, expect, it } from "vitest";
import { conConsigna, normalizarPesos, notaPonderada, type SupuestoGenerado } from "./supuestos";
import { CONSIGNA_ANDALUCIA } from "../contenido/supuestos";

function supuesto(pesos: number[]): SupuestoGenerado {
  return {
    titulo: "Caso de prueba",
    enunciado: "Enunciado",
    necesidad: "TEA",
    curso: "3.º de Primaria",
    temas: [23],
    rubrica: pesos.map((peso, i) => ({
      criterio: `Criterio ${i + 1}`,
      peso,
      queSeEspera: "Lo que se espera",
    })),
    solucion: "Solución",
  };
}

describe("normalizarPesos", () => {
  it("deja en paz una rúbrica que ya suma 100", () => {
    const pesos = normalizarPesos(supuesto([40, 30, 20, 10])).rubrica.map((r) => r.peso);
    expect(pesos).toEqual([40, 30, 20, 10]);
  });

  it("reparte hasta 100 cuando la IA se queda corta o se pasa", () => {
    for (const entrada of [[50, 30, 10], [60, 50, 40], [33, 33, 33]]) {
      const rubrica = normalizarPesos(supuesto(entrada)).rubrica;
      expect(rubrica.reduce((s, r) => s + r.peso, 0)).toBe(100);
    }
  });

  it("no se rompe con una rúbrica vacía", () => {
    expect(normalizarPesos(supuesto([])).rubrica).toEqual([]);
  });
});

describe("conConsigna", () => {
  it("pone la consigna oficial al final, una sola vez", () => {
    const texto = conConsigna("Trabaja usted en un CEIP de dos líneas.");
    expect(texto.startsWith("Trabaja usted en un CEIP de dos líneas.\n\n")).toBe(true);
    expect(texto.endsWith(CONSIGNA_ANDALUCIA)).toBe(true);
  });

  it("si la IA ya la escribió (aunque sea distinta), la cambia por la buena", () => {
    const texto = conConsigna("Caso.\n\nCON TODO LO EXPRESADO PLANTEE UNA INTERVENCION razonada como sea.");
    expect(texto).toBe(`Caso.\n\n${CONSIGNA_ANDALUCIA}`);
  });
});

describe("notaPonderada", () => {
  it("pondera por el peso de cada criterio", () => {
    const rubrica = [
      { criterio: "Normativa", peso: 50 },
      { criterio: "Medidas", peso: 50 },
    ];
    expect(notaPonderada([{ criterio: "Normativa", nota: 8 }, { criterio: "Medidas", nota: 6 }], rubrica)).toBe(7);
  });

  it("da más peso al criterio que más pesa", () => {
    const rubrica = [
      { criterio: "Medidas", peso: 80 },
      { criterio: "Fuentes", peso: 20 },
    ];
    expect(notaPonderada([{ criterio: "Medidas", nota: 9 }, { criterio: "Fuentes", nota: 4 }], rubrica)).toBe(8);
  });

  it("ignora criterios que no están en la rúbrica", () => {
    const rubrica = [{ criterio: "Medidas", peso: 100 }];
    expect(notaPonderada([{ criterio: "Medidas", nota: 7 }, { criterio: "Inventado", nota: 0 }], rubrica)).toBe(7);
  });

  it("devuelve 0 si no hay nada que ponderar", () => {
    expect(notaPonderada([], [])).toBe(0);
  });
});
