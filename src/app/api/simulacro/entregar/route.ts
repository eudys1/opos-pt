import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { corregirTema, CRITERIOS_TEMA } from "@/ia/corregir-tema";
import { corregirSupuesto, notaPonderada } from "@/ia/supuestos";
import { leerApuntes } from "@/ia/leer-apuntes";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";

/**
 * Entrega de un simulacro: transcribe las fotos si las hay, corrige cada parte
 * por separado y guarda las notas.
 *
 * Se acepta la entrega aunque el tiempo se haya pasado —en el examen también se
 * entrega—, pero queda registrado cuántos minutos se han usado de verdad.
 */

export const maxDuration = 800;

type Entrega = { parteId: string; texto?: string; fotos?: string[] };
type Rubrica = { criterio: string; peso: number; queSeEspera: string };

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let simulacroId: string | undefined;
  let entregas: Entrega[] = [];
  try {
    const cuerpo = (await peticion.json()) as { simulacroId?: unknown; partes?: unknown };
    if (typeof cuerpo.simulacroId === "string") simulacroId = cuerpo.simulacroId;
    if (Array.isArray(cuerpo.partes)) entregas = cuerpo.partes as Entrega[];
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (!simulacroId || entregas.length === 0) {
    return NextResponse.json({ error: "Falta el simulacro o lo entregado." }, { status: 400 });
  }

  const { data: simulacro } = await ctx.supabase
    .from("simulacros")
    .select("id, modalidad, iniciado_en, duracion_s, estado")
    .eq("id", simulacroId)
    .maybeSingle();

  if (!simulacro) return NextResponse.json({ error: "Ese simulacro no existe." }, { status: 404 });

  const minutosUsados = Math.round(
    (Date.now() - new Date(simulacro.iniciado_en).getTime()) / 60000,
  );

  const { data: partes } = await ctx.supabase
    .from("simulacro_partes")
    .select("id, tipo, elegido_id, elegido_titulo")
    .eq("simulacro_id", simulacro.id);

  const resultados: {
    parteId: string;
    tipo: string;
    nota: number;
    correccion: unknown;
    transcripcion?: string;
  }[] = [];

  try {
    for (const entrega of entregas) {
      const parte = (partes ?? []).find((p) => p.id === entrega.parteId);
      if (!parte || !parte.elegido_id) continue;

      // 1. Si viene en papel, primero se transcribe.
      let texto = (entrega.texto ?? "").trim();
      let transcripcion: string | undefined;
      const fotos = entrega.fotos ?? [];

      if (fotos.length > 0) {
        const trozos: string[] = [];
        for (const ruta of fotos) {
          const { data: archivo } = await ctx.supabase.storage.from("apuntes").download(ruta);
          if (!archivo) continue;
          const datos = Buffer.from(await archivo.arrayBuffer()).toString("base64");
          const tipo = archivo.type || "image/jpeg";
          const { texto: leido, uso } = await leerApuntes(ctx.ia, {
            tipoMime: tipo,
            datos,
            nombre: ruta.split("/").pop() ?? "página",
          });
          trozos.push(leido);
          await registrarUso(ctx, "lectura-examen", MODELOS.lectura, uso);
        }
        transcripcion = trozos.join("\n\n");
        texto = transcripcion;
      }

      if (texto.length < 100) {
        resultados.push({
          parteId: parte.id,
          tipo: parte.tipo,
          nota: 0,
          correccion: { error: "No hay texto suficiente para corregir esta parte." },
        });
        continue;
      }

      // 2. Corrección, distinta según la parte.
      if (parte.tipo === "tema") {
        const { data: tema } = await ctx.supabase
          .from("temas")
          .select("numero, titulo, texto")
          .eq("id", parte.elegido_id)
          .maybeSingle();

        const { correccion, uso } = await corregirTema(ctx.ia, {
          numero: tema?.numero ?? 0,
          titulo: tema?.titulo ?? parte.elegido_titulo ?? "",
          apuntes: tema?.texto ?? "",
          respuesta: texto,
          desdeFoto: fotos.length > 0,
          minutos: minutosUsados,
        });

        const nota = notaPonderada(correccion.porCriterio, CRITERIOS_TEMA);
        const corregida = { ...correccion, notaGlobal: nota };

        await ctx.supabase
          .from("simulacro_partes")
          .update({
            texto: fotos.length > 0 ? "" : texto,
            transcripcion: transcripcion ?? null,
            fotos,
            correccion: corregida,
            nota,
            minutos: minutosUsados,
            entregado_en: new Date().toISOString(),
          })
          .eq("id", parte.id);

        await registrarUso(ctx, "correccion-tema", MODELOS.examen, uso);
        resultados.push({ parteId: parte.id, tipo: "tema", nota, correccion: corregida, transcripcion });
      } else {
        const { data: supuesto } = await ctx.supabase
          .from("supuestos")
          .select("enunciado, cuestiones, rubrica, solucion")
          .eq("id", parte.elegido_id)
          .maybeSingle();

        const rubrica = (supuesto?.rubrica ?? []) as Rubrica[];
        const { correccion, uso } = await corregirSupuesto(ctx.ia, {
          enunciado: supuesto?.enunciado ?? "",
          cuestiones: (supuesto?.cuestiones ?? []) as string[],
          rubrica,
          solucion: supuesto?.solucion,
          respuesta: texto,
          desdeFoto: fotos.length > 0,
        });

        const nota = rubrica.length > 0 ? notaPonderada(correccion.porCriterio, rubrica) : correccion.notaGlobal;
        const corregida = { ...correccion, notaGlobal: nota };

        await ctx.supabase
          .from("simulacro_partes")
          .update({
            texto: fotos.length > 0 ? "" : texto,
            transcripcion: transcripcion ?? null,
            fotos,
            correccion: corregida,
            nota,
            minutos: minutosUsados,
            entregado_en: new Date().toISOString(),
          })
          .eq("id", parte.id);

        await registrarUso(ctx, "correccion-supuesto", MODELOS.examen, uso);
        resultados.push({ parteId: parte.id, tipo: "supuesto", nota, correccion: corregida, transcripcion });
      }
    }

    // 3. Nota global del simulacro: media de las partes, como en el examen.
    const notas = resultados.map((r) => r.nota).filter((n) => n > 0);
    const notaGlobal = notas.length > 0 ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null;

    await ctx.supabase
      .from("simulacros")
      .update({
        estado: "corregido",
        entregado_en: new Date().toISOString(),
        nota: notaGlobal,
      })
      .eq("id", simulacro.id);

    return NextResponse.json({ resultados, nota: notaGlobal, minutos: minutosUsados });
  } catch (error) {
    return NextResponse.json({ error: mensajeDeError(error) }, { status: 500 });
  }
}
