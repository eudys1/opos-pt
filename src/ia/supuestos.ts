import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODELOS, calcularUso, type Uso } from "./cliente";

/**
 * Supuestos prácticos: generarlos a partir del temario propio y corregirlos
 * con su rúbrica.
 *
 * Un supuesto es un caso de aula con cuestiones a resolver. La rúbrica se
 * genera con él para que la corrección después sea consistente y explicable,
 * en vez de una nota salida de la nada.
 */

const Rubrica = z.object({
  criterio: z.string(),
  /** Peso en porcentaje. La suma de todos debe dar 100. */
  peso: z.number(),
  queSeEspera: z.string(),
});

const Supuesto = z.object({
  titulo: z.string(),
  enunciado: z.string(),
  cuestiones: z.array(z.string()),
  /** Necesidad principal del caso: TEA, TDAH, discapacidad intelectual… */
  necesidad: z.string(),
  /** Etapa y curso: "3.º de Primaria", "5 años de Infantil"… */
  curso: z.string(),
  /** Números de tema del temario con los que se relaciona. */
  temas: z.array(z.number()),
  rubrica: z.array(Rubrica),
  solucion: z.string(),
});

export type SupuestoGenerado = z.infer<typeof Supuesto>;

const INSTRUCCIONES_GENERAR = `Escribes supuestos prácticos para la oposición al Cuerpo de Maestros, especialidad Pedagogía Terapéutica, en Andalucía.

Un supuesto es un caso de aula realista: un alumno o un grupo, su contexto, lo que se observa y lo que se pide resolver.

Cómo tiene que ser:
- El enunciado describe el caso en dos o tres párrafos: datos del alumno, curso, contexto del centro y de la familia, y lo observado. Concreto y verosímil, como los de las convocatorias.
- Entre tres y cinco cuestiones, de lo general a lo concreto: valoración inicial, medidas y adaptaciones, intervención y recursos, coordinación con familia y equipo docente, y evaluación.
- Apóyate en el contenido de los apuntes que te den. Puedes citar la normativa que aparezca en ellos, pero no inventes normas ni artículos que no estén.
- La rúbrica lleva entre cuatro y seis criterios con su peso, y los pesos suman exactamente 100. Incluye siempre fundamentación normativa, medidas y recursos, y evaluación y seguimiento.
- La solución orientativa resume lo que debería contener una buena respuesta, en unas diez líneas.
- Español de España, vocabulario del temario, sin florituras.`;

export async function generarSupuesto(
  ia: Anthropic,
  datos: { temas: { numero: number; titulo: string; texto: string }[]; peticion?: string },
): Promise<{ supuesto: SupuestoGenerado; uso: Uso }> {
  const material = datos.temas
    .map((t) => `### Tema ${t.numero}: ${t.titulo}\n${recortar(t.texto, 6000)}`)
    .join("\n\n");

  const respuesta = await ia.messages.parse({
    model: MODELOS.banco,
    max_tokens: 8000,
    system: INSTRUCCIONES_GENERAR,
    output_config: { format: zodOutputFormat(Supuesto) },
    messages: [
      {
        role: "user",
        content: `${datos.peticion ? `Encargo: ${datos.peticion}\n\n` : ""}Escribe un supuesto práctico apoyado en estos apuntes.

--- APUNTES ---
${material}
--- FIN ---`,
      },
    ],
  });

  const supuesto = respuesta.parsed_output;
  if (!supuesto) throw new Error("El supuesto no ha llegado en el formato esperado.");

  return { supuesto: normalizarPesos(supuesto), uso: calcularUso(MODELOS.banco, respuesta.usage) };
}

// ------------------------------------------------------------- corrección

const CriterioCorregido = z.object({
  criterio: z.string(),
  /** De 0 a 10 dentro de ese criterio. */
  nota: z.number(),
  comentario: z.string(),
});

const Correccion = z.object({
  /** De 0 a 10, media ponderada por los pesos de la rúbrica. */
  notaGlobal: z.number(),
  porCriterio: z.array(CriterioCorregido),
  bien: z.array(z.string()),
  falta: z.array(z.string()),
  errores: z.array(z.string()),
  /** Faltas de ortografía y acentuación detectadas, tal y como aparecen. */
  ortografia: z.array(z.string()),
  consejo: z.string(),
});

export type CorreccionSupuesto = z.infer<typeof Correccion>;

const INSTRUCCIONES_CORREGIR = `Corriges supuestos prácticos de la oposición al Cuerpo de Maestros, especialidad Pedagogía Terapéutica.

Recibes el enunciado, sus cuestiones, la rúbrica con los pesos, la solución orientativa y lo que ha escrito la opositora. Devuelves la corrección.

Cómo corriges:
- Una nota de 0 a 10 por cada criterio de la rúbrica, y "notaGlobal" como media ponderada por los pesos. Redondea a un decimal.
- Sé exigente pero justa, con el listón de un tribunal: un 5 es aprobado raspado, un 7 es un buen supuesto y un 9 es excelente.
- "bien", "falta" y "errores" en frases cortas y concretas, señalando la parte del supuesto a la que se refieren. No inventes errores para rellenar.
- En "ortografia" lista solo las faltas reales que veas, con la palabra tal cual está escrita. Si el texto viene de una foto, puede haber errores de lectura: en ese caso sé prudente y no listes dudosas.
- "consejo": dos o tres frases con lo más rentable para la próxima vez.
- Tutea, ve al grano y no adornes.`;

export async function corregirSupuesto(
  ia: Anthropic,
  datos: {
    enunciado: string;
    cuestiones: string[];
    rubrica: { criterio: string; peso: number; queSeEspera: string }[];
    solucion?: string | null;
    respuesta: string;
    desdeFoto?: boolean;
  },
): Promise<{ correccion: CorreccionSupuesto; uso: Uso }> {
  const rubrica = datos.rubrica
    .map((r) => `- ${r.criterio} (${r.peso} %): ${r.queSeEspera}`)
    .join("\n");

  const respuesta = await ia.messages.parse({
    model: MODELOS.examen,
    max_tokens: 8000,
    system: INSTRUCCIONES_CORREGIR,
    output_config: { format: zodOutputFormat(Correccion) },
    messages: [
      {
        role: "user",
        content: `SUPUESTO:
${datos.enunciado}

CUESTIONES:
${datos.cuestiones.map((c, i) => `${i + 1}. ${c}`).join("\n")}

RÚBRICA:
${rubrica}
${datos.solucion ? `\nSOLUCIÓN ORIENTATIVA:\n${datos.solucion}` : ""}

RESPUESTA DE LA OPOSITORA${datos.desdeFoto ? " (transcrita de fotos, puede tener errores de lectura)" : ""}:
${datos.respuesta}`,
      },
    ],
  });

  const correccion = respuesta.parsed_output;
  if (!correccion) throw new Error("La corrección no ha llegado en el formato esperado.");

  return { correccion, uso: calcularUso(MODELOS.examen, respuesta.usage) };
}

/** Los pesos tienen que sumar 100: si no, se reparte la diferencia. */
export function normalizarPesos(supuesto: SupuestoGenerado): SupuestoGenerado {
  const total = supuesto.rubrica.reduce((suma, r) => suma + r.peso, 0);
  if (total === 100 || supuesto.rubrica.length === 0) return supuesto;

  const rubrica = supuesto.rubrica.map((r) => ({
    ...r,
    peso: Math.round((r.peso / total) * 100),
  }));

  // El redondeo puede dejar 99 o 101: la diferencia va al criterio más pesado.
  const nuevoTotal = rubrica.reduce((suma, r) => suma + r.peso, 0);
  if (nuevoTotal !== 100) {
    const mayor = rubrica.reduce((a, b) => (a.peso >= b.peso ? a : b));
    mayor.peso += 100 - nuevoTotal;
  }

  return { ...supuesto, rubrica };
}

/** Nota global recalculada en local, por si la IA se equivoca en la media. */
export function notaPonderada(
  porCriterio: { criterio: string; nota: number }[],
  rubrica: { criterio: string; peso: number }[],
): number {
  let suma = 0;
  let pesos = 0;
  for (const criterio of porCriterio) {
    const peso = rubrica.find((r) => r.criterio === criterio.criterio)?.peso ?? 0;
    suma += criterio.nota * peso;
    pesos += peso;
  }
  if (pesos === 0) return 0;
  return Math.round((suma / pesos) * 10) / 10;
}

function recortar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo)}…`;
}
