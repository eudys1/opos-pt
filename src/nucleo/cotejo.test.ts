import { describe, expect, it } from "vitest";
import { cotejarLiteral } from "./cotejo";

const ORIGINAL =
  "Decreto 147/2002, de 14 de mayo, por el que se establece la ordenación de la atención educativa a los alumnos y alumnas con necesidades educativas especiales asociadas a sus capacidades personales.";

describe("cotejo literal", () => {
  it("copiado tal cual es literal, aunque cambien mayúsculas, tildes y puntuación", () => {
    const escrito =
      "decreto 147/2002 de 14 de mayo por el que se establece la ordenacion de la atencion educativa a los alumnos y alumnas con necesidades educativas especiales asociadas a sus capacidades personales";
    const c = cotejarLiteral(escrito, ORIGINAL);
    expect(c.porcentaje).toBe(100);
    expect(c.veredicto).toBe("literal");
    expect(c.acierto).toBe(true);
  });

  it("una cifra mal hace que no sea literal, aunque el resto esté perfecto", () => {
    const escrito = ORIGINAL.replace("147/2002", "147/2003");
    const c = cotejarLiteral(escrito, ORIGINAL);
    expect(c.porcentaje).toBeGreaterThan(90);
    expect(c.datosQueFaltan).toEqual(["147/2002,"]);
    expect(c.veredicto).not.toBe("literal");
    expect(c.acierto).toBe(false);
  });

  it("marca exactamente las palabras que faltan", () => {
    const escrito = "Decreto 147/2002, de 14 de mayo, por el que se establece la ordenación";
    const c = cotejarLiteral(escrito, ORIGINAL);
    const faltan = c.palabras.filter((p) => !p.recordada).map((p) => p.texto);
    expect(faltan[0]).toBe("de");
    expect(faltan).toContain("personales.");
    expect(c.veredicto).toBe("incompleto");
  });

  it("el orden importa", () => {
    const desordenado = ORIGINAL.split(" ").reverse().join(" ");
    expect(cotejarLiteral(desordenado, ORIGINAL).porcentaje).toBeLessThan(20);
  });

  it("una palabra de más no penaliza", () => {
    const escrito = ORIGINAL.replace("establece", "establece también");
    expect(cotejarLiteral(escrito, ORIGINAL).porcentaje).toBe(100);
  });

  it("vacío es cero, no un error", () => {
    expect(cotejarLiteral("", ORIGINAL).porcentaje).toBe(0);
    expect(cotejarLiteral("algo", "").porcentaje).toBe(0);
  });
});
