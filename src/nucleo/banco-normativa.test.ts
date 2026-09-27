import { describe, expect, it } from "vitest";
import { bancoDeNormativa, documentoDeNormativa, normasQueFaltan } from "./normas";

const TEMA_3 = `INTRODUCCIÓN
Es por ello que la Ley Orgánica 3/2020, de 29 de diciembre, establece la equidad.
Por otro lado, destacamos las Instrucciones de 8 de marzo de 2017 de la dirección general de participación y equidad.

5.1 REFERENCIAS NORMATIVAS
Ley Orgánica 3/2020, de 29 de diciembre, por la que se modifica la Ley Orgánica 2/2006, de 3 de mayo, de Educación.
Instrucciones de 8 de marzo de 2017 de la Dirección General de Participación y Equidad, por las que se actualiza el protocolo de detección.`;

const TEMA_4 = `Según el Decreto 147/2002, de 14 de mayo, por el que se establece la ordenación de la atención educativa.
También la Ley Orgánica 3/2020, de 29 de diciembre, lo recoge.`;

const temas = [
  { numero: 3, texto: TEMA_3 },
  { numero: 4, texto: TEMA_4 },
];

describe("banco de normativa", () => {
  const banco = bancoDeNormativa(temas);

  it("cada norma sale una sola vez, con todos los temas en que aparece", () => {
    const lomloe = banco.filter((e) => e.nombre === "Ley Orgánica 3/2020");
    expect(lomloe).toHaveLength(1);
    expect(lomloe[0].temas).toEqual([3, 4]);
  });

  it("se queda la cita más completa, tal cual está escrita", () => {
    const lomloe = banco.find((e) => e.nombre === "Ley Orgánica 3/2020")!;
    expect(lomloe.cita).toBe(
      "Ley Orgánica 3/2020, de 29 de diciembre, por la que se modifica la Ley Orgánica 2/2006, de 3 de mayo, de Educación.",
    );
  });

  it("agrupa por tipo de norma, de más a menos rango", () => {
    expect(banco.map((e) => e.grupo)).toEqual(
      [...banco.map((e) => e.grupo)].sort(
        (a, b) =>
          ["Leyes orgánicas", "Leyes", "Reales decretos", "Decretos", "Órdenes", "Instrucciones", "Otras"].indexOf(a) -
          ["Leyes orgánicas", "Leyes", "Reales decretos", "Decretos", "Órdenes", "Instrucciones", "Otras"].indexOf(b),
      ),
    );
    expect(banco[0].grupo).toBe("Leyes orgánicas");
  });

  it("el documento lista cada norma una vez y dice de qué temas sale", () => {
    const doc = documentoDeNormativa(banco);
    expect(doc.match(/Ley Orgánica 3\/2020, de 29/g)).toHaveLength(1);
    expect(doc).toContain("[temas 3, 4]");
    expect(doc).toContain("DECRETOS");
  });

  it("detecta las que faltan en un documento ya editado, sin tocar lo demás", () => {
    const editado = "Mis notas\n- Ley Orgánica 3/2020, la LOMLOE, la más importante.";
    const faltan = normasQueFaltan(editado, banco).map((e) => e.nombre);
    expect(faltan).not.toContain("Ley Orgánica 3/2020");
    expect(faltan).toContain("Decreto 147/2002");
  });
});
