/**
 * La estructura de un tema a partir de su texto plano: título, epígrafes
 * (INTRODUCCIÓN, 1., 2.…), subepígrafes (1.1, 2.3…) y párrafos.
 *
 * El texto que sale de un PDF viene cortado en líneas a mitad de frase. Para
 * leerlo bien se vuelven a unir los párrafos, y los títulos largos que el PDF
 * partió en dos líneas se juntan en uno.
 *
 * Casi todos los temas empiezan con su índice, que repite los epígrafes. El
 * índice lateral se queda con la última aparición de cada uno, que es la del
 * cuerpo del tema, no la del índice.
 */

export type TipoBloque = "titulo" | "epigrafe" | "subepigrafe" | "parrafo";

export type Bloque = { id: string; tipo: TipoBloque; texto: string };

const TITULO = /^TEMA\s+\d+/i;
const EPIGRAFE_FIJO =
  /^(INTRODUCCI[ÓO]N|CONCLUSI[ÓO]N(ES)?|REFERENCIAS\b.*|BIBLIOGRAF[ÍI]A\b.*|FUENTES CONSULTADAS\b.*|WEBGRAF[ÍI]A\b.*)\.?$/i;
const SUBEPIGRAFE = /^\d+\.\d+(\.\d+)*\.?\s+\S/;
const EPIGRAFE_NUMERADO = /^\d+\.?\s+[A-ZÁÉÍÓÚÑ]/;

function esMayusculas(linea: string): boolean {
  const letras = linea.replace(/[^\p{L}]/gu, "");
  return letras.length >= 3 && letras === letras.toUpperCase();
}

function tipoDeLinea(linea: string): TipoBloque | null {
  if (TITULO.test(linea)) return "titulo";
  if (EPIGRAFE_FIJO.test(linea)) return "epigrafe";
  if (SUBEPIGRAFE.test(linea)) return "subepigrafe";
  // "1. EL PROCESO…" es epígrafe; "1 de cada 3 alumnos…" no: exige mayúsculas
  // o que la línea sea corta, como suelen ser los títulos.
  if (EPIGRAFE_NUMERADO.test(linea) && (esMayusculas(linea) || linea.length < 90)) {
    return "epigrafe";
  }
  return null;
}

function idDe(texto: string, usados: Map<string, number>): string {
  const base =
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "bloque";
  const n = usados.get(base) ?? 0;
  usados.set(base, n + 1);
  return n === 0 ? base : `${base}-${n + 1}`;
}

export function estructuraDelTema(texto: string): Bloque[] {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim());
  const bloques: { tipo: TipoBloque; texto: string }[] = [];

  for (const linea of lineas) {
    if (!linea) {
      // Una línea en blanco cierra el párrafo en curso.
      if (bloques.at(-1)?.tipo === "parrafo") bloques.push({ tipo: "parrafo", texto: "" });
      continue;
    }

    const tipo = tipoDeLinea(linea);
    const anterior = bloques.at(-1);

    if (tipo) {
      bloques.push({ tipo, texto: linea });
      continue;
    }

    // Un epígrafe que no terminó y sigue en minúscula en la línea de abajo.
    if (
      anterior &&
      anterior.tipo !== "parrafo" &&
      !/[.:]$/.test(anterior.texto) &&
      /^[a-záéíóúñ]/.test(linea) &&
      !/^https?:/.test(linea)
    ) {
      anterior.texto = `${anterior.texto} ${linea}`;
      continue;
    }

    // Un título partido por el PDF: la línea siguiente sigue en mayúsculas.
    if (anterior && anterior.tipo !== "parrafo" && esMayusculas(linea) && anterior.texto.length > 30) {
      anterior.texto = `${anterior.texto} ${linea}`;
      continue;
    }

    // Continuación de párrafo: la línea anterior no terminó la frase.
    if (anterior?.tipo === "parrafo" && anterior.texto && !/[.:;!?»”"]$/.test(anterior.texto)) {
      anterior.texto = `${anterior.texto} ${linea}`;
      continue;
    }

    if (anterior?.tipo === "parrafo" && !anterior.texto) anterior.texto = linea;
    else bloques.push({ tipo: "parrafo", texto: linea });
  }

  const usados = new Map<string, number>();
  return bloques
    .filter((b) => b.texto.trim())
    .map((b) => ({ ...b, texto: b.texto.replace(/\s+/g, " ").trim(), id: "" }))
    .map((b) => ({ ...b, id: idDe(b.texto, usados) }));
}

/**
 * El índice para navegar: epígrafes y subepígrafes del cuerpo del tema. Si un
 * epígrafe aparece dos veces (índice inicial y cuerpo), se queda el del cuerpo.
 */
export function indiceDelTema(bloques: Bloque[]): Bloque[] {
  // Todo lo que va antes del primer párrafo es el índice que trae el propio
  // tema: sus epígrafes a veces están escritos distinto que en el cuerpo, así
  // que se descartan en bloque en vez de intentar emparejarlos.
  const desde = inicioDelCuerpo(bloques);

  const clave = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const ultimo = new Map<string, number>();
  bloques.forEach((b, i) => {
    if (i >= desde && (b.tipo === "epigrafe" || b.tipo === "subepigrafe")) ultimo.set(clave(b.texto), i);
  });
  return bloques.filter(
    (b, i) =>
      i >= desde && (b.tipo === "epigrafe" || b.tipo === "subepigrafe") && ultimo.get(clave(b.texto)) === i,
  );
}

/** Dónde empieza el cuerpo del tema: justo después de su índice inicial. */
function inicioDelCuerpo(bloques: Bloque[]): number {
  const primerParrafo = bloques.findIndex((b) => b.tipo === "parrafo");
  if (primerParrafo <= 0) return 0;
  return Math.max(
    0,
    bloques.slice(0, primerParrafo).findLastIndex((b) => b.tipo !== "titulo"),
  );
}

/**
 * El tema preparado para oírlo: el título, y desde el cuerpo (sin el índice
 * inicial) epígrafes y párrafos. Fuera la bibliografía y las direcciones web,
 * que en voz alta no sirven de nada.
 */
export function textoParaEscuchar(texto: string): string {
  const bloques = estructuraDelTema(texto);
  const titulo = bloques.find((b) => b.tipo === "titulo");
  const partes: string[] = titulo ? [`${titulo.texto.replace(/[.:]$/, "")}.`] : [];
  let saltando = false;

  for (const b of bloques.slice(inicioDelCuerpo(bloques))) {
    if (b.tipo === "titulo") continue;
    if (b.tipo !== "parrafo") {
      saltando = /bibliogr|medios digitales|webgraf/i.test(b.texto);
      if (!saltando) partes.push(`${b.texto.replace(/[.:]$/, "")}.`);
      continue;
    }
    if (saltando || /https?:|www\./i.test(b.texto)) continue;
    partes.push(b.texto);
  }
  return partes.join("\n\n");
}

/**
 * Dónde está una cita dentro del tema: el párrafo que la contiene y el
 * epígrafe bajo el que cae. Sirve para que una pregunta lleve al sitio exacto
 * de los apuntes del que sale.
 *
 * Las citas no siempre son exactas: la IA puede recortarlas con «…», cambiar
 * una tilde o juntar dos frases. Por eso se busca por trozos normalizados y, si
 * no aparece tal cual, por el párrafo que comparte más palabras con ella. Si
 * nada se parece lo bastante, se devuelve null: mejor no llevar a ningún sitio
 * que llevar al sitio equivocado.
 */
export function ubicarCita(
  bloques: Bloque[],
  cita: string,
): { bloque: Bloque; epigrafe: Bloque | null } | null {
  const trozos = cita
    .split(/…|\.\.\./)
    .map(normalizarParaBuscar)
    .filter((t) => t.split(" ").length >= 3)
    .sort((a, b) => b.length - a.length);
  if (!trozos.length) return null;

  const desde = inicioDelCuerpo(bloques);
  const candidatos = bloques
    .map((b, i) => ({ b, i, norm: normalizarParaBuscar(b.texto) }))
    .filter(({ b, i }) => i >= desde && b.tipo === "parrafo");

  let elegido = candidatos.find((c) => trozos.some((t) => c.norm.includes(t)));

  if (!elegido) {
    const palabras = new Set(trozos[0].split(" ").filter((p) => p.length > 3));
    let mejor = 0;
    for (const c of candidatos) {
      const suyas = new Set(c.norm.split(" "));
      let comunes = 0;
      for (const p of palabras) if (suyas.has(p)) comunes++;
      const parecido = palabras.size ? comunes / palabras.size : 0;
      if (parecido > mejor) {
        mejor = parecido;
        elegido = c;
      }
    }
    if (mejor < 0.6) return null;
  }
  if (!elegido) return null;

  const epigrafe =
    bloques
      .slice(0, elegido.i)
      .findLast((b) => b.tipo === "epigrafe" || b.tipo === "subepigrafe") ?? null;
  return { bloque: elegido.b, epigrafe };
}

function normalizarParaBuscar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
