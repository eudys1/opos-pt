import { SECCIONES } from "@/components/ui/secciones";
import type { EntradaAgenda } from "@/nucleo/agenda";
import type { Tema } from "@/nucleo/tipos";
import { resumenDeApartados } from "@/components/selector-apartados";

/**
 * Cómo se lee una entrada de la agenda: "Repaso 2 · tema 4", "Practicar ·
 * tema 3" o el texto del objetivo. Lo usan el planificador y el calendario de
 * Mi progreso, para que la misma cosa se llame igual en los dos sitios.
 */
export function textoDeEntrada(e: EntradaAgenda, temas: Tema[]): string {
  const tema = temas.find((t) => t.id === e.temaId);
  // Si es solo de unos apartados, se dice cuáles: "Repaso 2 · tema 3 · 1.1, 2".
  const parte = tema ? resumenDeApartados(tema.texto, e.apartados) : "";
  const deTema = tema ? ` · tema ${tema.numero}${parte ? ` · ${parte}` : ""}` : "";
  if (e.origen === "objetivo") return `${e.texto ?? ""}${parte ? ` · ${parte}` : ""}`;
  if (e.origen === "hito" || e.origen === "previsto") {
    return `${e.indice === 0 ? "Estudiado" : `Repaso ${e.indice}`}${deTema}`;
  }
  return `${SECCIONES[e.tipo].nombre}${deTema}`;
}
