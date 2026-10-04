import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODELOS, calcularUso, type Uso } from "./cliente";
import { CONSIGNA_ANDALUCIA } from "../contenido/supuestos";

/**
 * Supuestos prácticos: generarlos a partir del temario propio y corregirlos
 * con su rúbrica.
 *
 * Un supuesto es un caso de aula, como los del examen de Andalucía: el
 * contexto del centro, un alumno o alumna con su necesidad y lo que se
 * observa, y una consigna única que pide la intervención completa. No hay
 * cuestiones sueltas: el examen real no las tiene. La rúbrica se genera con
 * él para que la corrección después sea consistente y explicable.
 */

const Rubrica = z.object({
  criterio: z.string(),
  /** Peso en porcentaje. La suma de todos debe dar 100. */
  peso: z.number(),
  queSeEspera: z.string(),
});

const Supuesto = z.object({
  titulo: z.string(),
  /** El caso, sin la consigna final: esa la pone el código (CONSIGNA_ANDALUCIA). */
  enunciado: z.string(),
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

const INSTRUCCIONES_GENERAR = `Escribes supuestos prácticos para la oposición al Cuerpo de Maestros, especialidad Pedagogía Terapéutica, en Andalucía, iguales en forma a los que caen en el examen.

Así son los del examen (convocatorias de 2019 y 2025):
- Entre 1.200 y 2.000 caracteres. Sin preguntas ni cuestiones: al final va siempre la misma consigna, que añade el sistema; tú NO la escribes.
- Empiezan por el contexto, dirigido al opositor en segunda persona de cortesía o en impersonal ("Desempeña su labor como maestro/a de Pedagogía Terapéutica en…", "Trabaja usted en un CEIP…"): tipo de centro (CEIP, aula específica en centro ordinario…), número de líneas, entorno (urbano, rural, a cuántos km de la capital), nivel socioeconómico y grado de implicación de las familias, plantilla y recursos (PT, AL compartido, recursos del centro).
- Después, el alumno o alumna: etapa y curso, necesidad tal como la nombra la normativa andaluza (NEE derivadas de discapacidad intelectual, TEA, discapacidad visual o auditiva, TDAH, trastorno grave del desarrollo, dificultades específicas de aprendizaje como la dislexia…), lo que dice el informe de evaluación psicopedagógica o el dictamen de escolarización y la modalidad de escolarización (grupo ordinario a tiempo completo, grupo ordinario con apoyos en periodos variables, aula específica…).
- Y lo que se observa, a menudo en viñetas con guion: nivel de competencia curricular o desfase, comunicación, atención, conducta, motricidad, autonomía, relación con los iguales, intereses y puntos fuertes (por ejemplo, buena disposición ante recursos digitales). Datos concretos que den juego a la intervención, sin resolverla.
- Tono administrativo y sobrio, como un enunciado oficial. Nada de nombres de ley ni de artículos en el enunciado: eso lo tiene que aportar la opositora.

Lo demás:
- Si te dan supuestos que ya tiene, varía respecto a ellos: otra necesidad, otra etapa o curso, otra modalidad, otro contexto.
- Apóyate en los apuntes que te den para que el caso dé pie a lo que estudia. No inventes normas.
- El título resume el caso en una línea ("Alumna con dislexia en 4.º de Primaria, grupo ordinario con apoyos").
- La rúbrica lleva entre cuatro y seis criterios con su peso, y los pesos suman exactamente 100. Incluye siempre fundamentación normativa y teórica, propuesta didáctica, propuesta organizativa (recursos, coordinación, familia) y evaluación y seguimiento.
- La solución orientativa resume lo que debería contener una buena intervención, en unas diez líneas.
- Español de España, vocabulario del temario, sin florituras.`;

export async function generarSupuesto(
  ia: Anthropic,
  datos: {
    temas: { numero: number; titulo: string; texto: string }[];
    peticion?: string;
    /** Los que ya tiene, en una línea cada uno, para no repetir caso. */
    yaTiene?: string[];
  },
): Promise<{ supuesto: SupuestoGenerado; uso: Uso }> {
  const material = datos.temas
    .map((t) => `### Tema ${t.numero}: ${t.titulo}\n${recortar(t.texto, 6000)}`)
    .join("\n\n");
  const repetidos = datos.yaTiene?.length
    ? `\n\nSupuestos que ya tiene (varía respecto a estos):\n${datos.yaTiene.map((s) => `- ${s}`).join("\n")}`
    : "";

  const respuesta = await ia.messages.parse({
    model: MODELOS.banco,
    max_tokens: 8000,
    system: INSTRUCCIONES_GENERAR,
    output_config: { format: zodOutputFormat(Supuesto) },
    messages: [
      {
        role: "user",
        content: `${datos.peticion ? `Encargo: ${datos.peticion}\n\n` : ""}Escribe un supuesto práctico apoyado en estos apuntes.${repetidos}

--- APUNTES ---
${material}
--- FIN ---`,
      },
    ],
  });

  const supuesto = respuesta.parsed_output;
  if (!supuesto) throw new Error("El supuesto no ha llegado en el formato esperado.");

  return {
    supuesto: normalizarPesos({ ...supuesto, enunciado: conConsigna(supuesto.enunciado) }),
    uso: calcularUso(MODELOS.banco, respuesta.usage),
  };
}

/**
 * El enunciado con la consigna oficial al final, una sola vez: si la IA la ha
 * escrito igualmente (o algo que empieza igual), se quita y se pone la buena.
 */
export function conConsigna(enunciado: string): string {
  const sinConsigna = enunciado.replace(/\s*(CON TODO LO EXPRESADO\s*)?PLANTEE UNA INTERVENCI[ÓO]N[\s\S]*$/i, "");
  return `${sinConsigna.trim()}\n\n${CONSIGNA_ANDALUCIA}`;
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
  /**
   * Solo si hay resolución de la academia: sus puntos clave y si aparecen en
   * la respuesta. Vacío si no la hay.
   */
  puntosClave: z.array(
    z.object({
      punto: z.string(),
      presente: z.enum(["si", "parcial", "no"]),
    }),
  ),
});

export type CorreccionSupuesto = z.infer<typeof Correccion>;

const INSTRUCCIONES_CORREGIR = `Corriges supuestos prácticos de la oposición al Cuerpo de Maestros, especialidad Pedagogía Terapéutica.

Recibes el enunciado (y, si las tiene, sus cuestiones), la rúbrica con los pesos, la solución orientativa y lo que ha escrito la opositora. Devuelves la corrección.

Cómo corriges:
- Una nota de 0 a 10 por cada criterio de la rúbrica, y "notaGlobal" como media ponderada por los pesos. Redondea a un decimal.
- Sé exigente pero justa, con el listón de un tribunal: un 5 es aprobado raspado, un 7 es un buen supuesto y un 9 es excelente.
- "bien", "falta" y "errores" en frases cortas y concretas, señalando la parte del supuesto a la que se refieren. No inventes errores para rellenar.
- En "ortografia" lista solo las faltas reales que veas, con la palabra tal cual está escrita. Si el texto viene de una foto, puede haber errores de lectura: en ese caso sé prudente y no listes dudosas.
- "consejo": dos o tres frases con lo más rentable para la próxima vez.
- Tutea, ve al grano y no adornes.

Si recibes una RESOLUCIÓN DE LA ACADEMIA, es la referencia principal: es lo que el tribunal espera ver.
- En "puntosClave" desglosa esa resolución en sus ideas importantes (entre cinco y doce), cada una en una frase corta, y marca si la respuesta la recoge: "si", "parcial" o "no". Valen otras palabras si la idea está.
- Lo que falte de la resolución va también en "falta", y pesa en la nota del criterio al que pertenezca.
- Si la respuesta aporta algo valioso que la resolución no tiene, dilo en "bien": no se penaliza.
Si no hay resolución de la academia, "puntosClave" va vacío.`;

export async function corregirSupuesto(
  ia: Anthropic,
  datos: {
    enunciado: string;
    cuestiones: string[];
    rubrica: { criterio: string; peso: number; queSeEspera: string }[];
    solucion?: string | null;
    /** true si la solución la ha dado la academia: pasa a ser la referencia. */
    solucionDeAcademia?: boolean | null;
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
${
  // Solo los supuestos antiguos de la IA traen cuestiones; los del examen no.
  datos.cuestiones.length ? `\nCUESTIONES:\n${datos.cuestiones.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n` : ""
}
RÚBRICA:
${rubrica}
${
  datos.solucion
    ? datos.solucionDeAcademia
      ? `\nRESOLUCIÓN DE LA ACADEMIA:\n${datos.solucion}`
      : `\nSOLUCIÓN ORIENTATIVA:\n${datos.solucion}`
    : ""
}

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
