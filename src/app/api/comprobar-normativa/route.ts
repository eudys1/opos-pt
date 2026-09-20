import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { comprobarNormativa } from "@/ia/comprobar-normativa";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";
import { detectarNormas } from "@/nucleo/normas";

/**
 * Comprueba si la normativa citada en los temas sigue vigente.
 * Solo se ejecuta cuando alguien pulsa el botón: no hay ningún proceso
 * automático detrás.
 */

// 300 s es el máximo que admite el plan gratuito de Vercel. Buscar doce normas
// en fuentes oficiales cabe de sobra, y si algún día no cupiera habría que
// partir la comprobación en tandas, no subir este número.
export const maxDuration = 300;

const MAXIMO_NORMAS = 12;

export async function POST() {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  const { data: temas, error } = await ctx.supabase
    .from("temas")
    .select("numero, texto")
    .neq("estado_contenido", "sin_contenido");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const normas = detectarNormas((temas ?? []).map((t) => ({ numero: t.numero, texto: t.texto ?? "" })));

  if (normas.length === 0) {
    return NextResponse.json(
      {
        error:
          "No he encontrado ninguna norma citada en tus temas. Sube algún tema con normativa y vuelve a intentarlo.",
      },
      { status: 400 },
    );
  }

  const aRevisar = normas.slice(0, MAXIMO_NORMAS);

  try {
    const { hallazgos, uso } = await comprobarNormativa(
      ctx.ia,
      aRevisar.map((n) => ({ nombre: n.nombre, temas: n.temas })),
    );

    if (hallazgos.length === 0) {
      return NextResponse.json(
        { error: "La comprobación no ha devuelto resultados legibles. Vuelve a intentarlo." },
        { status: 502 },
      );
    }

    // Se guarda el estado de cada norma y la revisión entera, para el historial.
    await ctx.supabase.from("normas").upsert(
      hallazgos.map((h) => ({
        usuario_id: ctx.usuario.id,
        nombre: h.nombre,
        temas: h.temas,
        estado: h.estado,
        resumen: h.resumen,
        enlace: h.enlace || null,
        comprobada_en: new Date().toISOString(),
      })),
      { onConflict: "usuario_id,nombre" },
    );

    await ctx.supabase.from("revisiones_normativa").insert({
      usuario_id: ctx.usuario.id,
      hallazgos,
      normas_revisadas: aRevisar.length,
    });

    const gastoMes = await registrarUso(ctx, "normativa", MODELOS.examen, uso);

    return NextResponse.json({
      hallazgos,
      detectadas: normas.length,
      revisadas: aRevisar.length,
      gastoMes,
    });
  } catch (e) {
    return NextResponse.json({ error: mensajeDeError(e) }, { status: 500 });
  }
}
