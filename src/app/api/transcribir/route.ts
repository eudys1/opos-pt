import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { leerApuntes } from "@/ia/leer-apuntes";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";

/**
 * Pasa a texto una o dos páginas del almacén.
 *
 * La usa la entrega en papel de los simulacros: el cliente va llamando hoja a
 * hoja y enseña el progreso, en vez de una petición larga que se quedaría sin
 * tiempo en el servidor.
 */

export const maxDuration = 60;

const MAXIMO_POR_PETICION = 2;

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let rutas: string[] = [];
  try {
    const cuerpo = (await peticion.json()) as { rutas?: unknown };
    if (Array.isArray(cuerpo.rutas)) {
      rutas = cuerpo.rutas
        .filter((r): r is string => typeof r === "string")
        .slice(0, MAXIMO_POR_PETICION);
    }
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (rutas.length === 0) {
    return NextResponse.json({ error: "No has indicado ninguna página." }, { status: 400 });
  }

  // Solo se leen archivos de la propia carpeta: la ruta empieza por su id.
  if (rutas.some((ruta) => !ruta.startsWith(`${ctx.usuario.id}/`))) {
    return NextResponse.json({ error: "Esa página no es tuya." }, { status: 403 });
  }

  try {
    const trozos: string[] = [];
    let gastoMes = ctx.gastoMes;

    for (const ruta of rutas) {
      const { data: archivo, error } = await ctx.supabase.storage.from("apuntes").download(ruta);
      if (error || !archivo) {
        throw new Error(error?.message ?? "No se ha podido descargar la página.");
      }
      const datos = Buffer.from(await archivo.arrayBuffer()).toString("base64");
      const { texto, uso } = await leerApuntes(ctx.ia, {
        tipoMime: archivo.type || "image/jpeg",
        datos,
        nombre: ruta.split("/").pop() ?? "página",
      });
      trozos.push(texto);
      gastoMes = await registrarUso(ctx, "lectura-examen", MODELOS.lectura, uso);
    }

    return NextResponse.json({ texto: trozos.join("\n\n"), gastoMes });
  } catch (error) {
    return NextResponse.json({ error: mensajeDeError(error) }, { status: 500 });
  }
}
