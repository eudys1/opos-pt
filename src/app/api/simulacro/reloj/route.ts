import { NextResponse } from "next/server";
import { prepararSesion } from "@/ia/guardas";
import { segundosDePausa } from "@/nucleo/reloj";

/**
 * Pausar, reanudar o abandonar un simulacro.
 *
 * La hora la pone el servidor, igual que la de inicio: el reloj del navegador
 * no cuenta. Solo los simulacros flexibles se pueden pausar; abandonar vale
 * para los dos y deja el simulacro fuera del historial y de las rondas.
 */

type Accion = "pausar" | "reanudar" | "abandonar";

export async function POST(peticion: Request) {
  const sesion = await prepararSesion();
  if (sesion instanceof NextResponse) return sesion;
  const { supabase } = sesion;

  let id = "";
  let accion: Accion | null = null;
  try {
    const cuerpo = (await peticion.json()) as { id?: unknown; accion?: unknown };
    if (typeof cuerpo.id === "string") id = cuerpo.id;
    if (cuerpo.accion === "pausar" || cuerpo.accion === "reanudar" || cuerpo.accion === "abandonar") {
      accion = cuerpo.accion;
    }
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }
  if (!id || !accion) return NextResponse.json({ error: "Falta el simulacro o la acción." }, { status: 400 });

  const { data: sim, error } = await supabase
    .from("simulacros")
    .select("id, estado, reloj, pausado_en, pausado_total_s, pausas")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sim) return NextResponse.json({ error: "Ese simulacro no existe." }, { status: 404 });
  if (sim.estado !== "en_curso") {
    return NextResponse.json({ error: "Este simulacro ya no está en marcha." }, { status: 409 });
  }

  const ahora = Date.now();
  let cambios: Record<string, unknown>;

  if (accion === "abandonar") {
    cambios = { estado: "abandonado", pausado_en: null };
  } else if (sim.reloj !== "flexible") {
    return NextResponse.json(
      { error: "Un simulacro real no se puede pausar: es como el día del examen." },
      { status: 409 },
    );
  } else if (accion === "pausar") {
    if (sim.pausado_en) return NextResponse.json({ ok: true });
    cambios = { pausado_en: new Date(ahora).toISOString(), pausas: (sim.pausas ?? 0) + 1 };
  } else {
    if (!sim.pausado_en) return NextResponse.json({ ok: true });
    cambios = {
      pausado_en: null,
      pausado_total_s: (sim.pausado_total_s ?? 0) + segundosDePausa(sim.pausado_en, ahora),
    };
  }

  const { error: errorCambio } = await supabase.from("simulacros").update(cambios).eq("id", id);
  if (errorCambio) return NextResponse.json({ error: errorCambio.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
