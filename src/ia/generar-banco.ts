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
- "flashcard": anverso en "enunciado" (un concepto), reverso en "respuesta" (su definición tal y como está en los apuntes). "opciones" vacío y "correcta" -1.
- "ley": en "enunciado" va SOLO el nombre de la norma tal y como aparece en el texto (por ejemplo "Real Decreto 696/1995, de 28 de abril"); en "respuesta", de qué va y qué regula según los apuntes. Una por cada norma citada en el texto. "opciones" vacío y "correcta" -1.

En "explicacion" añade una frase que ayude a entender el porqué, sin salirte del texto.`;

export type ResultadoBanco = { items: ItemGenerado[]; descartadas: number; uso: Uso };

export async function generarBanco(
  ia: Anthropic,
  tema: { numero: number; titulo: string; texto: string },
  cuantas = 20,
): Promise<ResultadoBanco> {
  const respuesta = await ia.messages.parse({
    model: MODELOS.banco,
    max_tokens: 16000,
    system: INSTRUCCIONES,
    output_config: { format: zodOutputFormat(Banco) },
    messages: [
      {
        role: "user",
        content: `Tema ${tema.numero}: ${tema.titulo}

Escribe unas ${cuantas} preguntas repartidas entre los cuatro tipos, con una de tipo "ley" por cada norma citada en el texto.

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
  const validas = generadas.filter((item) => esUtilizable(item, tema.texto));

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

  return item.respuesta.trim().length > 0;
}
