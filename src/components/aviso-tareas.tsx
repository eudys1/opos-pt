"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { descartarTarea, useTareas } from "@/datos/tareas";

/**
 * Aviso flotante, abajo a la derecha, con las tareas en segundo plano: se ve
 * desde cualquier sección, así que puedes seguir con otra cosa y saber cuándo
 * ha terminado. Al acabar, enlaza al resultado.
 */
export function AvisoTareas() {
  const tareas = useTareas();
  const [ahora, setAhora] = useState(() => Date.now());
  const enMarcha = tareas.some((t) => t.estado === "en_marcha");

  useEffect(() => {
    if (!enMarcha) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enMarcha]);

  if (tareas.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {tareas.map((t) => {
        const segundos = Math.max(0, Math.floor((ahora - t.empezada) / 1000));
        return (
          <div
            key={t.id}
            className={clsx(
              "entra rounded-[18px] border-2 border-borde bg-papel-alto px-4 py-3 shadow-flota",
              t.estado === "error" && "bg-margen-fondo",
            )}
          >
            <div className="flex items-start gap-2">
              <p className="flex-1 text-[0.9rem] font-extrabold text-tinta">{t.titulo}</p>
              {t.estado !== "en_marcha" ? (
                <button
                  type="button"
                  onClick={() => descartarTarea(t.id)}
                  className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-apagado hover:bg-papel-franja hover:text-tinta"
                >
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">Cerrar este aviso</span>
                </button>
              ) : null}
            </div>

            {t.estado === "en_marcha" ? (
              <>
                <p className="mt-0.5 text-[0.8rem] text-apagado">
                  {t.pasos.length > 1 ? `Paso ${t.paso + 1} de ${t.pasos.length} · ` : ""}
                  {t.pasos[t.paso]}… <span data-numerico>{segundos} s</span>
                </p>
                <div className="mt-2 flex h-2.5 gap-1" aria-hidden="true">
                  {t.pasos.map((_, i) => (
                    <span key={i} className="relative flex-1 overflow-hidden rounded-full bg-linea-suave">
                      {i < t.paso ? <span className="absolute inset-0 bg-acento-vivo" /> : null}
                      {i === t.paso ? <span className="progreso-vivo absolute inset-y-0 rounded-full bg-acento-vivo" /> : null}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[0.75rem] text-apagado">
                  Puedes ir a otra sección; sigue aquí. No cierres ni recargues la pestaña.
                </p>
              </>
            ) : (
              <p
                className={clsx(
                  "mt-0.5 text-[0.85rem]",
                  t.estado === "error" ? "font-bold text-margen" : "text-visto",
                )}
              >
                {t.mensaje}{" "}
                {t.estado === "hecha" && t.enlace ? (
                  <Link href={t.enlace} onClick={() => descartarTarea(t.id)} className="regla font-extrabold text-tinta">
                    Verlo →
                  </Link>
                ) : null}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
