import { describe, expect, it } from "vitest";
import { calcularRacha, diasParaExamen } from "./racha";
import type { EventoEstudio } from "./tipos";

function dias(fechas: string[]): EventoEstudio[] {
  return fechas.map((fecha, i) => ({ id: `e${i}`, temaId: "t1", tipo: "repaso", fecha }));
}

describe("calcularRacha", () => {
  it("es cero sin actividad", () => {
    expect(calcularRacha([], { hoy: "2026-09-20" }).dias).toBe(0);
  });

  it("cuenta días consecutivos terminando hoy", () => {
    const racha = calcularRacha(dias(["2026-09-18", "2026-09-19", "2026-09-20"]), {
      hoy: "2026-09-20",
    });
    expect(racha.dias).toBe(3);
    expect(racha.hoyPendiente).toBe(false);
  });

  it("no penaliza que hoy todavía no se haya estudiado", () => {
    const racha = calcularRacha(dias(["2026-09-18", "2026-09-19"]), { hoy: "2026-09-20" });
    expect(racha.dias).toBe(2);
    expect(racha.hoyPendiente).toBe(true);
    expect(racha.diasLibresUsados).toBe(0);
  });

  it("gasta un día libre en un hueco en vez de romper la racha", () => {
    // Falta el 18: se cubre con un día libre.
    const racha = calcularRacha(dias(["2026-09-16", "2026-09-17", "2026-09-19", "2026-09-20"]), {
      hoy: "2026-09-20",
      diasLibresAlMes: 2,
    });
    expect(racha.dias).toBe(4);
    expect(racha.diasLibresUsados).toBe(1);
    expect(racha.diasLibresRestantes).toBe(1);
  });

  it("corta la racha cuando se acaban los días libres", () => {
    // Huecos el 17 y el 15. Con un solo día libre se cubre el 17, y el 15 la corta:
    // quedan el 20, 19, 18 y 16.
    const racha = calcularRacha(dias(["2026-09-14", "2026-09-16", "2026-09-18", "2026-09-19", "2026-09-20"]), {
      hoy: "2026-09-20",
      diasLibresAlMes: 1,
    });
    expect(racha.dias).toBe(4);
    expect(racha.diasLibresRestantes).toBe(0);
  });

  it("no gasta días libres una vez que la racha ha terminado", () => {
    const racha = calcularRacha(dias(["2026-09-19", "2026-09-20"]), {
      hoy: "2026-09-20",
      diasLibresAlMes: 2,
    });
    expect(racha.dias).toBe(2);
    expect(racha.diasLibresUsados).toBe(0);
  });

  it("varios eventos el mismo día cuentan como un día", () => {
    const racha = calcularRacha(dias(["2026-09-20", "2026-09-20", "2026-09-19"]), {
      hoy: "2026-09-20",
    });
    expect(racha.dias).toBe(2);
  });
});

describe("diasParaExamen", () => {
  it("devuelve null sin fecha", () => {
    expect(diasParaExamen(undefined, "2026-09-20")).toBeNull();
  });

  it("cuenta días naturales y admite fechas pasadas", () => {
    expect(diasParaExamen("2026-09-30", "2026-09-20")).toBe(10);
    expect(diasParaExamen("2026-09-10", "2026-09-20")).toBe(-10);
  });
});
