import { NextResponse } from "next/server";
import { MODELOS } from "@/ia/cliente";
import { generarSupuesto } from "@/ia/supuestos";
import { mensajeDeError, prepararLlamada, registrarUso } from "@/ia/guardas";

/** Crea un supuesto práctico a partir de los temas que ya tienen contenido. */

export const maxDuration = 300;

export async function POST(peticion: Request) {
  const ctx = await prepararLlamada();
  if (ctx instanceof NextResponse) return ctx;

  let temaIds: string[] = [];
  let encargo: string | undefined;
  try {
    const cuerpo = (await peticion.json()) as { temaIds?: unknown; peticion?: unknown };
    if (Array.isArray(cuerpo.temaIds)) {
      temaIds = cuerpo.temaIds.filter((id): id is string => typeof id === "string").slice(0, 4);
    }
    if (typeof cuerpo.peticion === "string") encargo = cuerpo.peticion.slice(0, 500);
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  // Sin temas elegidos, se cogen al azar entre los que tienen contenido propio.
  let consulta = ctx.supabase
    .from("temas")
    .select("id, numero, titulo, texto, estado_contenido")
    .neq("estado_contenido", "sin_contenido");
  if (temaIds.length > 0) consulta = consulta.in("id", temaIds);

  const { data: temas, error } = await consulta;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const utiles = (temas ?? []).filter((t) => (t.texto ?? "").trim().split(/\s+/).length > 150);
  if (utiles.length === 0) {
    return NextResponse.json(
      {
        error:
          "Necesito al menos un tema con texto para escribir un supuesto que encaje con lo que estudias.",
      },
      { status: 400 },
    );
  }

  const elegidos = (temaIds.length > 0 ? utiles : barajar(utiles).slice(0, 2)).slice(0, 4);

  try {
    const { supuesto, uso } = await generarSupuesto(ctx.ia, {
      temas: elegidos.map((t) => ({ numero: t.numero, titulo: t.titulo, texto: t.texto ?? "" })),
      peticion: encargo,
    });

    const { data: guardado, error: errorInsercion } = await ctx.supabase
      .from("supuestos")
      .insert({
        usuario_id: ctx.usuario.id,
        titulo: supuesto.titulo,
        enunciado: supuesto.enunciado,
        cuestiones: supuesto.cuestiones,
        necesidad: supuesto.necesidad,
        curso: supuesto.curso,
        temas: supuesto.temas,
        rubrica: supuesto.rubrica,
        solucion: supuesto.solucion,
        origen: "ia",
        visibilidad: "privado",
      })
      .select("id")
      .single();

    if (errorInsercion) {
      return NextResponse.json({ error: errorInsercion.message }, { status: 500 });
    }

    const gastoMes = await registrarUso(ctx, "supuesto", MODELOS.banco, uso);
    return NextResponse.json({ id: guardado.id, titulo: supuesto.titulo, gastoMes });
  } catch (e) {
    return NextResponse.json({ error: mensajeDeError(e) }, { status: 500 });
  }
}

function barajar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
