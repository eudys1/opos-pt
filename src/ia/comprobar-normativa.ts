import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODELOS, calcularUso, type Uso } from "./cliente";

/**
 * Comprobación de normativa: ¿siguen vigentes las leyes que citan tus apuntes?
 *
 * Usa la búsqueda web del propio modelo. Se pide JSON en el texto de la
 * respuesta en vez de salida estructurada porque conviven mal con las
 * herramientas de servidor, y se valida con Zod al recibirlo.
 */

const Hallazgo = z.object({
  nombre: z.string(),
  /** vigente | modificada | derogada | no_encontrada */
  estado: z.enum(["vigente", "modificada", "derogada", "no_encontrada"]),
  resumen: z.string(),
  enlace: z.string(),
});

const Respuesta = z.object({ hallazgos: z.array(Hallazgo) });

export type HallazgoNormativo = z.infer<typeof Hallazgo> & { temas: number[] };

const INSTRUCCIONES = `Compruebas si la normativa educativa que cita una opositora sigue vigente.

Para cada norma de la lista, busca en fuentes oficiales (BOE, BOJA, portales de las administraciones educativas) y determina:
- "vigente": sigue en vigor y sin cambios relevantes para oposiciones docentes.
- "modificada": sigue en vigor pero la han modificado; di brevemente qué cambió y cuándo.
- "derogada": ya no está en vigor; di qué norma la sustituye.
- "no_encontrada": no has podido confirmarlo. Úsalo sin reparos: es mejor que inventar.

Reglas:
- No afirmes nada que no hayas visto en una fuente. Si dudas, "no_encontrada".
- "resumen": una o dos frases en español, concretas. Nada de rellenar.
- "enlace": la URL oficial más útil (BOE o BOJA consolidado si existe). Cadena vacía si no tienes ninguna.
- Responde SOLO con un objeto JSON con esta forma, sin texto alrededor ni bloques de código:
{"hallazgos":[{"nombre":"...","estado":"vigente","resumen":"...","enlace":"https://..."}]}`;

export async function comprobarNormativa(
  ia: Anthropic,
  normas: { nombre: string; temas: number[] }[],
): Promise<{ hallazgos: HallazgoNormativo[]; uso: Uso }> {
  const lista = normas.map((n) => `- ${n.nombre}`).join("\n");

  const respuesta = await ia.messages.create({
    model: MODELOS.examen,
    max_tokens: 8000,
    system: INSTRUCCIONES,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 10 }],
    messages: [
      {
        role: "user",
        content: `Comprueba estas normas, citadas en un temario de oposición al Cuerpo de Maestros en Andalucía. Hoy es ${new Date().toLocaleDateString("es-ES")}.\n\n${lista}`,
      },
    ],
  });

  const texto = respuesta.content
    .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === "text")
    .map((bloque) => bloque.text)
    .join("\n");

  const hallazgos = extraerHallazgos(texto).map((h) => ({
    ...h,
    temas: normas.find((n) => n.nombre === h.nombre)?.temas ?? [],
  }));

  return { hallazgos, uso: calcularUso(MODELOS.examen, respuesta.usage) };
}

/** El modelo a veces envuelve el JSON en texto o en un bloque de código. */
export function extraerHallazgos(texto: string): z.infer<typeof Hallazgo>[] {
  const candidatos = [
    texto,
    texto.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/```[\s\S]*$/, ""),
    texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1),
  ];

  for (const candidato of candidatos) {
    if (!candidato.trim()) continue;
    try {
      const analizado = Respuesta.safeParse(JSON.parse(candidato));
      if (analizado.success) return analizado.data.hallazgos;
    } catch {
      // Se prueba con el siguiente candidato.
    }
  }
  return [];
}
