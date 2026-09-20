import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarFallo, trasResponder, type Fallo } from "@/nucleo/fallos";
import { hoyISO } from "@/nucleo/fechas";

/**
 * Alta, avance o cierre de un fallo según cómo haya ido el intento.
 * Lo usan todas las formas de responder: test, cortas, flashcards y simulacros.
 */
export async function moverEnLaCola(
  supabase: SupabaseClient,
  usuarioId: string,
  itemId: string,
  temaId: string,
  acierto: boolean,
): Promise<void> {
  const hoy = hoyISO();

  const { data: fila } = await supabase
    .from("fallos")
    .select("proxima_fecha, aciertos_seguidos, veces_fallado, resuelto_en")
    .eq("item_id", itemId)
    .maybeSingle();

  const previo: Fallo | undefined = fila
    ? {
        itemId,
        temaId,
        proximaFecha: fila.proxima_fecha,
        aciertosSeguidos: fila.aciertos_seguidos,
        vecesFallado: fila.veces_fallado,
        resueltoEn: fila.resuelto_en ?? undefined,
      }
    : undefined;

  // La cola es solo de fallos: acertar algo que nunca se falló no crea nada,
  // y acertar algo ya superado tampoco lo reabre.
  if (acierto && (!previo || previo.resueltoEn)) return;

  const siguiente = acierto
    ? trasResponder(previo as Fallo, true, hoy)
    : registrarFallo(previo, { itemId, temaId }, hoy);

  await supabase.from("fallos").upsert(
    {
      usuario_id: usuarioId,
      item_id: itemId,
      tema_id: temaId,
      proxima_fecha: siguiente.proximaFecha,
      aciertos_seguidos: siguiente.aciertosSeguidos,
      veces_fallado: siguiente.vecesFallado,
      resuelto_en: siguiente.resueltoEn ? new Date().toISOString() : null,
    },
    { onConflict: "usuario_id,item_id" },
  );
}
