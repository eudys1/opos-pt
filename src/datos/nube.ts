import type { SupabaseClient } from "@supabase/supabase-js";
import type { Estado } from "@/datos/almacen";
import { ganaLaLocal, marcaDeTiempo, tieneAlgo } from "@/nucleo/sincronia";
import type {
  EstadoContenido,
  EstadoEstudio,
  EventoEstudio,
  Objetivo,
  Tema,
  TipoActividad,
  TipoEvento,
} from "@/nucleo/tipos";

/**
 * Traducción entre el estado de la app y las tablas de Supabase, y la
 * sincronización entre lo guardado en este navegador y lo de la cuenta.
 *
 * Criterio: **nunca se pierde nada**. Las marcas de estudio y los objetivos son
 * listas que solo crecen, así que se unen por id; los temas se quedan con la
 * versión modificada más tarde. Así, si se estudia en el móvil sin conexión y
 * luego se abre el portátil, aparece todo.
 *
 * Los temas se emparejan por su NÚMERO, no por su id: en el navegador son
 * `tema-7` y en la base de datos un uuid.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

type FilaTema = {
  id: string;
  numero: number;
  titulo: string;
  texto: string;
  estado_contenido: EstadoContenido;
  estado_estudio: EstadoEstudio;
  vueltas: number;
  actualizado_en: string;
};

type FilaEvento = {
  id: string;
  tema_id: string | null;
  tipo: TipoEvento;
  numero_repaso: number | null;
  fecha: string;
  minutos: number | null;
  nota: string | null;
  apartados?: string[] | null;
};

type FilaObjetivo = {
  id: string;
  tema_id: string | null;
  fecha: string;
  texto: string;
  automatico: boolean;
  hecho: boolean;
  aplazado_de: string | null;
  tipo?: TipoActividad | null;
  numero_repaso?: number | null;
  apartados?: string[] | null;
};

type FilaPerfil = {
  id: string;
  nombre: string;
  especialidad: string;
  comunidad: string;
  fecha_examen: string | null;
  intervalos_repaso: number[];
  dias_libres_al_mes: number;
  examen: Estado["perfil"]["examen"];
};

export type ResultadoSincronizacion = {
  estado: Estado;
  subidos: { temas: number; eventos: number; objetivos: number };
};

export async function sincronizar(
  sb: SupabaseClient,
  usuarioId: string,
  local: Estado,
): Promise<ResultadoSincronizacion> {
  const [perfilRemoto, temasRemotos, eventosRemotos, objetivosRemotos] = await Promise.all([
    sb.from("perfiles").select("*").eq("id", usuarioId).maybeSingle(),
    sb.from("temas").select("*").eq("usuario_id", usuarioId).order("numero"),
    sb.from("eventos_estudio").select("*").eq("usuario_id", usuarioId),
    sb.from("objetivos").select("*").eq("usuario_id", usuarioId),
  ]);

  for (const r of [perfilRemoto, temasRemotos, eventosRemotos, objetivosRemotos]) {
    if (r.error) throw new Error(r.error.message);
  }

  const filasTema = (temasRemotos.data ?? []) as FilaTema[];

  // Cada tema necesita un id estable en la base de datos: los que no existan
  // todavía se crean ahora, para poder referenciarlos desde eventos y objetivos.
  const idPorNumero = new Map<number, string>();
  for (const fila of filasTema) idPorNumero.set(fila.numero, fila.id);

  const temasFusionados: Tema[] = [];
  const temasASubir: (FilaTema & { usuario_id: string })[] = [];

  for (const temaLocal of local.temas) {
    const remoto = filasTema.find((f) => f.numero === temaLocal.numero);
    const id = remoto?.id ?? uuid();
    idPorNumero.set(temaLocal.numero, id);

    // Regla en src/nucleo/sincronia.ts: nunca se pierde contenido al fusionar.
    const ganaLocal = ganaLaLocal(
      temaLocal,
      remoto
        ? {
            texto: remoto.texto ?? "",
            estadoContenido: remoto.estado_contenido,
            estadoEstudio: remoto.estado_estudio,
            actualizadoEn: remoto.actualizado_en,
          }
        : undefined,
    );
    const fusionado: Tema = ganaLocal || !remoto
      ? { ...temaLocal, id }
      : {
          id,
          numero: remoto.numero,
          titulo: remoto.titulo,
          texto: remoto.texto,
          estadoContenido: remoto.estado_contenido,
          estadoEstudio: remoto.estado_estudio,
          vueltas: remoto.vueltas,
          actualizadoEn: remoto.actualizado_en,
        };

    temasFusionados.push(fusionado);
    if (ganaLocal) {
      temasASubir.push({
        id,
        usuario_id: usuarioId,
        numero: fusionado.numero,
        titulo: fusionado.titulo,
        texto: fusionado.texto,
        estado_contenido: fusionado.estadoContenido,
        estado_estudio: fusionado.estadoEstudio,
        vueltas: fusionado.vueltas,
        actualizado_en: marcaDeTiempo(fusionado.actualizadoEn)
          ? new Date(marcaDeTiempo(fusionado.actualizadoEn)).toISOString()
          : new Date().toISOString(),
      });
    }
  }

  // Los eventos y objetivos locales pueden apuntar a `tema-7`: se traducen.
  const numeroPorIdLocal = new Map(local.temas.map((t) => [t.id, t.numero]));
  const idRemotoDeLocal = (temaIdLocal?: string) => {
    if (!temaIdLocal) return null;
    const numero = numeroPorIdLocal.get(temaIdLocal);
    return numero ? (idPorNumero.get(numero) ?? null) : null;
  };
  const idLocalDeRemoto = (temaIdRemoto: string | null) => {
    if (!temaIdRemoto) return undefined;
    const tema = temasFusionados.find((t) => t.id === temaIdRemoto);
    return tema?.id;
  };

  const eventosPorId = new Map<string, EventoEstudio>();
  for (const fila of (eventosRemotos.data ?? []) as FilaEvento[]) {
    eventosPorId.set(fila.id, {
      id: fila.id,
      temaId: idLocalDeRemoto(fila.tema_id),
      tipo: fila.tipo,
      numeroRepaso: fila.numero_repaso ?? undefined,
      fecha: fila.fecha,
      minutos: fila.minutos ?? undefined,
      nota: fila.nota ?? undefined,
      apartados: fila.apartados?.length ? fila.apartados : undefined,
    });
  }

  const eventosASubir = [];
  for (const evento of local.eventos) {
    const id = UUID.test(evento.id) ? evento.id : uuid();
    if (eventosPorId.has(id)) continue;
    const temaId = idRemotoDeLocal(evento.temaId);
    eventosPorId.set(id, { ...evento, id, temaId: temaId ?? undefined });
    eventosASubir.push({
      id,
      usuario_id: usuarioId,
      tema_id: temaId,
      tipo: evento.tipo,
      numero_repaso: evento.numeroRepaso ?? null,
      fecha: evento.fecha,
      minutos: evento.minutos ?? null,
      nota: evento.nota ?? null,
      apartados: evento.apartados?.length ? evento.apartados : null,
    });
  }

  const objetivosPorId = new Map<string, Objetivo>();
  for (const fila of (objetivosRemotos.data ?? []) as FilaObjetivo[]) {
    objetivosPorId.set(fila.id, {
      id: fila.id,
      temaId: idLocalDeRemoto(fila.tema_id),
      fecha: fila.fecha,
      texto: fila.texto,
      automatico: fila.automatico,
      hecho: fila.hecho,
      aplazadoDe: fila.aplazado_de ?? undefined,
      tipo: fila.tipo ?? undefined,
      numeroRepaso: fila.numero_repaso ?? undefined,
      apartados: fila.apartados?.length ? fila.apartados : undefined,
    });
  }

  const objetivosASubir = [];
  for (const objetivo of local.objetivos) {
    const id = UUID.test(objetivo.id) ? objetivo.id : uuid();
    const yaEsta = objetivosPorId.get(id);
    // Un objetivo que ya está arriba puede haberse marcado aquí: se sube el cambio.
    if (
      yaEsta &&
      yaEsta.hecho === objetivo.hecho &&
      yaEsta.fecha === objetivo.fecha &&
      yaEsta.texto === objetivo.texto &&
      yaEsta.tipo === objetivo.tipo &&
      (yaEsta.apartados ?? []).join() === (objetivo.apartados ?? []).join()
    )
      continue;
    const temaId = idRemotoDeLocal(objetivo.temaId);
    // Como en los eventos: el objetivo pasa a apuntar al id del tema en la cuenta,
    // no al provisional del navegador ("tema-7"), que la base no acepta.
    objetivosPorId.set(id, { ...objetivo, id, temaId: temaId ?? undefined });
    objetivosASubir.push({
      id,
      usuario_id: usuarioId,
      tema_id: temaId,
      fecha: objetivo.fecha,
      texto: objetivo.texto,
      automatico: objetivo.automatico ?? false,
      hecho: objetivo.hecho,
      aplazado_de: objetivo.aplazadoDe ?? null,
      tipo: objetivo.tipo ?? "otro",
      numero_repaso: objetivo.numeroRepaso ?? null,
      apartados: objetivo.apartados?.length ? objetivo.apartados : null,
    });
  }

  if (temasASubir.length) {
    const { error } = await sb.from("temas").upsert(temasASubir, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  if (eventosASubir.length) {
    const { error } = await sb.from("eventos_estudio").upsert(eventosASubir, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  if (objetivosASubir.length) {
    const { error } = await sb.from("objetivos").upsert(objetivosASubir, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  const filaPerfil = perfilRemoto.data as FilaPerfil | null;
  const perfil: Estado["perfil"] = filaPerfil
    ? {
        id: filaPerfil.id,
        nombre: filaPerfil.nombre || local.perfil.nombre,
        especialidad: filaPerfil.especialidad,
        comunidad: filaPerfil.comunidad,
        fechaExamen: filaPerfil.fecha_examen ?? local.perfil.fechaExamen ?? undefined,
        intervalosRepaso: filaPerfil.intervalos_repaso ?? local.perfil.intervalosRepaso,
        diasLibresAlMes: filaPerfil.dias_libres_al_mes,
        examen: filaPerfil.examen ?? local.perfil.examen,
      }
    : { ...local.perfil, id: usuarioId };

  // La fecha de examen puesta en este navegador manda si la cuenta no tenía.
  if (filaPerfil && local.perfil.fechaExamen && !filaPerfil.fecha_examen) {
    await sb.from("perfiles").update({ fecha_examen: local.perfil.fechaExamen }).eq("id", usuarioId);
  }

  return {
    estado: {
      perfil,
      temas: temasFusionados,
      eventos: [...eventosPorId.values()],
      objetivos: [...objetivosPorId.values()],
    },
    subidos: {
      temas: temasASubir.length,
      eventos: eventosASubir.length,
      objetivos: objetivosASubir.length,
    },
  };
}

/**
 * Sube el estado tras cada cambio con la sesión abierta.
 *
 * De los temas, solo los que han cambiado (`temasCambiados`), y con su propia
 * hora de modificación. Antes se subían los 25 cada vez con la hora del
 * momento, y eso hacía que cualquier navegador pisara la cuenta entera.
 */
export async function guardarEnLaNube(
  sb: SupabaseClient,
  usuarioId: string,
  estado: Estado,
  temasCambiados: Set<string>,
) {
  const { error: errorPerfil } = await sb
    .from("perfiles")
    .update({
      nombre: estado.perfil.nombre,
      fecha_examen: estado.perfil.fechaExamen ?? null,
      intervalos_repaso: estado.perfil.intervalosRepaso,
      dias_libres_al_mes: estado.perfil.diasLibresAlMes,
      examen: estado.perfil.examen,
    })
    .eq("id", usuarioId);
  if (errorPerfil) throw new Error(errorPerfil.message);

  // Segunda barrera: un tema que nunca se ha tocado en este navegador
  // (actualizadoEn vacío) no se sube jamás, aunque parezca cambiado. Y un tema
  // vacío con fecha de solo día es una copia vieja de antes del arreglo, no
  // algo que la persona haya vaciado: vaciar a mano deja la hora exacta.
  const temas = estado.temas
    .filter((t) => temasCambiados.has(t.id) && UUID.test(t.id) && t.actualizadoEn !== "")
    .filter((t) => tieneAlgo(t) || t.actualizadoEn.length > 10)
    .map((t) => ({
    id: t.id,
    usuario_id: usuarioId,
    numero: t.numero,
    titulo: t.titulo,
    texto: t.texto,
    estado_contenido: t.estadoContenido,
    estado_estudio: t.estadoEstudio,
    vueltas: t.vueltas,
    actualizado_en: marcaDeTiempo(t.actualizadoEn)
      ? new Date(marcaDeTiempo(t.actualizadoEn)).toISOString()
      : new Date().toISOString(),
  }));

  const eventos = estado.eventos
    .filter((e) => UUID.test(e.id))
    .map((e) => ({
      id: e.id,
      usuario_id: usuarioId,
      tema_id: e.temaId ?? null,
      tipo: e.tipo,
      numero_repaso: e.numeroRepaso ?? null,
      fecha: e.fecha,
      minutos: e.minutos ?? null,
      nota: e.nota ?? null,
      apartados: e.apartados?.length ? e.apartados : null,
    }));

  const objetivos = estado.objetivos
    .filter((o) => UUID.test(o.id))
    .map((o) => ({
      id: o.id,
      usuario_id: usuarioId,
      tema_id: o.temaId ?? null,
      fecha: o.fecha,
      texto: o.texto,
      automatico: o.automatico ?? false,
      hecho: o.hecho,
      aplazado_de: o.aplazadoDe ?? null,
      tipo: o.tipo ?? "otro",
      numero_repaso: o.numeroRepaso ?? null,
      apartados: o.apartados?.length ? o.apartados : null,
    }));

  const respuestas = await Promise.all([
    temas.length ? sb.from("temas").upsert(temas, { onConflict: "id" }) : null,
    eventos.length ? sb.from("eventos_estudio").upsert(eventos, { onConflict: "id" }) : null,
    objetivos.length ? sb.from("objetivos").upsert(objetivos, { onConflict: "id" }) : null,
  ]);

  for (const r of respuestas) {
    if (r?.error) throw new Error(r.error.message);
  }
}

/** Borrados: lo que ya no está en el estado local desaparece también arriba. */
export async function borrarObjetivoEnLaNube(sb: SupabaseClient, id: string) {
  if (!UUID.test(id)) return;
  await sb.from("objetivos").delete().eq("id", id);
}

export async function borrarEventoEnLaNube(sb: SupabaseClient, id: string) {
  if (!UUID.test(id)) return;
  await sb.from("eventos_estudio").delete().eq("id", id);
}
