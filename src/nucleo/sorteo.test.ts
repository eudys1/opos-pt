import { describe, expect, it } from "vitest";
import {
  distanciaEntre,
  probabilidadDeDominado,
  sortearSupuestos,
  sortearTemas,
  type SupuestoSorteable,
  type TemaSorteable,
} from "./sorteo";

/** Azar previsible: recorre la lista de valores en bucle. */
function azarDe(valores: number[]) {
  let i = 0;
  return () => valores[i++ % valores.length];
}

const temas: TemaSorteable[] = Array.from({ length: 10 }, (_, i) => ({
  id: `t${i + 1}`,
  numero: i + 1,
  titulo: `Tema ${i + 1}`,
  dominio: i < 5 ? 0.9 : 0.1,
}));

describe("sortearTemas", () => {
  it("saca tantos como se le pidan y sin repetir", () => {
    const sorteados = sortearTemas(temas, 2, { azar: azarDe([0.1, 0.7, 0.3]) });
    expect(sorteados).toHaveLength(2);
    expect(new Set(sorteados.map((t) => t.id)).size).toBe(2);
  });

  it("no inventa temas cuando hay menos de los pedidos", () => {
    expect(sortearTemas(temas.slice(0, 1), 2)).toHaveLength(1);
  });

  it("en modo trampa salen sobre todo los temas flojos", () => {
    let flojos = 0;
    for (let i = 0; i < 200; i += 1) {
      const sorteados = sortearTemas(temas, 2, { trampa: true });
      flojos += sorteados.filter((t) => (t.dominio ?? 0) < 0.5).length;
    }
    // Sin trampa saldría la mitad; con trampa tiene que ser bastante más.
    expect(flojos / 400).toBeGreaterThan(0.65);
  });

  it("sin trampa el sorteo no favorece a nadie", () => {
    let flojos = 0;
    for (let i = 0; i < 400; i += 1) {
      const sorteados = sortearTemas(temas, 2);
      flojos += sorteados.filter((t) => (t.dominio ?? 0) < 0.5).length;
    }
    expect(flojos / 800).toBeGreaterThan(0.4);
    expect(flojos / 800).toBeLessThan(0.6);
  });
});

describe("sortearSupuestos", () => {
  const supuestos: SupuestoSorteable[] = [
    { id: "a", titulo: "TEA 1", necesidad: "TEA", curso: "3.º Primaria", temas: [23] },
    { id: "b", titulo: "TEA 2", necesidad: "TEA", curso: "3.º Primaria", temas: [23] },
    { id: "c", titulo: "TDAH", necesidad: "TDAH", curso: "5.º Primaria", temas: [22] },
    { id: "d", titulo: "Auditiva", necesidad: "Discapacidad auditiva", curso: "1.º Primaria", temas: [14] },
  ];

  it("saca tres distintos", () => {
    const sorteados = sortearSupuestos(supuestos, 3, { azar: azarDe([0, 0.5, 0.2, 0.9]) });
    expect(sorteados).toHaveLength(3);
    expect(new Set(sorteados.map((s) => s.id)).size).toBe(3);
  });

  it("evita que salgan dos casi iguales si hay alternativas", () => {
    // Empezando por el primer TEA, el segundo no debería colarse teniendo TDAH
    // y auditiva disponibles.
    const sorteados = sortearSupuestos(supuestos, 3, { azar: () => 0 });
    const ids = sorteados.map((s) => s.id).sort();
    expect(ids).toEqual(["a", "c", "d"]);
  });

  it("devuelve todo lo que hay si hay menos de los pedidos", () => {
    expect(sortearSupuestos(supuestos.slice(0, 2), 3)).toHaveLength(2);
  });
});

describe("distanciaEntre", () => {
  it("dos casos iguales están a distancia cero", () => {
    const uno = { id: "a", titulo: "x", necesidad: "TEA", curso: "3.º", temas: [23] };
    expect(distanciaEntre(uno, { ...uno, id: "b" })).toBe(0);
  });

  it("cambiar la necesidad separa más que cambiar el curso", () => {
    const base = { id: "a", titulo: "x", necesidad: "TEA", curso: "3.º", temas: [23] };
    const otraNecesidad = { ...base, id: "b", necesidad: "TDAH" };
    const otroCurso = { ...base, id: "c", curso: "5.º" };
    expect(distanciaEntre(base, otraNecesidad)).toBeGreaterThan(distanciaEntre(base, otroCurso));
  });
});

describe("probabilidadDeDominado", () => {
  it("con 12 estudiados y 12 dominados, seguro", () => {
    expect(probabilidadDeDominado(12, 12, 2)).toBe(1);
  });

  it("sin ninguno dominado, imposible", () => {
    expect(probabilidadDeDominado(12, 0, 2)).toBe(0);
  });

  it("calcula el caso intermedio", () => {
    // 12 estudiados, 6 dominados, 2 bolas: 1 - C(6,2)/C(12,2) = 1 - 15/66.
    expect(probabilidadDeDominado(12, 6, 2)).toBeCloseTo(0.773, 2);
  });

  it("no se rompe sin temas", () => {
    expect(probabilidadDeDominado(0, 0, 2)).toBe(0);
  });
});
