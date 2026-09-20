import { describe, expect, it } from "vitest";
import { esUtilizable, type ItemGenerado } from "./generar-banco";

const TEXTO = `## TEMA 2
La Ley Orgánica 1/1990, de 3 de octubre, de Ordenación General del Sistema Educativo
supone un cambio de modelo. Un alumno tiene necesidades educativas especiales cuando
precisa ayudas o recursos que no son los habituales.`;

function item(parcial: Partial<ItemGenerado> = {}): ItemGenerado {
  return {
    tipo: "corta",
    enunciado: "¿Cuándo tiene un alumno necesidades educativas especiales?",
    opciones: [],
    correcta: -1,
    respuesta: "Cuando precisa ayudas o recursos que no son los habituales.",
    explicacion: "Es la definición que recogen los apuntes.",
    cita: "Un alumno tiene necesidades educativas especiales cuando precisa ayudas o recursos",
    ...parcial,
  };
}

describe("esUtilizable", () => {
  it("acepta una pregunta cuya cita está en los apuntes", () => {
    expect(esUtilizable(item(), TEXTO)).toBe(true);
  });

  it("acepta la cita aunque cambien tildes, mayúsculas o saltos de línea", () => {
    const conRuido = item({
      cita: "La  LEY Organica 1/1990,\nde 3 de octubre, de Ordenacion General",
    });
    expect(esUtilizable(conRuido, TEXTO)).toBe(true);
  });

  it("descarta una pregunta con una cita inventada", () => {
    const inventada = item({
      cita: "La LOMLOE de 2020 regula la atención a la diversidad en Andalucía",
    });
    expect(esUtilizable(inventada, TEXTO)).toBe(false);
  });

  it("descarta citas demasiado cortas para comprobar nada", () => {
    expect(esUtilizable(item({ cita: "alumno" }), TEXTO)).toBe(false);
  });

  it("exige cuatro opciones distintas en las de test", () => {
    const base: Partial<ItemGenerado> = {
      tipo: "test",
      respuesta: "",
      correcta: 1,
      opciones: ["a", "b", "c", "d"],
    };
    expect(esUtilizable(item(base), TEXTO)).toBe(true);
    expect(esUtilizable(item({ ...base, opciones: ["a", "b", "c"] }), TEXTO)).toBe(false);
    expect(esUtilizable(item({ ...base, opciones: ["a", "a", "c", "d"] }), TEXTO)).toBe(false);
    expect(esUtilizable(item({ ...base, correcta: 7 }), TEXTO)).toBe(false);
  });

  it("exige respuesta modelo en las que no son de test", () => {
    expect(esUtilizable(item({ respuesta: "  " }), TEXTO)).toBe(false);
  });
});
