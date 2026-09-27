import { describe, expect, it } from "vitest";
import { leerReloj, segundosDePausa } from "./reloj";

const INICIO = "2026-09-27T10:00:00.000Z";
const t = (minutos: number) => new Date(INICIO).getTime() + minutos * 60_000;

describe("reloj del simulacro", () => {
  it("real: cuenta desde el inicio sin más", () => {
    const l = leerReloj({ iniciadoEn: INICIO, duracionS: 3600, pausadoTotalS: 0 }, t(20));
    expect(l).toEqual({ transcurridoS: 1200, restanteS: 2400, enPausa: false, agotado: false });
  });

  it("flexible en pausa: el tiempo se congela", () => {
    const reloj = {
      iniciadoEn: INICIO,
      duracionS: 3600,
      pausadoTotalS: 0,
      pausadoEn: new Date(t(20)).toISOString(),
    };
    expect(leerReloj(reloj, t(25)).transcurridoS).toBe(1200);
    expect(leerReloj(reloj, t(90)).transcurridoS).toBe(1200);
    expect(leerReloj(reloj, t(90)).enPausa).toBe(true);
  });

  it("flexible reanudado: descuenta lo pausado", () => {
    const pausa = segundosDePausa(new Date(t(20)).toISOString(), t(30));
    expect(pausa).toBe(600);
    const l = leerReloj({ iniciadoEn: INICIO, duracionS: 3600, pausadoTotalS: pausa }, t(40));
    expect(l.transcurridoS).toBe(1800);
  });

  it("se agota y no baja de cero", () => {
    const l = leerReloj({ iniciadoEn: INICIO, duracionS: 600, pausadoTotalS: 0 }, t(30));
    expect(l).toMatchObject({ restanteS: 0, agotado: true });
  });
});
