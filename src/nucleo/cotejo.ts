/**
 * Cotejo literal: compara lo que se escribe de memoria con el texto exacto del
 * tema. Es lo que se hace con la legislación el día del examen: citarla tal
 * cual. Va entero en local, sin IA: es gratis e instantáneo, y no se equivoca
 * con una cifra.
 *
 * Se compara palabra a palabra con la subsecuencia común más larga, así que
 * cuenta el orden y no penaliza de más por una palabra de relleno añadida.
 */

export type PalabraCotejada = {
  /** La palabra tal y como está en el tema, con su puntuación. */
  texto: string;
  recordada: boolean;
  /** Números, fechas y siglas: lo que más pesa al citar una norma. */
  clave: boolean;
};

export type Cotejo = {
  /** Porcentaje del texto original recordado, en orden. */
  porcentaje: number;
  palabras: PalabraCotejada[];
  /** Datos clave (números, fechas, siglas) que faltan. */
  datosQueFaltan: string[];
  veredicto: "literal" | "casi" | "incompleto";
  /** Lo que cuenta como acierto para la cola de fallos. */
  acierto: boolean;
};

function normalizar(palabra: string): string {
  return palabra
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}/]/gu, "");
}

function trocear(texto: string): string[] {
  return texto.split(/\s+/).filter((p) => normalizar(p).length > 0);
}

function esClave(palabra: string): boolean {
  const limpia = palabra.replace(/[^\p{L}\p{N}/]/gu, "");
  return /\d/.test(limpia) || (limpia.length >= 2 && limpia === limpia.toUpperCase() && /\p{L}/u.test(limpia));
}

/** Índices del original que forman parte de la subsecuencia común más larga. */
function subsecuenciaComun(a: string[], b: string[]): Set<number> {
  const n = a.length;
  const m = b.length;
  const tabla: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      tabla[i][j] = a[i] === b[j] ? tabla[i + 1][j + 1] + 1 : Math.max(tabla[i + 1][j], tabla[i][j + 1]);
    }
  }
  const usados = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      usados.add(i);
      i += 1;
      j += 1;
    } else if (tabla[i + 1][j] >= tabla[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return usados;
}

export function cotejarLiteral(escrito: string, original: string): Cotejo {
  const palabrasOriginal = trocear(original);
  const a = palabrasOriginal.map(normalizar);
  const b = trocear(escrito).map(normalizar);

  const recordadas = subsecuenciaComun(a, b);

  const palabras: PalabraCotejada[] = palabrasOriginal.map((texto, i) => ({
    texto,
    recordada: recordadas.has(i),
    clave: esClave(texto),
  }));

  const porcentaje = a.length ? Math.round((recordadas.size / a.length) * 100) : 0;
  const datosQueFaltan = palabras.filter((p) => p.clave && !p.recordada).map((p) => p.texto);

  const veredicto: Cotejo["veredicto"] =
    porcentaje >= 90 && datosQueFaltan.length === 0
      ? "literal"
      : porcentaje >= 70
        ? "casi"
        : "incompleto";

  return {
    porcentaje,
    palabras,
    datosQueFaltan,
    veredicto,
    acierto: porcentaje >= 85 && datosQueFaltan.length === 0,
  };
}
