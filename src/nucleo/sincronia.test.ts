import { describe, expect, it } from "vitest";
import { ganaLaLocal, huellaDeTema, marcaDeTiempo, type VersionTema } from "./sincronia";

const vacio = (actualizadoEn: string): VersionTema => ({
  texto: "",
  estadoContenido: "sin_contenido",
  estadoEstudio: "por_estudiar",
  actualizadoEn,
});
const conTexto = (actualizadoEn: string, texto = "Tema 3: la evaluación psicopedagógica…"): VersionTema => ({
  texto,
  estadoContenido: "completo",
  estadoEstudio: "por_estudiar",
  actualizadoEn,
});

describe("qué versión de un tema gana", () => {
  it("el caso que borró los temas 3 y 4: un navegador nuevo, vacío y con fecha de hoy, NO gana", () => {
    expect(ganaLaLocal(vacio("2026-09-27"), conTexto("2026-09-26T10:00:00Z"))).toBe(false);
    // Tampoco si el vacío tiene la hora exacta de ahora.
    expect(ganaLaLocal(vacio("2026-09-27T17:40:00Z"), conTexto("2026-09-26T10:00:00Z"))).toBe(false);
  });

  it("un tema con texto no se deja pisar por uno vacío, aunque el vacío sea más nuevo", () => {
    expect(ganaLaLocal(conTexto("2026-09-26"), vacio("2026-09-27T17:40:29Z"))).toBe(true);
  });

  it("si los dos tienen texto, gana el más reciente con la hora exacta", () => {
    const manana = conTexto("2026-09-27T09:00:00Z", "versión de la mañana");
    const tarde = conTexto("2026-09-27T18:00:00Z", "versión de la tarde");
    expect(ganaLaLocal(tarde, manana)).toBe(true);
    expect(ganaLaLocal(manana, tarde)).toBe(false);
  });

  it("en empate gana la cuenta", () => {
    expect(ganaLaLocal(conTexto("2026-09-27T09:00:00Z"), conTexto("2026-09-27T09:00:00Z"))).toBe(false);
  });

  it("si la cuenta no tiene el tema, gana el navegador", () => {
    expect(ganaLaLocal(vacio(""))).toBe(true);
  });

  it("un tema estudiado sin texto también cuenta como algo que no se puede perder", () => {
    const estudiado: VersionTema = { ...vacio("2026-09-20"), estadoEstudio: "estudiado" };
    expect(ganaLaLocal(vacio("2026-09-27"), estudiado)).toBe(false);
  });

  it("entiende las fechas antiguas de solo día", () => {
    expect(marcaDeTiempo("2026-09-26")).toBe(Date.parse("2026-09-26T00:00:00Z"));
    expect(marcaDeTiempo("")).toBe(0);
  });

  it("la huella cambia solo si cambia algo que importa", () => {
    const t = { titulo: "T", texto: "a", estadoContenido: "completo", estadoEstudio: "estudiado", vueltas: 0 };
    expect(huellaDeTema(t)).toBe(huellaDeTema({ ...t }));
    expect(huellaDeTema(t)).not.toBe(huellaDeTema({ ...t, texto: "b" }));
  });
});
