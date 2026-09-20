import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { generarBanco } from "@/ia/generar-banco";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";

/** Crea el banco de preguntas de un tema a partir de su texto. */

export const maxDuration = 300;

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let temaId: string | undefined;
  let cuantas = 20;
  try {
    const cuerpo = (await peticion.json()) as { temaId?: unknown; cuantas?: unknown };
    if (typeof cuerpo.temaId === "string") temaId = cuerpo.temaId;
    if (typeof cuerpo.cuantas === "number") cuantas = Math.min(40, Math.max(5, cuerpo.cuantas));
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (!temaId) {
    return NextResponse.json({ error: "Falta el tema." }, { status: 400 });
  }

  const { data: tema, error } = await ctx.supabase
    .from("temas")
    .select("id, numero, titulo, texto, estado_contenido")
    .eq("id", temaId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tema) return NextResponse.json({ error: "Ese tema no existe." }, { status: 404 });

  const texto = (tema.texto ?? "").trim();
  if (texto.split(/\s+/).length < 120) {
    return NextResponse.json(
      {
        error:
          "Este tema tiene muy poco texto para sacar preguntas. Sube más apuntes o escribe algo más.",
      },
      { status: 400 },
    );
  }

  try {
    const { items, descartadas, uso } = await generarBanco(
      ctx.ia,
      { numero: tema.numero, titulo: tema.titulo, texto },
      cuantas,
    );

    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "No ha salido ninguna pregunta que se pueda comprobar contra tus apuntes. Suele pasar cuando el texto está muy troceado: revísalo y vuelve a intentarlo.",
        },
        { status: 422 },
      );
    }

    // Se reemplaza el banco anterior de este tema: así no se acumulan preguntas
    // viejas de una versión de los apuntes que ya no existe.
    await ctx.supabase
      .from("items")
      .delete()
      .eq("tema_id", tema.id)
      .eq("origen", "ia");

    const { error: errorInsercion } = await ctx.supabase.from("items").insert(
      items.map((item) => ({
        usuario_id: ctx.usuario.id,
        tema_id: tema.id,
        tipo: item.tipo,
        enunciado: item.enunciado,
        opciones: item.tipo === "test" ? item.opciones : null,
        correcta: item.tipo === "test" ? item.correcta : null,
        respuesta: item.tipo === "test" ? null : item.respuesta,
        explicacion: item.explicacion,
        cita: item.cita,
        origen: "ia",
        desde_borrador: tema.estado_contenido === "borrador_ia",
      })),
    );

    if (errorInsercion) {
      return NextResponse.json({ error: errorInsercion.message }, { status: 500 });
    }

    const gastoMes = await registrarUso(ctx, "banco", MODELOS.banco, uso);

    return NextResponse.json({
      creadas: items.length,
      descartadas,
      porTipo: contarPorTipo(items),
      gastoMes,
    });
  } catch (error) {
    return NextResponse.json({ error: mensajeDeError(error) }, { status: 500 });
  }
}

function contarPorTipo(items: { tipo: string }[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.tipo] = (acc[item.tipo] ?? 0) + 1;
    return acc;
  }, {});
}
