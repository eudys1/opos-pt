import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { generarBanco, type TipoPedido } from "@/ia/generar-banco";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";

/**
 * Crea preguntas de un tema a partir de su texto.
 *
 * Va por grupos de tipos, no de una tacada: cada petición tiene que caber
 * holgadamente en el límite de tiempo de una función de Vercel (60 s en el plan
 * gratuito), así que el cliente llama dos veces y enseña el progreso.
 *
 * Generar más SUMA al banco: lo creado antes no se borra, porque cada pregunta
 * ya costó una llamada a la IA. Para que sume de verdad, se le pasan a la IA los
 * enunciados existentes y se descartan los repetidos al guardar. Borrar el
 * banco de un tema es una acción aparte y explícita (`reemplazar: true`).
 */

export const maxDuration = 60;

const GRUPOS: Record<string, TipoPedido[]> = {
  escritas: ["test", "corta"],
  tarjetas: ["flashcard", "ley"],
};

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let temaId: string | undefined;
  let grupo: keyof typeof GRUPOS = "escritas";
  let cuantas = 10;
  let reemplazar = false;
  try {
    const cuerpo = (await peticion.json()) as Record<string, unknown>;
    if (typeof cuerpo.temaId === "string") temaId = cuerpo.temaId;
    if (cuerpo.grupo === "escritas" || cuerpo.grupo === "tarjetas") grupo = cuerpo.grupo;
    if (typeof cuerpo.cuantas === "number") cuantas = Math.min(20, Math.max(4, cuerpo.cuantas));
    if (cuerpo.reemplazar === true) reemplazar = true;
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
    const tipos = GRUPOS[grupo];

    // Solo con reemplazar explícito: borrar es tirar dinero ya gastado.
    if (reemplazar) {
      await ctx.supabase
        .from("items")
        .delete()
        .eq("tema_id", tema.id)
        .eq("origen", "ia")
        .in("tipo", tipos);
    }

    const { data: existentes } = await ctx.supabase
      .from("items")
      .select("enunciado")
      .eq("tema_id", tema.id)
      .is("variante_de", null)
      .in("tipo", tipos);
    const yaHay = (existentes ?? []).map((e) => e.enunciado as string);
    const vistos = new Set(yaHay.map(clave));

    const generado = await generarBanco(
      ctx.ia,
      { numero: tema.numero, titulo: tema.titulo, texto },
      cuantas,
      tipos,
      yaHay,
    );
    const { descartadas, uso } = generado;

    // Por si la IA repite alguna pese a la lista: fuera las que ya estaban.
    const items = generado.items.filter((item) => {
      const k = clave(item.enunciado);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
    const repetidas = generado.items.length - items.length;

    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "No ha salido ninguna pregunta que se pueda comprobar contra tus apuntes. Suele pasar cuando el texto está muy troceado: revísalo y vuelve a intentarlo.",
        },
        { status: 422 },
      );
    }

    const { error: errorInsercion } = await ctx.supabase.from("items").insert(
      items.map((item) => ({
        usuario_id: ctx.usuario.id,
        tema_id: tema.id,
        tipo: item.tipo,
        enunciado: item.enunciado,
        opciones: item.tipo === "test" ? item.opciones : null,
        correcta: item.tipo === "test" ? item.correcta : null,
        respuesta: item.tipo === "test" ? null : item.respuesta,
        pide: item.pide.trim() || null,
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
      descartadas: descartadas + repetidas,
      total: yaHay.length + items.length,
      porTipo: contarPorTipo(items),
      gastoMes,
    });
  } catch (error) {
    return NextResponse.json({ error: mensajeDeError(error) }, { status: 500 });
  }
}

/** Para comparar enunciados: sin mayúsculas, tildes ni puntuación. */
function clave(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contarPorTipo(items: { tipo: string }[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.tipo] = (acc[item.tipo] ?? 0) + 1;
    return acc;
  }, {});
}
