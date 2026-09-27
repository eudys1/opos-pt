import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { crearVariantes, type ItemOriginal } from "@/ia/variantes";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";

/**
 * Crea variantes de las preguntas falladas que aún no las tengan.
 *
 * Se llama al empezar un repaso de fallos, en tandas de pocas preguntas para
 * caber en el límite de tiempo de Vercel. Lo que ya tiene variantes se salta:
 * cada pregunta se paga una sola vez.
 *
 * La legislación no tiene variantes: una cita literal solo se puede pedir de
 * una forma.
 */

export const maxDuration = 60;

const POR_TANDA = 6;

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let itemIds: string[] = [];
  try {
    const cuerpo = (await peticion.json()) as { itemIds?: unknown };
    if (Array.isArray(cuerpo.itemIds)) {
      itemIds = cuerpo.itemIds.filter((id): id is string => typeof id === "string");
    }
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }
  if (itemIds.length === 0) return NextResponse.json({ creadas: 0, pendientes: 0 });

  // Las que ya tienen variantes no se vuelven a pagar.
  const { data: conVariantes } = await ctx.supabase
    .from("items")
    .select("variante_de")
    .in("variante_de", itemIds);
  const yaTienen = new Set((conVariantes ?? []).map((f) => f.variante_de as string));

  const { data: originales, error } = await ctx.supabase
    .from("items")
    .select("id, tema_id, tipo, enunciado, opciones, correcta, respuesta, cita, pide, desde_borrador")
    .in("id", itemIds.filter((id) => !yaTienen.has(id)))
    .in("tipo", ["test", "corta", "flashcard"])
    .not("cita", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const faltan = originales ?? [];
  const tanda = faltan.slice(0, POR_TANDA);
  if (tanda.length === 0) return NextResponse.json({ creadas: 0, pendientes: 0 });

  try {
    const { variantes, uso } = await crearVariantes(ctx.ia, tanda as ItemOriginal[]);
    const porId = new Map(tanda.map((t) => [t.id, t]));

    if (variantes.length > 0) {
      const { error: errorInsercion } = await ctx.supabase.from("items").insert(
        variantes.map((v) => {
          const original = porId.get(v.itemId)!;
          return {
            usuario_id: ctx.usuario.id,
            tema_id: original.tema_id,
            tipo: v.tipo,
            enunciado: v.enunciado,
            opciones: v.tipo === "test" ? v.opciones : null,
            correcta: v.tipo === "test" ? v.correcta : null,
            respuesta: v.tipo === "test" ? null : v.respuesta,
            explicacion: v.explicacion,
            cita: v.cita,
            pide: v.pide.trim() || null,
            origen: "ia",
            desde_borrador: original.desde_borrador,
            variante_de: v.itemId,
          };
        }),
      );
      if (errorInsercion) {
        return NextResponse.json({ error: errorInsercion.message }, { status: 500 });
      }
    }

    const gastoMes = await registrarUso(ctx, "variantes", MODELOS.correccion, uso);
    return NextResponse.json({
      creadas: variantes.length,
      pendientes: faltan.length - tanda.length,
      gastoMes,
    });
  } catch (e) {
    return NextResponse.json({ error: mensajeDeError(e) }, { status: 500 });
  }
}
