import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { corregirSupuesto, notaPonderada } from "@/ia/supuestos";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";

/** Corrige la respuesta a un supuesto con su rúbrica y guarda la nota. */

export const maxDuration = 300;

type Rubrica = { criterio: string; peso: number; queSeEspera: string };

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let supuestoId: string | undefined;
  let texto = "";
  let minutos: number | undefined;
  let desdeFoto = false;
  try {
    const cuerpo = (await peticion.json()) as Record<string, unknown>;
    if (typeof cuerpo.supuestoId === "string") supuestoId = cuerpo.supuestoId;
    if (typeof cuerpo.texto === "string") texto = cuerpo.texto.slice(0, 60000);
    if (typeof cuerpo.minutos === "number") minutos = Math.round(cuerpo.minutos);
    desdeFoto = cuerpo.desdeFoto === true;
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (!supuestoId || texto.trim().length < 100) {
    return NextResponse.json(
      { error: "Falta el supuesto o la respuesta es demasiado corta para corregirla." },
      { status: 400 },
    );
  }

  const { data: supuesto, error } = await ctx.supabase
    .from("supuestos")
    .select("id, enunciado, cuestiones, rubrica, solucion")
    .eq("id", supuestoId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!supuesto) return NextResponse.json({ error: "Ese supuesto no existe." }, { status: 404 });

  const rubrica = (supuesto.rubrica ?? []) as Rubrica[];

  try {
    const { correccion, uso } = await corregirSupuesto(ctx.ia, {
      enunciado: supuesto.enunciado,
      cuestiones: (supuesto.cuestiones ?? []) as string[],
      rubrica,
      solucion: supuesto.solucion,
      respuesta: texto,
      desdeFoto,
    });

    // La media se recalcula aquí: la nota que manda es la de los pesos.
    const nota = rubrica.length > 0 ? notaPonderada(correccion.porCriterio, rubrica) : correccion.notaGlobal;
    const corregida = { ...correccion, notaGlobal: nota };

    const { data: guardada, error: errorInsercion } = await ctx.supabase
      .from("respuestas_supuesto")
      .insert({
        usuario_id: ctx.usuario.id,
        supuesto_id: supuesto.id,
        texto,
        correccion: corregida,
        nota,
        minutos: minutos ?? null,
      })
      .select("id")
      .single();

    if (errorInsercion) {
      return NextResponse.json({ error: errorInsercion.message }, { status: 500 });
    }

    const gastoMes = await registrarUso(ctx, "correccion-supuesto", MODELOS.examen, uso);
    return NextResponse.json({ id: guardada.id, correccion: corregida, gastoMes });
  } catch (e) {
    return NextResponse.json({ error: mensajeDeError(e) }, { status: 500 });
  }
}
