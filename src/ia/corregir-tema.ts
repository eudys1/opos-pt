import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODELOS, calcularUso, type Uso } from "./cliente";

/**
 * Corrección del desarrollo de un tema en un simulacro.
 *
 * Se compara contra el texto del tema tal y como lo tiene preparado la
 * opositora: la referencia son sus apuntes, no lo que la IA crea recordar del
 * temario. Si algo que ha escrito no está en sus apuntes, se señala como
 * "añadido", no como error: puede saberlo de otra fuente.
 */

const CriterioCorregido = z.object({
  criterio: z.string(),
  nota: z.number(),
  comentario: z.string(),
});

const Correccion = z.object({
  notaGlobal: z.number(),
  porCriterio: z.array(CriterioCorregido),
  bien: z.array(z.string()),
  /** Apartados de los apuntes que no aparecen en lo escrito. */
  falta: z.array(z.string()),
  errores: z.array(z.string()),
  /** Cosas correctas que no están en los apuntes: mérito, no fallo. */
  anadido: z.array(z.string()),
  ortografia: z.array(z.string()),
  consejo: z.string(),
});

export type CorreccionTema = z.infer<typeof Correccion>;

/**
 * Criterios por defecto. Andalucía no publica los porcentajes por especialidad,
 * así que se parte de un reparto razonable y editable desde el perfil.
 */
export const CRITERIOS_TEMA = [
  { criterio: "Conocimiento del tema", peso: 40, queSeEspera: "Contenido completo y bien explicado." },
  { criterio: "Normativa", peso: 20, queSeEspera: "Leyes citadas con su nombre, fecha y sentido." },
  { criterio: "Estructura", peso: 15, queSeEspera: "Introducción, desarrollo ordenado y conclusión." },
  { criterio: "Aplicación práctica", peso: 15, queSeEspera: "Ejemplos y aterrizaje en el aula." },
  { criterio: "Expresión escrita", peso: 10, queSeEspera: "Redacción clara y correcta." },
];

const INSTRUCCIONES = `Corriges el desarrollo por escrito de un tema de la oposición al Cuerpo de Maestros, especialidad Pedagogía Terapéutica.

La referencia son los apuntes de la propia opositora, que te doy enteros. Corrige comparando con ellos.

Cómo corriges:
- Una nota de 0 a 10 por criterio y una "notaGlobal" como media ponderada por los pesos, con un decimal.
- El listón es el de un tribunal: 5 es aprobado justo, 7 es un buen tema, 9 es sobresaliente. No regales notas.
- "falta": apartados o ideas importantes de sus apuntes que no ha escrito. Es lo más valioso de la corrección, así que sé concreta.
- "errores": lo que contradice sus apuntes o es incorrecto.
- "anadido": lo correcto que ha escrito y NO está en sus apuntes. No lo cuentes como error; señálalo para que sepa que se ha salido de su guion.
- "ortografia": faltas reales que veas. Si el texto viene de fotos, sé prudente: puede ser un error de lectura.
- "consejo": dos o tres frases con lo más rentable para la próxima vez.
- Tutea, ve al grano, nada de paños calientes ni de elogios de relleno.`;

export async function corregirTema(
  ia: Anthropic,
  datos: {
    numero: number;
    titulo: string;
    apuntes: string;
    respuesta: string;
    criterios?: { criterio: string; peso: number; queSeEspera: string }[];
    desdeFoto?: boolean;
    minutos?: number;
  },
): Promise<{ correccion: CorreccionTema; uso: Uso }> {
  const criterios = datos.criterios ?? CRITERIOS_TEMA;

  const respuesta = await ia.messages.parse({
    model: MODELOS.examen,
    max_tokens: 12000,
    system: INSTRUCCIONES,
    output_config: { format: zodOutputFormat(Correccion) },
    messages: [
      {
        role: "user",
        content: `TEMA ${datos.numero}: ${datos.titulo}

CRITERIOS Y PESOS:
${criterios.map((c) => `- ${c.criterio} (${c.peso} %): ${c.queSeEspera}`).join("\n")}

SUS APUNTES DEL TEMA:
${datos.apuntes}

LO QUE HA ESCRITO EN EL EXAMEN${datos.desdeFoto ? " (transcrito de fotos, puede tener errores de lectura)" : ""}${
          datos.minutos ? `, en ${datos.minutos} minutos` : ""
        }:
${datos.respuesta}`,
      },
    ],
  });

  const correccion = respuesta.parsed_output;
  if (!correccion) throw new Error("La corrección no ha llegado en el formato esperado.");

  return { correccion, uso: calcularUso(MODELOS.examen, respuesta.usage) };
}
