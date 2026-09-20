import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { corregirTema, CRITERIOS_TEMA } from "@/ia/corregir-tema";
import { corregirSupuesto, notaPonderada } from "@/ia/supuestos";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";

/**
 * Corrige UNA parte del simulacro.
 *
 * Una parte por petición para caber en el límite de tiempo del servidor: el
 * cliente llama una vez por parte y enseña el progreso. Las fotos llegan ya
 * transcritas desde /api/transcribir.
 *
 * Se acepta la entrega aunque el tiempo se haya pasado —en el examen también se
 * entrega—, pero queda registrado cuántos minutos se han usado de verdad.
 */

export const maxDuration = 60;

type Rubrica = { criterio: string; peso: number; queSeEspera: string };

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let parteId: string | undefined;
  let texto = "";
  let fotos: string[] = [];
  let desdeFoto = false;
  try {
    const cuerpo = (await peticion.json()) as Record<string, unknown>;
    if (typeof cuerpo.parteId === "string") parteId = cuerpo.parteId;
    if (typeof cuerpo.texto === "string") texto = cuerpo.texto.slice(0, 80000).trim();
    if (Array.isArray(cuerpo.fotos)) fotos = cuerpo.fotos.filter((f): f is string => typeof f === "string");
    desdeFoto = cuerpo.desdeFoto === true || fotos.length > 0;
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (!parteId) return NextResponse.json({ error: "Falta la parte." }, { status: 400 });
  if (texto.length < 100) {
    return NextResponse.json(
      { error: "Lo entregado es demasiado corto para corregirlo." },
      { status: 400 },
    );
  }

  const { data: parte } = await ctx.supabase
    .from("simulacro_partes")
    .select("id, simulacro_id, tipo, elegido_id, elegido_titulo")
    .eq("id", parteId)
    .maybeSingle();

  if (!parte || !parte.elegido_id) {
    return NextResponse.json({ error: "Esa parte no existe o no tiene nada elegido." }, { status: 404 });
  }

  const { data: simulacro } = await ctx.supabase
    .from("simulacros")
    .select("id, iniciado_en, duracion_s")
    .eq("id", parte.simulacro_id)
    .maybeSingle();

  const minutosUsados = simulacro
    ? Math.round((Date.now() - new Date(simulacro.iniciado_en).getTime()) / 60000)
    : null;

  try {
    let correccion: unknown;
    let nota: number;
    let tarea: string;

    if (parte.tipo === "tema") {
      const { data: tema } = await ctx.supabase
        .from("temas")
        .select("numero, titulo, texto")
        .eq("id", parte.elegido_id)
        .maybeSingle();

      const resultado = await corregirTema(ctx.ia, {
        numero: tema?.numero ?? 0,
        titulo: tema?.titulo ?? parte.elegido_titulo ?? "",
        apuntes: tema?.texto ?? "",
        respuesta: texto,
        desdeFoto,
        minutos: minutosUsados ?? undefined,
      });
      nota = notaPonderada(resultado.correccion.porCriterio, CRITERIOS_TEMA);
      correccion = { ...resultado.correccion, notaGlobal: nota };
      tarea = "correccion-tema";
      await registrarUso(ctx, tarea, MODELOS.examen, resultado.uso);
    } else {
      const { data: supuesto } = await ctx.supabase
        .from("supuestos")
        .select("enunciado, cuestiones, rubrica, solucion")
        .eq("id", parte.elegido_id)
        .maybeSingle();

      const rubrica = (supuesto?.rubrica ?? []) as Rubrica[];
      const resultado = await corregirSupuesto(ctx.ia, {
        enunciado: supuesto?.enunciado ?? "",
        cuestiones: (supuesto?.cuestiones ?? []) as string[],
        rubrica,
        solucion: supuesto?.solucion,
        respuesta: texto,
        desdeFoto,
      });
      nota =
        rubrica.length > 0
          ? notaPonderada(resultado.correccion.porCriterio, rubrica)
          : resultado.correccion.notaGlobal;
      correccion = { ...resultado.correccion, notaGlobal: nota };
      tarea = "correccion-supuesto";
      await registrarUso(ctx, tarea, MODELOS.examen, resultado.uso);
    }

    await ctx.supabase
      .from("simulacro_partes")
      .update({
        texto: desdeFoto ? "" : texto,
        transcripcion: desdeFoto ? texto : null,
        fotos,
        correccion,
        nota,
        minutos: minutosUsados,
        entregado_en: new Date().toISOString(),
      })
      .eq("id", parte.id);

    // Cuando ya están corregidas todas las partes, se cierra el simulacro.
    const { data: todas } = await ctx.supabase
      .from("simulacro_partes")
      .select("nota, entregado_en")
      .eq("simulacro_id", parte.simulacro_id);

    const entregadas = (todas ?? []).filter((p) => p.entregado_en);
    const pendientes = (todas ?? []).length - entregadas.length;

    let notaGlobal: number | null = null;
    if (pendientes === 0 && entregadas.length > 0) {
      const notas = entregadas.map((p) => Number(p.nota ?? 0));
      notaGlobal = Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
      await ctx.supabase
        .from("simulacros")
        .update({ estado: "corregido", entregado_en: new Date().toISOString(), nota: notaGlobal })
        .eq("id", parte.simulacro_id);
    }

    return NextResponse.json({
      parteId: parte.id,
      nota,
      correccion,
      pendientes,
      notaGlobal,
      minutos: minutosUsados,
    });
  } catch (error) {
    return NextResponse.json({ error: mensajeDeError(error) }, { status: 500 });
  }
}
