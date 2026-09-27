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

// --------------------------------------------------------- banco de normativa

export type EntradaBanco = {
  nombre: string;
  /** La cita más completa que aparece en los temas, tal cual está escrita. */
  cita: string;
  temas: number[];
  grupo: string;
};

const GRUPOS: [RegExp, string][] = [
  [/^ley org/i, "Leyes orgánicas"],
  [/^ley /i, "Leyes"],
  [/^real decreto/i, "Reales decretos"],
  [/^decreto/i, "Decretos"],
  [/^orden/i, "Órdenes"],
  [/^instrucci/i, "Instrucciones"],
];

function grupoDe(nombre: string): string {
  return GRUPOS.find(([patron]) => patron.test(nombre))?.[1] ?? "Otras";
}

/**
 * Dónde está el apartado de referencias normativas de un tema, si lo tiene.
 * Ahí cada norma aparece con su título completo y limpio, que es la forma en
 * que hay que citarla: por eso manda sobre cualquier otra aparición.
 */
function apartadoDeReferencias(texto: string): [number, number] | null {
  const cabecera = texto.search(/referencias\s+normativas|normativa\s+de\s+referencia/i);
  if (cabecera === -1) return null;
  const resto = texto.slice(cabecera + 10);
  const siguiente = resto.search(/referencias\s+bibliogr|\n\s*\d+(\.\d+)+\.?\s+[A-ZÁÉÍÓÚ]/i);
  return [cabecera, siguiente === -1 ? texto.length : cabecera + 10 + siguiente];
}

/** Hasta el primer punto y aparte, salto de línea doble o 500 caracteres. */
function hastaFinDeFrase(resto: string): string {
  const fin = resto.search(/\.\s*\n|\n\s*\n|\.\s+(?=[A-ZÁÉÍÓÚ])/);
  return (fin === -1 ? resto.slice(0, 500) : resto.slice(0, fin + 1)).slice(0, 500);
}

/**
 * Fuera de las referencias, la norma suele ir dentro de una frase. Se toma su
 * nombre y los incisos que lo completan ("de Educación", "por la que se
 * modifica…") y se corta donde empieza lo que dice el tema sobre ella.
 */
const COMPLETA_EL_NOMBRE = /^(de|del|por|sobre|relativ|reguladora|que regula|para la|para el|y de|y del|y los|y las|y la|y el)\b/i;

function citaEnFrase(nombreTalCual: string, despues: string): string {
  let cita = nombreTalCual;
  const frase = hastaFinDeFrase(despues);
  const trozos = frase.split(/,\s*/);
  // El primer trozo es lo que va pegado al nombre antes de la primera coma.
  if (trozos[0].trim()) return cita.trim();
  for (const trozo of trozos.slice(1)) {
    if (!COMPLETA_EL_NOMBRE.test(trozo.trim())) break;
    cita += `, ${trozo.trim()}`;
  }
  return cita.replace(/\s+/g, " ").replace(/[,;:.]$/, "").trim();
}

/** Siglas y la ley a la que se refieren, para no listar la misma ley dos veces. */
const SIGLAS: Record<string, string> = {
  LOMLOE: "Ley Orgánica 3/2020",
  LOE: "Ley Orgánica 2/2006",
  LOMCE: "Ley Orgánica 8/2013",
  LOGSE: "Ley Orgánica 1/1990",
  LEA: "Ley 17/2007",
};

/**
 * Todas las normas citadas en los temas, una sola vez cada una, con su cita
 * más completa. Manda la del apartado de referencias; si no la hay, la más
 * larga de las que aparecen en frases. Se apuntan todos los temas en los que
 * sale.
 */
export function bancoDeNormativa(temas: { numero: number; texto: string }[]): EntradaBanco[] {
  const porNombre = new Map<string, EntradaBanco & { deReferencias: boolean }>();

  for (const tema of temas) {
    if (!tema.texto) continue;
    const referencias = apartadoDeReferencias(tema.texto);
    for (const patron of PATRONES) {
      for (const m of tema.texto.matchAll(patron)) {
        const nombre = normalizarNombre(m[0]);
        if (nombre.length < 3) continue;
        const posicion = m.index ?? 0;
        const deReferencias = Boolean(
          referencias && posicion >= referencias[0] && posicion < referencias[1],
        );
        const cita = deReferencias
          ? hastaFinDeFrase(tema.texto.slice(posicion)).replace(/\s+/g, " ").trim()
          : citaEnFrase(m[0], tema.texto.slice(posicion + m[0].length));

        const previa = porNombre.get(nombre);
        if (!previa) {
          porNombre.set(nombre, { nombre, cita, temas: [tema.numero], grupo: grupoDe(nombre), deReferencias });
          continue;
        }
        if (!previa.temas.includes(tema.numero)) previa.temas.push(tema.numero);
        const mejor =
          (deReferencias && !previa.deReferencias) ||
          (deReferencias === previa.deReferencias && cita.length > previa.cita.length);
        if (mejor) Object.assign(previa, { cita, deReferencias });
      }
    }
  }

  // Las siglas se funden con su ley si la ley ya está en el banco.
  for (const [sigla, ley] of Object.entries(SIGLAS)) {
    const s = porNombre.get(sigla);
    const l = porNombre.get(ley);
    if (!s || !l) continue;
    for (const t of s.temas) if (!l.temas.includes(t)) l.temas.push(t);
    porNombre.delete(sigla);
  }

  const orden = [...GRUPOS.map(([, g]) => g), "Otras"];
  return [...porNombre.values()]
    .map((e): EntradaBanco => ({ nombre: e.nombre, cita: e.cita, temas: e.temas, grupo: e.grupo }))
    .sort(
      (a, b) =>
        orden.indexOf(a.grupo) - orden.indexOf(b.grupo) || a.nombre.localeCompare(b.nombre, "es"),
    );
}

/** El banco como documento de texto, listo para leer, editar o descargar. */
export function documentoDeNormativa(entradas: EntradaBanco[]): string {
  const grupos = new Map<string, EntradaBanco[]>();
  for (const e of entradas) grupos.set(e.grupo, [...(grupos.get(e.grupo) ?? []), e]);

  const partes = ["BANCO DE NORMATIVA", "Sacado de mis temas, tal cual está escrito en ellos.", ""];
  for (const [grupo, lista] of grupos) {
    partes.push(grupo.toUpperCase());
    for (const e of lista) {
      const temas = e.temas.sort((a, b) => a - b).join(", ");
      partes.push(`- ${e.cita}  [tema${e.temas.length > 1 ? "s" : ""} ${temas}]`);
    }
    partes.push("");
  }
  return partes.join("\n").trim() + "\n";
}

/**
 * Normas que están en los temas pero todavía no en el documento, para
 * añadirlas sin pisar lo que la persona haya editado a mano.
 */
export function normasQueFaltan(documento: string, entradas: EntradaBanco[]): EntradaBanco[] {
  const presentes = new Set<string>();
  for (const patron of PATRONES) {
    for (const m of documento.matchAll(patron)) presentes.add(normalizarNombre(m[0]));
  }
  return entradas.filter((e) => !presentes.has(e.nombre));
}

export type SeccionDocumento = { titulo: string; lineas: string[] };

/**
 * El documento de normativa partido en secciones para enseñarlo plegado. Una
 * línea en mayúsculas que no es una entrada ("- …") abre sección; el resto
 * va a la sección en curso. Lo de antes de la primera cabecera de grupo (el
 * título y la entradilla del documento) queda en una sección sin título.
 *
 * Funciona también con el documento editado a mano: si la persona añade su
 * propio grupo en mayúsculas, sale como una sección más.
 */
export function seccionesDelDocumento(texto: string): SeccionDocumento[] {
  const secciones: SeccionDocumento[] = [{ titulo: "", lineas: [] }];
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) continue;
    const letras = linea.replace(/[^\p{L}]/gu, "");
    const esCabecera =
      !linea.startsWith("-") && letras.length >= 4 && letras === letras.toUpperCase() && linea.length < 80;
    if (esCabecera && linea !== "BANCO DE NORMATIVA") {
      secciones.push({ titulo: linea, lineas: [] });
      continue;
    }
    secciones.at(-1)!.lineas.push(linea);
  }
  return secciones.filter((s) => s.titulo || s.lineas.length);
}
