"use client";

import { useSyncExternalStore } from "react";

/**
 * Tareas largas en segundo plano: crear preguntas, leer apuntes…
 *
 * Antes vivían dentro de la pantalla que las lanzaba, así que al irte a otra
 * sección se perdían a medias: la primera tanda llegaba a guardarse, la
 * segunda nunca se pedía y al volver parecía que no se había hecho nada.
 *
 * Aquí viven fuera de React, en el propio navegador: siguen aunque cambies de
 * pantalla (no si cierras la pestaña o recargas), y cualquier pantalla puede
 * ver cómo van. Un aviso flotante (`AvisoTareas`) las enseña estés donde estés.
 */

export type EstadoTarea = "en_marcha" | "hecha" | "error";

export type Tarea = {
  id: string;
  /** Qué es, para el aviso: "Creando preguntas del tema 3". */
  titulo: string;
  /** Dónde se ve el resultado. */
  enlace?: string;
  pasos: string[];
  paso: number;
  estado: EstadoTarea;
  empezada: number;
  mensaje?: string;
  resultado?: unknown;
};

const tareas = new Map<string, Tarea>();
const escuchas = new Set<() => void>();
let instantanea: Tarea[] = [];

function avisar() {
  instantanea = [...tareas.values()];
  for (const e of escuchas) e();
}

function suscribir(e: () => void) {
  escuchas.add(e);
  return () => {
    escuchas.delete(e);
  };
}

type Contexto = {
  /** Pasa al paso siguiente (su índice). */
  paso: (indice: number) => void;
};

/**
 * Lanza una tarea con un id estable (por ejemplo `banco:<temaId>`). Si ya hay
 * una en marcha con ese id, no se lanza otra: se devuelve la que hay.
 */
export function lanzarTarea(
  id: string,
  datos: { titulo: string; enlace?: string; pasos: string[] },
  trabajo: (ctx: Contexto) => Promise<{ mensaje: string; resultado?: unknown }>,
): void {
  const previa = tareas.get(id);
  if (previa?.estado === "en_marcha") return;

  tareas.set(id, { id, ...datos, paso: 0, estado: "en_marcha", empezada: Date.now() });
  avisar();

  const actualizar = (cambios: Partial<Tarea>) => {
    const t = tareas.get(id);
    if (!t) return;
    tareas.set(id, { ...t, ...cambios });
    avisar();
  };

  trabajo({ paso: (indice) => actualizar({ paso: indice }) })
    .then(({ mensaje, resultado }) => actualizar({ estado: "hecha", mensaje, resultado }))
    .catch((e: unknown) =>
      actualizar({
        estado: "error",
        mensaje: e instanceof Error ? e.message : "No se ha podido terminar.",
      }),
    );
}

/** Quita una tarea terminada del aviso. */
export function descartarTarea(id: string) {
  const t = tareas.get(id);
  if (t && t.estado !== "en_marcha") {
    tareas.delete(id);
    avisar();
  }
}

export function useTareas(): Tarea[] {
  return useSyncExternalStore(
    suscribir,
    () => instantanea,
    () => instantanea,
  );
}

export function useTarea(id: string): Tarea | undefined {
  return useTareas().find((t) => t.id === id);
}

// Si se intenta cerrar la pestaña con algo en marcha, el navegador pregunta.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if ([...tareas.values()].some((t) => t.estado === "en_marcha")) e.preventDefault();
  });
}
