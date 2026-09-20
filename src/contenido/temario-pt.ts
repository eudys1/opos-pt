/**
 * Temario oficial de Educación Especial: Pedagogía Terapéutica (Cuerpo de Maestros).
 *
 * Fuente: Orden de 9 de septiembre de 1993 (BOE núm. 226, de 21/09/1993, BOE-A-1993-23257),
 * Anexo I, restablecida por la Orden ECD/191/2012, de 6 de febrero.
 * La Orden solo fija los TÍTULOS; el contenido lo prepara cada opositor.
 *
 * Los enunciados están transcritos de academias y portales de oposiciones porque el PDF del
 * BOE es un escaneado sin texto extraíble. Antes de dar la lista por definitiva conviene
 * cotejarla con el PDF oficial: ver `AVISO_LITERALIDAD` y el campo `dudaLiteralidad`.
 */

export const FUENTE_TEMARIO = {
  norma: "Orden de 9 de septiembre de 1993, Anexo I",
  boe: "BOE núm. 226, de 21 de septiembre de 1993",
  url: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-1993-23257",
  restablecidaPor: "Orden ECD/191/2012, de 6 de febrero",
  consultado: "2026-09-20",
} as const;

export const AVISO_LITERALIDAD =
  "Los títulos están transcritos de fuentes secundarias porque el BOE solo publica un escaneado. Si detectas alguna diferencia con tu temario, puedes editar el título.";

export type TemaOficial = {
  numero: number;
  titulo: string;
  /** true cuando las fuentes consultadas no coinciden palabra por palabra. */
  dudaLiteralidad?: string;
};

export const TEMARIO_PT: readonly TemaOficial[] = [
  {
    numero: 1,
    titulo:
      "La evolución de la educación especial en Europa en las últimas décadas: de la institucionalización y del modelo clínico a la normalización de servicios y al modelo pedagógico.",
  },
  {
    numero: 2,
    titulo:
      "La Educación Especial en el marco de la LOGSE. Su desarrollo normativo. El concepto de alumnos con necesidades educativas especiales.",
  },
  {
    numero: 3,
    titulo:
      "El proceso de identificación y de valoración de las necesidades educativas especiales de los alumnos y de las alumnas y su relación con el currículo. Decisiones de escolarización. La evaluación del proceso educativo y criterios de promoción para estos alumnos.",
  },
  {
    numero: 4,
    titulo:
      "El centro ordinario y la respuesta a las necesidades especiales de los alumnos y de las alumnas. El Proyecto Educativo y el Proyecto Curricular en relación con estos alumnos. Las adaptaciones curriculares.",
  },
  {
    numero: 5,
    titulo:
      "El centro específico de Educación Especial: características del Proyecto Educativo y del Proyecto Curricular. Referentes básicos y criterios para su elaboración.",
  },
  {
    numero: 6,
    titulo:
      "La orientación en el proceso educativo de los alumnos y de las alumnas con necesidades educativas especiales. Estructura y organización y función de la orientación de estos alumnos.",
  },
  {
    numero: 7,
    titulo:
      "Los recursos materiales y personales para la atención de los alumnos y de las alumnas con necesidades educativas especiales. Recursos de la escuela. Recursos externos a la escuela. Colaboración entre servicios específicos y servicios ordinarios.",
  },
  {
    numero: 8,
    titulo:
      "El maestro de educación especial. Funciones. Modalidades de intervención. Relación del maestro de educación especial con el resto de los maestros del centro y con los servicios de apoyo externos a la escuela.",
  },
  {
    numero: 9,
    titulo:
      "La participación de la familia en la educación de los alumnos y de las alumnas con necesidades educativas especiales. Cauces de participación. El papel de los padres en la toma de decisiones respecto al proceso de escolarización de estos alumnos.",
  },
  {
    numero: 10,
    titulo:
      "Los alumnos y las alumnas de Educación Infantil. Desarrollo evolutivo en los diferentes ámbitos: motor, cognitivo, lingüístico, afectivo y social. Alteraciones en el desarrollo.",
  },
  {
    numero: 11,
    titulo:
      "Las necesidades educativas especiales en la etapa de Educación Infantil. La respuesta educativa a las necesidades especiales de estos alumnos en el Proyecto Curricular y en las programaciones. Las adaptaciones curriculares.",
  },
  {
    numero: 12,
    titulo:
      "Los alumnos y las alumnas de Educación Primaria. Desarrollo evolutivo en los diferentes ámbitos: motor, cognitivo, lingüístico, afectivo y social. Alteraciones en el desarrollo.",
  },
  {
    numero: 13,
    titulo:
      "Las necesidades educativas especiales en la etapa de Educación Primaria. La respuesta educativa a las necesidades especiales de estos alumnos en el Proyecto Curricular y en las programaciones. Las adaptaciones curriculares.",
  },
  {
    numero: 14,
    titulo:
      "Las necesidades educativas especiales de los alumnos y de las alumnas con deficiencia auditiva. Aspectos diferenciales en las distintas áreas del desarrollo. Identificación de las necesidades educativas especiales de estos alumnos. Sistemas de detección del déficit auditivo.",
  },
  {
    numero: 15,
    titulo:
      "Criterios para la elaboración de adaptaciones curriculares para alumnos y alumnas con deficiencia auditiva. Ayudas técnicas para la deficiencia auditiva. Organización de la respuesta educativa.",
  },
  {
    numero: 16,
    titulo:
      "Las necesidades educativas especiales de los alumnos y de las alumnas con deficiencia visual. Aspectos diferenciales en las distintas áreas del desarrollo. Identificación de las necesidades educativas especiales de estos alumnos. Aprovechamiento de la visión residual.",
  },
  {
    numero: 17,
    titulo:
      "Criterios para la elaboración de adaptaciones curriculares para alumnos y alumnas con deficiencia visual. Utilización de recursos educativos y ayudas técnicas. Organización de la respuesta educativa.",
  },
  {
    numero: 18,
    titulo:
      "Las necesidades educativas especiales de los alumnos y de las alumnas con deficiencia motora. Aspectos diferenciales en las distintas áreas del desarrollo. Los alumnos con deficiencia motora y otras deficiencias asociadas. Identificación de las necesidades educativas especiales de estos alumnos.",
    dudaLiteralidad:
      "Una de las transcripciones dice «otras diferencias asociadas» en lugar de «otras deficiencias asociadas». Conviene cotejarlo con el BOE.",
  },
  {
    numero: 19,
    titulo:
      "Criterios para la elaboración de adaptaciones curriculares para alumnos y alumnas con deficiencia motora. Organización de la respuesta educativa.",
  },
  {
    numero: 20,
    titulo:
      "Las necesidades educativas especiales de los alumnos y de las alumnas con deficiencia mental. Aspectos diferenciales en las distintas áreas del desarrollo. Identificación de las necesidades educativas especiales de estos alumnos.",
  },
  {
    numero: 21,
    titulo:
      "Criterios para la elaboración de adaptaciones curriculares para alumnos y alumnas con deficiencia mental. Organización de la respuesta educativa.",
  },
  {
    numero: 22,
    titulo:
      "Los problemas de comportamiento en el ámbito educativo. Análisis de los factores que intervienen desde una perspectiva interactiva. El papel de la escuela en la prevención de los problemas de comportamiento.",
  },
  {
    numero: 23,
    titulo:
      "Las necesidades educativas especiales de los alumnos y de las alumnas con autismo o con otras alteraciones graves de la personalidad. La identificación de las necesidades educativas especiales de estos alumnos.",
  },
  {
    numero: 24,
    titulo:
      "Criterios para la elaboración de adaptaciones curriculares para alumnos y alumnas con autismo o con otras alteraciones graves de la personalidad. Organización de la respuesta educativa.",
  },
  {
    numero: 25,
    titulo:
      "Los alumnos y las alumnas precoces, con talento y superdotados. Identificación de las necesidades educativas de estos alumnos. Organización de la respuesta educativa.",
  },
];

/** Título corto para tablas y listas: la primera oración del enunciado oficial. */
export function tituloCorto(titulo: string, maximo = 72): string {
  const primeraFrase = titulo.split(". ")[0] ?? titulo;
  if (primeraFrase.length <= maximo) return primeraFrase;
  return primeraFrase.slice(0, maximo).trimEnd() + "…";
}
