import type Anthropic from "@anthropic-ai/sdk";
import { MODELOS, calcularUso, type Uso } from "./cliente";

/**
 * Lectura de apuntes: convierte una foto o un PDF en texto.
 *
 * Reglas del encargo, en este orden de importancia:
 *   1. No inventar. Lo ilegible se marca, no se completa.
 *   2. No resumir. Es una transcripción, no un resumen.
 *   3. Conservar la estructura (epígrafes, listas, leyes citadas), porque de ahí
 *      salen después las preguntas y las flashcards de legislación.
 */

const INSTRUCCIONES = `Eres un transcriptor de apuntes de oposición. Recibes fotos de apuntes escritos a mano o páginas de un PDF y devuelves su texto.

Reglas:
- Transcribe literalmente lo que hay escrito. No resumas, no reescribas y no mejores la redacción.
- No añadas nada que no esté en la página, ni introducciones, ni conclusiones, ni comentarios tuyos.
- Lo que no puedas leer con seguridad, márcalo como [ilegible]. Si dudas entre dos lecturas, escribe la más probable seguida de [?].
- Conserva la estructura: usa "## " para los epígrafes, "### " para los subepígrafes y guiones para las listas.
- Mantén tal cual los nombres de leyes, artículos, siglas y fechas. Son lo más importante del texto.
- Respeta subrayados y destacados del original poniendo **el texto en negrita**.
- Si la página está en blanco o no contiene apuntes, responde exactamente: [página sin contenido]
- Responde solo con la transcripción, sin ningún texto previo ni posterior.`;

export type ResultadoLectura = { texto: string; uso: Uso };

export async function leerApuntes(
  ia: Anthropic,
  archivo: { tipoMime: string; datos: string; nombre: string },
): Promise<ResultadoLectura> {
  const esPdf = archivo.tipoMime === "application/pdf";

  const contenido: Anthropic.ContentBlockParam[] = [
    esPdf
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: archivo.datos },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: archivo.tipoMime as "image/jpeg" | "image/png" | "image/webp",
            data: archivo.datos,
          },
        },
    {
      type: "text",
      text: esPdf
        ? "Transcribe todas las páginas de este documento, en orden y seguidas."
        : "Transcribe esta página de apuntes.",
    },
  ];

  // Se usa streaming porque una tanda de páginas puede dar una respuesta larga
  // y una petición normal se quedaría sin tiempo.
  const respuesta = await ia.messages
    .stream({
      model: MODELOS.lectura,
      max_tokens: 32000,
      system: INSTRUCCIONES,
      // Transcribir no requiere razonar: pensar aquí solo encarecería la lectura.
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: contenido }],
    })
    .finalMessage();

  if (respuesta.stop_reason === "refusal") {
    throw new Error(
      `La lectura de ${archivo.nombre} se ha rechazado por seguridad. Comprueba que la imagen son tus apuntes.`,
    );
  }

  const texto = respuesta.content
    .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === "text")
    .map((bloque) => bloque.text)
    .join("\n")
    .trim();

  if (respuesta.stop_reason === "max_tokens") {
    throw new Error(
      `${archivo.nombre} es demasiado largo para una sola lectura. Súbelo partido en menos páginas.`,
    );
  }

  return { texto, uso: calcularUso(MODELOS.lectura, respuesta.usage) };
}
