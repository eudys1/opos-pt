import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { clienteServidor } from "@/datos/supabase-servidor";
import { LIMITE_MENSUAL, clienteIA } from "./cliente";
import type { Uso } from "./cliente";

/**
 * Lo que comparten todas las rutas que llaman a la IA: sesión, tope de gasto,
 * registro de lo consumido y traducción de los errores de la API a algo que se
 * entienda sin ser programador.
 */

export type Contexto = {
  supabase: SupabaseClient;
  usuario: User;
  ia: Anthropic;
  gastoMes: number;
};

export async function prepararLlamada(): Promise<Contexto | NextResponse> {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  const usuario = data.user;

  if (!usuario) {
    return NextResponse.json({ error: "Hay que entrar con tu cuenta." }, { status: 401 });
  }

  const { data: gastado } = await supabase.rpc("gasto_del_mes");
  const gastoMes = Number(gastado ?? 0);

  if (gastoMes >= LIMITE_MENSUAL) {
    return NextResponse.json(
      {
        error: `Has llegado al límite de gasto de este mes (${LIMITE_MENSUAL} $). Se reinicia el día 1, o puedes subirlo en .env.local.`,
        gastoMes,
        limiteMensual: LIMITE_MENSUAL,
      },
      { status: 429 },
    );
  }

  try {
    return { supabase, usuario, ia: clienteIA(), gastoMes };
  } catch (error) {
    return NextResponse.json({ error: mensajeDeError(error) }, { status: 500 });
  }
}

export async function registrarUso(
  ctx: Contexto,
  tarea: string,
  modelo: string,
  uso: Uso,
): Promise<number> {
  await ctx.supabase.from("uso_ia").insert({
    usuario_id: ctx.usuario.id,
    tarea,
    modelo,
    tokens_entrada: uso.tokensEntrada,
    tokens_salida: uso.tokensSalida,
    tokens_cache_lectura: uso.tokensCacheLectura,
    coste_estimado: uso.costeEstimado,
  });
  return Number((ctx.gastoMes + uso.costeEstimado).toFixed(5));
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "La clave de Anthropic no es válida. Revisa ANTHROPIC_API_KEY en .env.local.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "La API está saturada ahora mismo. Espera un minuto y vuelve a intentarlo.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `La API ha rechazado la petición: ${error.message}`;
  }
  if (error instanceof Anthropic.APIError) {
    return `Error de la API (${error.status}): ${error.message}`;
  }
  return error instanceof Error ? error.message : "Error desconocido.";
}
