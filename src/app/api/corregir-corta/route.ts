import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { corregirCorta } from "@/ia/corregir-corta";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";
import { moverEnLaCola } from "@/datos/cola-fallos";

/** Corrige una respuesta corta y mueve la pregunta en la cola de fallos. */

export const maxDuration = 120;

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let itemId: string | undefined;
  let respuesta = "";
  try {
    const cuerpo = (await peticion.json()) as { itemId?: unknown; respuesta?: unknown };
    if (typeof cuerpo.itemId === "string") itemId = cuerpo.itemId;
    if (typeof cuerpo.respuesta === "string") respuesta = cuerpo.respuesta.slice(0, 8000);
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (!itemId || !respuesta.trim()) {
    return NextResponse.json({ error: "Falta la pregunta o la respuesta." }, { status: 400 });
  }

  const { data: item, error } = await ctx.supabase
    .from("items")
    .select("id, tema_id, enunciado, respuesta, cita")
    .eq("id", itemId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Esa pregunta no existe." }, { status: 404 });

  try {
    const { correccion, uso } = await corregirCorta(ctx.ia, {
      enunciado: item.enunciado,
      modelo: item.respuesta ?? "",
      cita: item.cita,
      respuesta,
    });

    await ctx.supabase.from("intentos").insert({
      usuario_id: ctx.usuario.id,
      item_id: item.id,
      respuesta,
      acierto: correccion.acierto,
      feedback: correccion,
    });

    await moverEnLaCola(ctx.supabase, ctx.usuario.id, item.id, item.tema_id, correccion.acierto);
    const gastoMes = await registrarUso(ctx, "correccion", MODELOS.correccion, uso);

    return NextResponse.json({ correccion, gastoMes });
  } catch (e) {
    return NextResponse.json({ error: mensajeDeError(e) }, { status: 500 });
  }
}
