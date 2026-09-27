import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODELOS, calcularUso, type Uso } from "./cliente";
import { esUtilizable, type ItemGenerado } from "./generar-banco";

/**
 * Variantes de una pregunta fallada: preguntan lo mismo de otra forma.
 *
 * Si un fallo vuelve siempre con la misma frase, se acaba memorizando la
 * respuesta a esa frase y no el contenido. Las variantes se crean UNA vez por
 * pregunta, con el modelo barato, y se guardan: repasar después no gasta nada.
 *
 * Mismas reglas que el banco: nada fuera de la cita de los apuntes.
 */

const Variante = z.object({
  itemId: z.string(),
  enunciado: z.string(),
  opciones: z.array(z.string()),
  correcta: z.number(),
  respuesta: z.string(),
  explicacion: z.string(),
  pide: z.string(),
});

const Salida = z.object({ variantes: z.array(Variante) });

export type ItemOriginal = {
  id: string;
  tipo: "test" | "corta" | "flashcard";
  enunciado: string;
  opciones: string[] | null;
  correcta: number | null;
  respuesta: string | null;
  cita: string;
  pide: string | null;
};

const INSTRUCCIONES = `Preparas oposiciones de Maestro de Pedagogía Terapéutica. Te paso preguntas que la persona ha FALLADO, cada una con la cita literal de sus apuntes de la que sale. Para cada una escribe DOS variantes que comprueben el mismo conocimiento de otra manera, para que al repasar no reconozca la frase y conteste de memoria.

Reglas:
- La respuesta correcta sale SOLO de la cita. No añadas datos, normas ni autores que no estén en ella.
- Cambia de verdad el ángulo, no solo el orden de las palabras: pregunta al revés, desde un caso, por la consecuencia, por quién o cuándo…
- Mismo tipo que la original.
  - "test": cuatro opciones nuevas, solo una correcta; "correcta" es su índice (0-3); "respuesta" vacío.
  - "corta": pregunta nueva; "respuesta" es la respuesta modelo en dos o tres frases; "opciones" vacío y "correcta" -1.
  - "flashcard": el enunciado es una pregunta completa que dice qué hay que contestar; en "pide", en dos o tres palabras, qué se pide ("Definición", "Quién la realiza"…); "opciones" vacío y "correcta" -1.
- "itemId" es el id de la pregunta original, copiado tal cual.
- "explicacion": una frase sobre el porqué, sin salirte de la cita.
- En test y cortas, "pide" va vacío.
- Español de España.`;

export async function crearVariantes(
  ia: Anthropic,
  items: ItemOriginal[],
): Promise<{ variantes: (ItemGenerado & { itemId: string })[]; uso: Uso }> {
  const respuesta = await ia.messages.parse({
    model: MODELOS.correccion,
    max_tokens: 8000,
    system: INSTRUCCIONES,
    output_config: { format: zodOutputFormat(Salida) },
    messages: [
      {
        role: "user",
        content: items
          .map(
            (i) =>
              `--- itemId: ${i.id} · tipo: ${i.tipo}\nPregunta: ${i.enunciado}\n${
                i.tipo === "test" && i.opciones
                  ? `Opciones: ${i.opciones.join(" | ")} (correcta: ${i.correcta})\n`
                  : `Respuesta: ${i.respuesta ?? ""}\n`
              }Cita de los apuntes: «${i.cita}»`,
          )
          .join("\n\n"),
      },
    ],
  });

  if (respuesta.stop_reason === "refusal") {
    throw new Error("La API ha rechazado crear variantes de estas preguntas.");
  }

  const porId = new Map(items.map((i) => [i.id, i]));
  const variantes = (respuesta.parsed_output?.variantes ?? [])
    .map((v) => {
      const original = porId.get(v.itemId);
      if (!original) return null;
      // Heredan tipo y cita de la original: la cita es lo que ancla a los apuntes.
      const item: ItemGenerado & { itemId: string } = {
        ...v,
        tipo: original.tipo,
        cita: original.cita,
      };
      return esUtilizable(item, original.cita) ? item : null;
    })
    .filter((v): v is ItemGenerado & { itemId: string } => v !== null);

  return { variantes, uso: calcularUso(MODELOS.correccion, respuesta.usage) };
}
