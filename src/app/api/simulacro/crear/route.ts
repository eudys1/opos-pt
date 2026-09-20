import { NextResponse } from "next/server";
import { prepararSesion } from "@/ia/guardas";
import { sortearSupuestos, sortearTemas } from "@/nucleo/sorteo";
import { CONFIGURACION_ANDALUCIA } from "@/nucleo/tipos";

/**
 * Monta un simulacro: sortea las bolas y arranca el reloj.
 *
 * El reloj empieza en el servidor (`iniciado_en` es `now()` de la base de
 * datos), así que ni cerrar la pestaña ni cambiar la hora del ordenador dan
 * tiempo extra.
 */

type Modalidad = "tema" | "supuesto" | "completo";

export async function POST(peticion: Request) {
  // Sortear no gasta IA: aquí solo hace falta la sesión, y el tope de gasto
  // del mes no debe impedir empezar un examen.
  const sesion = await prepararSesion();
  if (sesion instanceof NextResponse) return sesion;
  const { supabase, usuario } = sesion;

  let modalidad: Modalidad = "tema";
  let trampa = false;
  try {
    const cuerpo = (await peticion.json()) as { modalidad?: unknown; trampa?: unknown };
    if (cuerpo.modalidad === "tema" || cuerpo.modalidad === "supuesto" || cuerpo.modalidad === "completo") {
      modalidad = cuerpo.modalidad;
    }
    trampa = cuerpo.trampa === true;
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("examen")
    .eq("id", usuario.id)
    .maybeSingle();

  const config = { ...CONFIGURACION_ANDALUCIA, ...(perfil?.examen ?? {}) };

  const duracion =
    modalidad === "completo"
      ? config.minutosExamenCompleto
      : modalidad === "tema"
        ? config.minutosSoloTema
        : config.minutosSoloSupuesto;

  const partes: {
    tipo: "tema" | "supuesto";
    opciones: { id: string; titulo: string; numero?: number }[];
  }[] = [];

  // --- bola de temas -----------------------------------------------------
  if (modalidad === "tema" || modalidad === "completo") {
    const { data: temas, error } = await supabase
      .from("temas")
      .select("id, numero, titulo, estado_estudio")
      .neq("estado_estudio", "por_estudiar");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const estudiados = temas ?? [];
    if (estudiados.length < 2) {
      return NextResponse.json(
        {
          error:
            "Hacen falta al menos dos temas estudiados para poder sortear. Marca alguno más en el registro.",
        },
        { status: 400 },
      );
    }

    const { data: dominios } = await supabase
      .from("dominio_por_tema")
      .select("tema_id, dominio");

    const porTema = new Map((dominios ?? []).map((d) => [d.tema_id, Number(d.dominio ?? 0)]));

    const sorteados = sortearTemas(
      estudiados.map((t) => ({
        id: t.id,
        numero: t.numero,
        titulo: t.titulo,
        dominio: porTema.get(t.id),
      })),
      config.temasSorteados,
      { trampa },
    );

    partes.push({
      tipo: "tema",
      opciones: sorteados.map((t) => ({ id: t.id, titulo: t.titulo, numero: t.numero })),
    });
  }

  // --- bola de supuestos -------------------------------------------------
  if (modalidad === "supuesto" || modalidad === "completo") {
    const { data: supuestos, error } = await supabase
      .from("supuestos")
      .select("id, titulo, necesidad, curso, temas");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if ((supuestos ?? []).length === 0) {
      return NextResponse.json(
        {
          error:
            "No hay supuestos en el banco. Crea alguno en el apartado de Supuestos antes de hacer este simulacro.",
        },
        { status: 400 },
      );
    }

    const sorteados = sortearSupuestos(supuestos ?? [], config.supuestosSorteados);
    partes.push({
      tipo: "supuesto",
      // Sin etiquetas: en el sorteo solo se ve el enunciado, como en el examen.
      opciones: sorteados.map((s) => ({ id: s.id, titulo: s.titulo })),
    });
  }

  const { data: simulacro, error: errorSimulacro } = await supabase
    .from("simulacros")
    .insert({
      usuario_id: usuario.id,
      modalidad,
      duracion_s: duracion * 60,
      trampa,
      estado: "en_curso",
    })
    .select("id, iniciado_en, duracion_s")
    .single();

  if (errorSimulacro) {
    return NextResponse.json({ error: errorSimulacro.message }, { status: 500 });
  }

  const { error: errorPartes } = await supabase.from("simulacro_partes").insert(
    partes.map((parte) => ({
      usuario_id: usuario.id,
      simulacro_id: simulacro.id,
      tipo: parte.tipo,
      opciones: parte.opciones,
    })),
  );

  if (errorPartes) {
    return NextResponse.json({ error: errorPartes.message }, { status: 500 });
  }

  return NextResponse.json({ id: simulacro.id });
}
