import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { leerApuntes } from "@/ia/leer-apuntes";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";

/**
 * Lee los archivos que se le indiquen y guarda su transcripción.
 *
 * Va por tandas cortas: el cliente llama varias veces y enseña el progreso, así
 * cada petición cabe en el límite de tiempo del servidor (60 s en el plan
 * gratuito de Vercel). Todo pasa por la sesión: un archivo de otra persona ni
 * siquiera es visible.
 */

export const maxDuration = 60;

const MAXIMO_POR_PETICION = 3;

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let archivoIds: string[] = [];
  try {
    const cuerpo = (await peticion.json()) as { archivoIds?: unknown };
    if (Array.isArray(cuerpo.archivoIds)) {
      archivoIds = cuerpo.archivoIds
        .filter((id): id is string => typeof id === "string")
        .slice(0, MAXIMO_POR_PETICION);
    }
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (archivoIds.length === 0) {
    return NextResponse.json({ error: "No has indicado ningún archivo." }, { status: 400 });
  }

  const { data: archivos, error } = await ctx.supabase
    .from("archivos_tema")
    .select("id, ruta, nombre, tipo_mime")
    .in("id", archivoIds)
    .order("orden");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!archivos || archivos.length === 0) {
    return NextResponse.json({ error: "No se han encontrado esos archivos." }, { status: 404 });
  }

  const resultados: { id: string; estado: "leido" | "error"; texto?: string; error?: string }[] = [];
  let gastoMes = ctx.gastoMes;

  for (const archivo of archivos) {
    await ctx.supabase.from("archivos_tema").update({ estado: "leyendo" }).eq("id", archivo.id);

    try {
      const { data: descarga, error: errorDescarga } = await ctx.supabase.storage
        .from("apuntes")
        .download(archivo.ruta);
      if (errorDescarga || !descarga) {
        throw new Error(errorDescarga?.message ?? "No se ha podido descargar el archivo.");
      }

      const datos = Buffer.from(await descarga.arrayBuffer()).toString("base64");
      const { texto, uso } = await leerApuntes(ctx.ia, {
        tipoMime: archivo.tipo_mime,
        datos,
        nombre: archivo.nombre,
      });

      await ctx.supabase
        .from("archivos_tema")
        .update({ estado: "leido", texto, error: null })
        .eq("id", archivo.id);

      gastoMes = await registrarUso(ctx, "lectura", MODELOS.lectura, uso);
      resultados.push({ id: archivo.id, estado: "leido", texto });
    } catch (e: unknown) {
      const mensaje = mensajeDeError(e);
      await ctx.supabase
        .from("archivos_tema")
        .update({ estado: "error", error: mensaje })
        .eq("id", archivo.id);
      resultados.push({ id: archivo.id, estado: "error", error: mensaje });
    }
  }

  return NextResponse.json({ resultados, gastoMes });
}
