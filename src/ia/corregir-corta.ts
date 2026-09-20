import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODELOS, calcularUso, type Uso } from "./cliente";

/**
 * Corrección de una respuesta corta contra la respuesta modelo del banco.
 *
 * Es la corrección barata y frecuente, así que va con el modelo pequeño y sin
 * florituras: qué está bien, qué falta, qué está mal y una frase de consejo.
 */

const Correccion = z.object({
  /** true solo si la respuesta cubre lo esencial de la respuesta modelo. */
  acierto: z.boolean(),
  /** De 0 a 10, orientativa. */
  nota: z.number(),
  bien: z.array(z.string()),
  falta: z.array(z.string()),
  errores: z.array(z.string()),
  consejo: z.string(),
});

export type CorreccionCorta = z.infer<typeof Correccion>;

const INSTRUCCIONES = `Corriges respuestas de una opositora al Cuerpo de Maestros, especialidad Pedagogía Terapéutica.

Te dan una pregunta, la respuesta modelo sacada de sus propios apuntes y lo que ella ha contestado. Devuelves la corrección.

Cómo corriges:
- Compara solo con la respuesta modelo y la cita de los apuntes. No metas contenido de fuera, aunque lo sepas.
- "acierto" es true si ha dicho lo esencial, aunque sea con otras palabras. Sinónimos y orden distinto no son errores.
- "bien": lo que ha acertado, en frases cortas. Vacío si no hay nada.
- "falta": lo que estaba en la respuesta modelo y no ha dicho.
- "errores": lo que ha dicho y contradice los apuntes. Vacío si no hay ninguno. No inventes errores para rellenar.
- "consejo": una sola frase, concreta y útil para la próxima vez.
- Tutea, sé directa y no adornes. Si está perfecta, dilo en una línea.`;

export async function corregirCorta(
  ia: Anthropic,
  datos: { enunciado: string; modelo: string; cita?: string | null; respuesta: string },
): Promise<{ correccion: CorreccionCorta; uso: Uso }> {
  const respuesta = await ia.messages.parse({
    model: MODELOS.correccion,
    max_tokens: 4000,
    system: INSTRUCCIONES,
    output_config: { format: zodOutputFormat(Correccion) },
    messages: [
      {
        role: "user",
        content: `PREGUNTA: ${datos.enunciado}

RESPUESTA MODELO: ${datos.modelo}
${datos.cita ? `\nCITA DE LOS APUNTES: ${datos.cita}` : ""}

LO QUE HA RESPONDIDO:
${datos.respuesta}`,
      },
    ],
  });

  const correccion = respuesta.parsed_output;
  if (!correccion) throw new Error("La corrección no ha llegado en el formato esperado.");

  return { correccion, uso: calcularUso(MODELOS.correccion, respuesta.usage) };
}
