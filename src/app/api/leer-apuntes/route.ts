import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { clienteServidor } from "@/datos/supabase-servidor";
import { LIMITE_MENSUAL, MODELOS, clienteIA } from "@/ia/cliente";
import { leerApuntes } from "@/ia/leer-apuntes";

/**
 * Lee los archivos que se le indiquen y guarda su transcripción.
 *
 * Todo pasa por la sesión de la persona: si un archivo no es suyo, la propia
 * base de datos lo esconde. La clave de la API nunca sale del servidor.
 */

export const maxDuration = 300;

type Peticion = { archivoIds?: unknown };

export async function POST(peticion: Request) {
  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  const usuario = sesion.user;

  if (!usuario) {
    return NextResponse.json(
      { error: "Hay que entrar con tu cuenta para leer apuntes." },
      { status: 401 },
    );
  }

  let cuerpo: Peticion;
  try {
    cuerpo = (await peticion.json()) as Peticion;
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const archivoIds = Array.isArray(cuerpo.archivoIds)
    ? cuerpo.archivoIds.filter((id): id is string => typeof id === "string").slice(0, 20)
    : [];

  if (archivoIds.length === 0) {
    return NextResponse.json({ error: "No has indicado ningún archivo." }, { status: 400 });
  }

  // Freno de gasto antes de llamar a la API.
  const { data: gastado } = await supabase.rpc("gasto_del_mes");
  const gastoMes = Number(gastado ?? 0);
  if (gastoMes >= LIMITE_MENSUAL) {
    return NextResponse.json(
      {
        error: `Has llegado al límite de gasto de este mes (${LIMITE_MENSUAL} $). Se reinicia el día 1, o puedes subirlo en .env.local.`,
        gastoMes,
      },
      { status: 429 },
    );
  }

  const { data: archivos, error: errorArchivos } = await supabase
    .from("archivos_tema")
    .select("id, ruta, nombre, tipo_mime")
    .in("id", archivoIds)
    .order("orden");

  if (errorArchivos) {
    return NextResponse.json({ error: errorArchivos.message }, { status: 500 });
  }
  if (!archivos || archivos.length === 0) {
    return NextResponse.json({ error: "No se han encontrado esos archivos." }, { status: 404 });
  }

  const ia = clienteIA();
  const resultados: { id: string; estado: "leido" | "error"; texto?: string; error?: string }[] = [];
  let gastoAcumulado = gastoMes;

  for (const archivo of archivos) {
    if (gastoAcumulado >= LIMITE_MENSUAL) {
      resultados.push({
        id: archivo.id,
        estado: "error",
        error: "Se ha alcanzado el límite de gasto del mes a mitad de la tanda.",
      });
      continue;
    }

    await supabase.from("archivos_tema").update({ estado: "leyendo" }).eq("id", archivo.id);

    try {
      const { data: descarga, error: errorDescarga } = await supabase.storage
        .from("apuntes")
        .download(archivo.ruta);
      if (errorDescarga || !descarga) {
        throw new Error(errorDescarga?.message ?? "No se ha podido descargar el archivo.");
      }

      const datos = Buffer.from(await descarga.arrayBuffer()).toString("base64");
      const { texto, uso } = await leerApuntes(ia, {
        tipoMime: archivo.tipo_mime,
        datos,
        nombre: archivo.nombre,
      });

      await supabase
        .from("archivos_tema")
        .update({ estado: "leido", texto, error: null })
        .eq("id", archivo.id);

      await supabase.from("uso_ia").insert({
        usuario_id: usuario.id,
        tarea: "lectura",
        modelo: MODELOS.lectura,
        tokens_entrada: uso.tokensEntrada,
        tokens_salida: uso.tokensSalida,
        tokens_cache_lectura: uso.tokensCacheLectura,
        coste_estimado: uso.costeEstimado,
      });

      gastoAcumulado += uso.costeEstimado;
      resultados.push({ id: archivo.id, estado: "leido", texto });
    } catch (error: unknown) {
      const mensaje = mensajeDeError(error);
      await supabase
        .from("archivos_tema")
        .update({ estado: "error", error: mensaje })
        .eq("id", archivo.id);
      resultados.push({ id: archivo.id, estado: "error", error: mensaje });
    }
  }

  return NextResponse.json({
    resultados,
    gastoMes: Number(gastoAcumulado.toFixed(5)),
    limiteMensual: LIMITE_MENSUAL,
  });
}

function mensajeDeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "La clave de Anthropic no es válida. Revisa ANTHROPIC_API_KEY en .env.local.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "La API está saturada ahora mismo. Espera un minuto y vuelve a intentarlo.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `La API ha rechazado el archivo: ${error.message}`;
  }
  if (error instanceof Anthropic.APIError) {
    return `Error de la API (${error.status}): ${error.message}`;
  }
  return error instanceof Error ? error.message : "Error desconocido al leer el archivo.";
}
