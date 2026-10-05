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
// Tras el número vale punto, punto y guion, paréntesis o guion: "1.1", "1.1.",
// "1.1.-", "1.1)". Cada academia numera a su manera.
const SUBEPIGRAFE = /^\d+\.\d+(\.\d+)*(\.-|\.|\)|-)?\s+\S/;
const EPIGRAFE_NUMERADO = /^\d+(\.-|\.|\)|-)?\s+[A-ZÁÉÍÓÚÑ]/;
// Numeración romana: "II. MARCO LEGAL", "IV.- MEDIDAS".
const EPIGRAFE_ROMANO = /^[IVXL]{1,5}(\.-|\.|\)|-)\s+\S/;
// Títulos de Markdown, cuando el texto se pega de otro sitio: "# …", "## …".
const MARKDOWN = /^(#{1,3})\s+\S/;

function esMayusculas(linea: string): boolean {
  const letras = linea.replace(/[^\p{L}]/gu, "");
  return letras.length >= 3 && letras === letras.toUpperCase();
}

/**
 * Un título sin número, entero en mayúsculas y corto: "MARCO LEGISLATIVO".
 * Se mira aparte, después de juntar los títulos partidos por el PDF, para no
 * confundir la segunda línea de un título largo con un epígrafe nuevo.
 */
function esTituloSinNumero(linea: string): boolean {
  const letras = linea.replace(/[^\p{L}]/gu, "");
  return (
    esMayusculas(linea) &&
    letras.length >= 8 &&
    linea.length <= 80 &&
    linea.split(/\s+/).length >= 2 &&
    !/[.,;:]$/.test(linea)
  );
}

function tipoDeLinea(linea: string): TipoBloque | null {
  if (TITULO.test(linea)) return "titulo";
  const md = linea.match(MARKDOWN);
  if (md) return md[1].length === 1 ? "epigrafe" : "subepigrafe";
  if (EPIGRAFE_FIJO.test(linea)) return "epigrafe";
  if (SUBEPIGRAFE.test(linea)) return "subepigrafe";
  if (EPIGRAFE_ROMANO.test(linea) && (esMayusculas(linea) || linea.length < 90)) return "epigrafe";
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
      // De un título de Markdown se guarda el texto, sin las almohadillas.
      bloques.push({ tipo, texto: linea.replace(/^#{1,3}\s+/, "") });
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

    // Un título sin número ("MARCO LEGISLATIVO") tras un párrafo terminado.
    const parrafoAbierto = anterior?.tipo === "parrafo" && anterior.texto && !/[.:;!?»”"]$/.test(anterior.texto);
    if (!parrafoAbierto && esTituloSinNumero(linea)) {
      bloques.push({ tipo: "epigrafe", texto: linea });
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

// ---------------------------------------------------------------- apartados

/**
 * Un apartado del tema: un epígrafe o subepígrafe del índice. Su id es el
 * número ("2.1") si lo tiene y, si no, el título en minúsculas
 * ("introduccion"): así sobrevive a que se retoque el texto del tema, y lo
 * guardado (qué apartados repasaste, de cuáles practicar) sigue valiendo.
 */
export type Apartado = {
  id: string;
  /** "2.1", "IV"… o null si el título no lleva número. */
  numero: string | null;
  titulo: string;
  /** 1 para "2.", 2 para "2.1", 3 para "2.1.3". */
  nivel: number;
  bloqueId: string;
};

const NUMERO_DE_TITULO = /^(\d+(?:\.\d+)*|[IVXL]{1,5})(?:\.-|\.|\)|-)?\s+/;

export function apartadosDelTema(texto: string): Apartado[] {
  return apartadosDeBloques(estructuraDelTema(texto));
}

function apartadosDeBloques(bloques: Bloque[]): Apartado[] {
  const usados = new Set<string>();
  return indiceDelTema(bloques).map((b) => {
    const m = b.texto.match(NUMERO_DE_TITULO);
    const numero = m ? m[1] : null;
    const titulo = (m ? b.texto.slice(m[0].length) : b.texto).replace(/[.:]$/, "").trim();
    const nivel =
      numero && /^\d/.test(numero) ? Math.min(3, numero.split(".").length) : b.tipo === "subepigrafe" ? 2 : 1;
    let id = numero ?? (normalizarParaBuscar(titulo).replace(/ /g, "-").slice(0, 40) || b.id);
    while (usados.has(id)) id = `${id}+`;
    usados.add(id);
    return { id, numero, titulo, nivel, bloqueId: b.id };
  });
}

/**
 * Para un tema, a qué apartados pertenece cada cita: el subapartado y el
 * apartado que lo contiene ("2.1" y "2"). Se prepara una vez por tema y se
 * pregunta por cada pregunta, que es lo que hace falta para practicar solo
 * unos apartados. Una cita que no se encuentra no pertenece a ninguno.
 */
export function mapaDeApartados(texto: string): {
  apartados: Apartado[];
  deCita: (cita: string) => string[];
} {
  const bloques = estructuraDelTema(texto);
  const apartados = apartadosDeBloques(bloques);
  const porBloque = new Map(apartados.map((a) => [a.bloqueId, a]));
  return {
    apartados,
    deCita(cita) {
      const sitio = ubicarCita(bloques, cita);
      if (!sitio) return [];
      const i = bloques.findIndex((b) => b.id === sitio.bloque.id);
      // Hacia atrás: el apartado más cercano y los de nivel superior que lo contienen.
      const cadena: Apartado[] = [];
      for (let j = i - 1; j >= 0; j--) {
        const a = porBloque.get(bloques[j].id);
        if (!a) continue;
        if (!cadena.length || a.nivel < cadena[cadena.length - 1].nivel) cadena.push(a);
        if (a.nivel === 1) break;
      }
      return cadena.map((a) => a.id);
    },
  };
}

/** Cómo se nombra un apartado guardado: "2.1 Dictamen de escolarización", o su id si ya no existe. */
export function nombreDeApartado(apartados: Apartado[], id: string): string {
  const a = apartados.find((x) => x.id === id);
  return a ? `${a.numero ? `${a.numero} ` : ""}${a.titulo}` : id;
}
