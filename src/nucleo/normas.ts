/**
 * Detección de normativa citada en los apuntes.
 *
 * Se hace con expresiones regulares y no con IA: es gratis, instantáneo y no
 * puede inventarse una ley que no esté escrita. Lo que sí necesita IA después
 * es comprobar si esa norma ha cambiado, y eso va aparte.
 */

export type NormaCitada = {
  /** Nombre normalizado, para agrupar "LOMLOE" con "la LOMLOE". */
  nombre: string;
  /** Cómo aparecía en el texto la primera vez. */
  tal_cual: string;
  temas: number[];
};

const PATRONES: RegExp[] = [
  // Ley Orgánica 2/2006, de 3 de mayo
  /ley\s+org[áa]nica\s+\d+\/\d{4}(?:,\s*de\s+\d{1,2}\s+de\s+\w+)?/gi,
  // Ley 39/2015, de 1 de octubre
  /\bley\s+\d+\/\d{4}(?:,\s*de\s+\d{1,2}\s+de\s+\w+)?/gi,
  // Real Decreto 696/1995, de 28 de abril · Real Decreto-ley 5/2023
  /real\s+decreto(?:-ley)?\s+\d+\/\d{4}(?:,\s*de\s+\d{1,2}\s+de\s+\w+)?/gi,
  // Decreto 147/2002, de 14 de mayo (autonómicos)
  /\bdecreto\s+\d+\/\d{4}(?:,\s*de\s+\d{1,2}\s+de\s+\w+)?/gi,
  // Orden EDU/849/2010 · Orden ECD/191/2012
  /\borden\s+[A-Za-z]{2,4}\/\d+\/\d{4}/gi,
  // Orden de 25 de julio de 2008
  /\borden\s+de\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/gi,
  // Instrucciones de 8 de marzo de 2017
  /\binstrucciones?\s+de\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/gi,
  // Siglas conocidas del temario
  /\b(LOMLOE|LOGSE|LOE|LOMCE|LEA|LISMI|LGD)\b/g,
];

export function detectarNormas(temas: { numero: number; texto: string }[]): NormaCitada[] {
  const encontradas = new Map<string, NormaCitada>();

  for (const tema of temas) {
    if (!tema.texto) continue;
    for (const patron of PATRONES) {
      for (const coincidencia of tema.texto.matchAll(patron)) {
        const talCual = coincidencia[0].replace(/\s+/g, " ").trim();
        const clave = normalizarNombre(talCual);
        if (clave.length < 4) continue;

        const previa = encontradas.get(clave);
        if (previa) {
          if (!previa.temas.includes(tema.numero)) previa.temas.push(tema.numero);
          // Se queda con la forma más larga, que suele ser la más completa.
          if (talCual.length > previa.tal_cual.length) previa.tal_cual = talCual;
        } else {
          encontradas.set(clave, { nombre: clave, tal_cual: talCual, temas: [tema.numero] });
        }
      }
    }
  }

  return [...encontradas.values()].sort((a, b) => b.temas.length - a.temas.length);
}

/** "la  LEY orgánica 2/2006, de 3 de Mayo" → "Ley Orgánica 2/2006" */
export function normalizarNombre(texto: string): string {
  const limpio = texto
    .replace(/\s+/g, " ")
    .replace(/^(la|el|las|los|del|de la)\s+/i, "")
    .trim();

  // La fecha larga sobra para identificarla: el número y el año ya la fijan.
  const conNumero = limpio.match(
    /^(ley org[áa]nica|ley|real decreto-ley|real decreto|decreto|orden)\s+([A-Z]{2,4}\/)?(\d+\/\d{4})/i,
  );
  if (conNumero) {
    const tipo = capitalizar(conNumero[1]);
    const siglas = (conNumero[2] ?? "").toUpperCase();
    return `${tipo} ${siglas}${conNumero[3]}`;
  }

  // "Orden de 25 de julio de 2008": en español el mes va en minúscula.
  if (/^(orden|instrucciones?)\s+de\s+/i.test(limpio)) {
    const sinCola = limpio.replace(/,.*$/, "").toLowerCase();
    return sinCola.charAt(0).toUpperCase() + sinCola.slice(1);
  }

  return limpio.toUpperCase().length <= 7 ? limpio.toUpperCase() : capitalizar(limpio);
}

function capitalizar(texto: string): string {
  return texto
    .toLowerCase()
    .split(" ")
    .map((palabra, i) =>
      i === 0 || palabra.length > 3 ? palabra.charAt(0).toUpperCase() + palabra.slice(1) : palabra,
    )
    .join(" ");
}
