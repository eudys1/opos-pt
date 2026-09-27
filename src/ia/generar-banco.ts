import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODELOS, calcularUso, type Uso } from "./cliente";

/**
 * Banco de preguntas de un tema, sacado del texto del propio tema.
 *
 * La regla dura: todo tiene que poder comprobarse contra los apuntes. Cada
 * pregunta guarda la cita literal de la que sale; si una cita no aparece en el
 * texto, la pregunta se descarta antes de guardarla.
 */

const Item = z.object({
  tipo: z.enum(["test", "corta", "flashcard", "ley"]),
  enunciado: z.string(),
  /** Cuatro opciones en las de test; vacío en el resto. */
  opciones: z.array(z.string()),
  /** Índice de la opción correcta en las de test; -1 en el resto. */
  correcta: z.number(),
  /** Respuesta modelo para cortas, flashcards y leyes; vacío en las de test. */
  respuesta: z.string(),
  /**
   * Qué se pide en las flashcards y leyes, en dos o tres palabras: "Definición",
   * "Quién la realiza", "Cita literal"… Vacío en test y cortas.
   */
  pide: z.string(),
  explicacion: z.string(),
  /** Fragmento literal del tema del que sale la pregunta. */
  cita: z.string(),
});

const Banco = z.object({ items: z.array(Item) });

export type ItemGenerado = z.infer<typeof Item>;

const INSTRUCCIONES = `Eres un preparador de oposiciones al Cuerpo de Maestros, especialidad Pedagogía Terapéutica. A partir de los apuntes de un tema, escribes preguntas para que quien los ha escrito se examine a sí misma.

Reglas innegociables:
- Todo sale del texto que se te da. No añadas contenido, normativa, autores ni datos que no aparezcan en él, aunque los sepas.
- Cada pregunta lleva en "cita" un fragmento LITERAL del texto, copiado carácter a carácter, de entre 10 y 40 palabras, que contiene la respuesta. Si no puedes copiar una cita literal, no escribas esa pregunta.
- Pregunta por lo que hay que saberse: definiciones, normativa con su nombre y fecha, clasificaciones, criterios, medidas y procedimientos. Nada de preguntas sobre la forma del texto ("¿cuántos apartados tiene?").
- Escribe en español de España y con el vocabulario del temario.

Tipos:
- "test": enunciado claro y cuatro opciones plausibles, solo una correcta. "correcta" es el índice (0 a 3). Los distractores deben ser creíbles, no absurdos. "respuesta" vacío.
- "corta": pregunta de desarrollo breve. "respuesta" es la respuesta modelo en dos o tres frases. "opciones" vacío y "correcta" -1.
- "flashcard": el anverso ("enunciado") es una PREGUNTA COMPLETA que dice exactamente qué hay que contestar, nunca un concepto suelto. Mal: "Evaluación psicopedagógica". Bien: "¿Qué es la evaluación psicopedagógica?", "¿Quién realiza la evaluación psicopedagógica?", "¿Cuándo se revisa el dictamen de escolarización?". En "pide" pon en dos o tres palabras qué se pide: "Definición", "Quién la realiza", "Cuándo", "Para qué sirve", "Características", "Clasificación", "Diferencias"… El reverso ("respuesta") es lo que dicen los apuntes, sin añadir nada. "opciones" vacío y "correcta" -1.
- "ley": para memorizar la norma TAL CUAL, que es como hay que citarla en el examen. En "enunciado" va SOLO el nombre corto de la norma tal y como aparece en el texto (por ejemplo "Decreto 147/2002"). En "respuesta" va el fragmento LITERAL de los apuntes que cita esa norma, copiado carácter a carácter, con su nombre completo, fecha y lo que regula (entre 12 y 80 palabras). En "pide" pon "Cita literal". "cita" es el mismo fragmento que "respuesta". Una por cada norma distinta citada en el texto. "opciones" vacío y "correcta" -1.

En "explicacion" añade una frase que ayude a entender el porqué, sin salirte del texto.
En test y cortas, "pide" va vacío.`;

export type ResultadoBanco = { items: ItemGenerado[]; descartadas: number; uso: Uso };

export type TipoPedido = "test" | "corta" | "flashcard" | "ley";

export async function generarBanco(
  ia: Anthropic,
  tema: { numero: number; titulo: string; texto: string },
  cuantas = 10,
  tipos: TipoPedido[] = ["test", "corta", "flashcard", "ley"],
  /** Enunciados que ya existen: no se repiten, para que generar más sume de verdad. */
  evitar: string[] = [],
): Promise<ResultadoBanco> {
  const lista = evitar
    .slice(0, 120)
    .map((e) => `- ${e}`)
    .join("\n");
  const yaHay =
    evitar.length > 0
      ? `\n\nYa existen estas preguntas. NO las repitas ni escribas otras que pregunten lo mismo con otras palabras; busca otros datos del texto:\n${lista}`
      : "";
  const respuesta = await ia.messages.parse({
    model: MODELOS.banco,
    max_tokens: 16000,
    system: INSTRUCCIONES,
    output_config: { format: zodOutputFormat(Banco) },
    messages: [
      {
        role: "user",
        content: `Tema ${tema.numero}: ${tema.titulo}

Escribe unas ${cuantas} preguntas, SOLO de estos tipos: ${tipos.join(", ")}.${tipos.includes("ley") ? " Incluye una de tipo \"ley\" por cada norma citada en el texto que no esté ya en la lista de abajo." : ""}${yaHay}

--- APUNTES ---
${tema.texto}
--- FIN DE LOS APUNTES ---`,
      },
    ],
  });

  if (respuesta.stop_reason === "refusal") {
    throw new Error("La API ha rechazado generar preguntas para este tema.");
  }

  const generadas = respuesta.parsed_output?.items ?? [];
  const validas = generadas
    .filter((item) => tipos.includes(item.tipo))
    .filter((item) => esUtilizable(item, tema.texto));

  return {
    items: validas,
    descartadas: generadas.length - validas.length,
    uso: calcularUso(MODELOS.banco, respuesta.usage),
  };
}

/**
 * Filtro anti-invención: la cita tiene que estar de verdad en los apuntes, y
 * las de test necesitan cuatro opciones con una correcta señalada.
 */
export function esUtilizable(item: ItemGenerado, textoDelTema: string): boolean {
  if (!item.enunciado.trim()) return false;

  const normalizar = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[^\w\s]/g, "")
      .trim();

  const cita = normalizar(item.cita);
  if (cita.split(" ").length < 5) return false;
  if (!normalizar(textoDelTema).includes(cita)) return false;

  if (item.tipo === "test") {
    if (item.opciones.length !== 4) return false;
    if (item.correcta < 0 || item.correcta > 3) return false;
    if (new Set(item.opciones.map(normalizar)).size !== 4) return false;
    return item.opciones.every((o) => o.trim().length > 0);
  }

  if (!item.respuesta.trim()) return false;

  // En las de legislación la respuesta ES el texto literal: tiene que estar en
  // los apuntes, porque es contra lo que se va a cotejar lo que se escriba.
  if (item.tipo === "ley") {
    const respuesta = normalizar(item.respuesta);
    return respuesta.split(" ").length >= 6 && normalizar(textoDelTema).includes(respuesta);
  }

  return true;
}
