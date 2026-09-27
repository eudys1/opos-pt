import { describe, expect, it } from "vitest";
import { detectarNormas, normalizarNombre, seccionesDelDocumento } from "./normas";

describe("detectarNormas", () => {
  it("encuentra leyes, decretos y órdenes con su tema", () => {
    const normas = detectarNormas([
      {
        numero: 2,
        texto:
          "La Ley Orgánica 1/1990, de 3 de octubre, cambió el modelo. El Real Decreto 696/1995, de 28 de abril, desarrolla la ordenación.",
      },
      { numero: 5, texto: "En Andalucía rige el Decreto 147/2002, de 14 de mayo." },
    ]);

    const nombres = normas.map((n) => n.nombre);
    expect(nombres).toContain("Ley Orgánica 1/1990");
    expect(nombres).toContain("Real Decreto 696/1995");
    expect(nombres).toContain("Decreto 147/2002");
    expect(normas.find((n) => n.nombre === "Decreto 147/2002")?.temas).toEqual([5]);
  });

  it("agrupa la misma norma citada en varios temas", () => {
    const normas = detectarNormas([
      { numero: 1, texto: "Según la LOMLOE, la inclusión es un principio." },
      { numero: 4, texto: "La LOMLOE lo recoge en su artículo 74." },
    ]);
    const lomloe = normas.find((n) => n.nombre === "LOMLOE");
    expect(lomloe?.temas).toEqual([1, 4]);
  });

  it("reconoce las órdenes con fecha larga y con siglas", () => {
    const normas = detectarNormas([
      {
        numero: 3,
        texto: "La Orden de 25 de julio de 2008 y la Orden ECD/191/2012 regulan la materia.",
      },
    ]);
    const nombres = normas.map((n) => n.nombre);
    expect(nombres).toContain("Orden de 25 de julio de 2008");
    expect(nombres).toContain("Orden ECD/191/2012");
  });

  it("no se inventa normas donde no las hay", () => {
    expect(detectarNormas([{ numero: 1, texto: "Los alumnos con necesidades." }])).toEqual([]);
  });

  it("ordena por número de temas en los que aparece", () => {
    const normas = detectarNormas([
      { numero: 1, texto: "LOMLOE y Ley 39/2015, de 1 de octubre." },
      { numero: 2, texto: "LOMLOE otra vez." },
      { numero: 3, texto: "LOMLOE y van tres." },
    ]);
    expect(normas[0].nombre).toBe("LOMLOE");
  });
});

describe("normalizarNombre", () => {
  it("quita artículos, fechas y dobles espacios", () => {
    expect(normalizarNombre("la  LEY orgánica 2/2006, de 3 de Mayo")).toBe("Ley Orgánica 2/2006");
  });

  it("conserva las siglas en mayúsculas", () => {
    expect(normalizarNombre("LOMLOE")).toBe("LOMLOE");
  });

  it("mantiene la fecha cuando es lo único que identifica la orden", () => {
    expect(normalizarNombre("Orden de 14 de febrero de 1996, sobre evaluación")).toBe(
      "Orden de 14 de febrero de 1996",
    );
  });
});

describe("seccionesDelDocumento", () => {
  it("parte el documento por sus grupos en mayúsculas", () => {
    const secciones = seccionesDelDocumento(
      "BANCO DE NORMATIVA\nSacado de mis temas.\n\nLEYES ORGÁNICAS\n- Ley Orgánica 2/2006, de Educación  [tema 3]\n\nDECRETOS\n- Decreto 147/2002  [temas 3, 4]\n- Decreto 1/2021  [tema 4]\n",
    );
    expect(secciones.map((s) => s.titulo)).toEqual(["", "LEYES ORGÁNICAS", "DECRETOS"]);
    expect(secciones[0].lineas).toEqual(["BANCO DE NORMATIVA", "Sacado de mis temas."]);
    expect(secciones[2].lineas).toHaveLength(2);
  });

  it("respeta un grupo añadido a mano", () => {
    const secciones = seccionesDelDocumento("MIS NOTAS\n- Revisar la orden de 2024\n");
    expect(secciones).toEqual([{ titulo: "MIS NOTAS", lineas: ["- Revisar la orden de 2024"] }]);
  });
});
