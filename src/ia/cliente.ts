import Anthropic from "@anthropic-ai/sdk";

/**
 * Acceso a la API de Claude. Solo desde el servidor: la clave nunca sale de aquí.
 */

export const MODELOS = {
  /** Lectura de apuntes manuscritos y PDF. Elegido en el plan por coste. */
  lectura: process.env.MODELO_LECTURA ?? "claude-sonnet-5",
  /** Generación del banco de preguntas de un tema. Una vez por tema. */
  banco: process.env.MODELO_BANCO ?? "claude-sonnet-5",
  /** Correcciones cortas del día a día: baratas y frecuentes. */
  correccion: process.env.MODELO_CORRECCION ?? "claude-haiku-4-5",
  /** Corrección de simulacros y supuestos: lo que más se juega. */
  examen: process.env.MODELO_EXAMEN ?? "claude-sonnet-5",
} as const;

/** Precio por millón de tokens, en dólares. Tabla de junio de 2026. */
const PRECIOS: Record<string, { entrada: number; salida: number; cacheLectura: number }> = {
  "claude-opus-5": { entrada: 5, salida: 25, cacheLectura: 0.5 },
  "claude-sonnet-5": { entrada: 2, salida: 10, cacheLectura: 0.2 },
  "claude-haiku-4-5": { entrada: 1, salida: 5, cacheLectura: 0.1 },
};

export type Uso = {
  tokensEntrada: number;
  tokensSalida: number;
  tokensCacheLectura: number;
  costeEstimado: number;
};

export function calcularUso(
  modelo: string,
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null },
): Uso {
  const precio = PRECIOS[modelo] ?? PRECIOS["claude-sonnet-5"];
  const cache = usage.cache_read_input_tokens ?? 0;
  const costeEstimado =
    (usage.input_tokens * precio.entrada +
      usage.output_tokens * precio.salida +
      cache * precio.cacheLectura) /
    1_000_000;

  return {
    tokensEntrada: usage.input_tokens,
    tokensSalida: usage.output_tokens,
    tokensCacheLectura: cache,
    costeEstimado: Number(costeEstimado.toFixed(5)),
  };
}

/** Tope de gasto mensual por persona, en dólares. Ajustable por entorno. */
export const LIMITE_MENSUAL = Number(process.env.LIMITE_IA_MENSUAL ?? 15);

export function clienteIA(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Falta ANTHROPIC_API_KEY en .env.local.");
  }
  return new Anthropic({ apiKey });
}
