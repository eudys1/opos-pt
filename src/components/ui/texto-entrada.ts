import { SECCIONES } from "@/components/ui/secciones";
import type { EntradaAgenda } from "@/nucleo/agenda";
import type { Tema } from "@/nucleo/tipos";

/**
 * Cómo se lee una entrada de la agenda: "Repaso 2 · tema 4", "Practicar ·
 * tema 3" o el texto del objetivo. Lo usan el planificador y el calendario de
 * Mi progreso, para que la misma cosa se llame igual en los dos sitios.
 */
export function textoDeEntrada(e: EntradaAgenda, temas: Tema[]): string {
  const tema = temas.find((t) => t.id === e.temaId);
  const deTema = tema ? ` · tema ${tema.numero}` : "";
  if (e.origen === "objetivo") return e.texto ?? "";
  if (e.origen === "hito" || e.origen === "previsto") {
    return `${e.indice === 0 ? "Estudiado" : `Repaso ${e.indice}`}${deTema}`;
  }
  return `${SECCIONES[e.tipo].nombre}${deTema}`;
}
