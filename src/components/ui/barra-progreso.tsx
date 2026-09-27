"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

/**
 * Progreso de todo lo que tarda porque está trabajando la IA: leer apuntes,
 * crear preguntas, corregir…
 *
 * No finge un porcentaje que no se conoce. Enseña lo que sí se sabe: en qué
 * paso va de cuántos, qué está haciendo ahora y cuánto lleva. El tramo del paso
 * actual se mueve para que se vea que sigue vivo; con movimiento reducido, se
 * queda quieto y solo cambia el texto.
 */
export function BarraProgreso({
  pasos,
  actual,
  aviso,
  className,
}: {
  /** Qué se hace en cada paso, en minúscula: "leyendo la página 2". */
  pasos: string[];
  /** Índice del paso en marcha, desde 0. */
  actual: number;
  /** Una frase de contexto: cuánto suele tardar, si se puede seguir haciendo cosas… */
  aviso?: string;
  className?: string;
}) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const inicio = Date.now();
    const id = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const total = Math.max(1, pasos.length);
  const paso = Math.min(actual, total - 1);
  const texto = pasos[paso] ?? "trabajando";

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx("flex max-w-xl flex-col gap-2", className)}
    >
      <div className="flex items-baseline justify-between gap-3 text-[0.88rem]">
        <span className="text-tinta">
          {total > 1 ? (
            <span className="text-apagado" data-numerico>
              Paso {paso + 1} de {total} ·{" "}
            </span>
          ) : null}
          {texto.charAt(0).toUpperCase() + texto.slice(1)}…
        </span>
        <span className="shrink-0 text-[0.8rem] text-apagado" data-numerico aria-hidden="true">
          {segundos} s
        </span>
      </div>

      <div className="flex h-3 w-full gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="relative h-full flex-1 overflow-hidden rounded-full border border-linea bg-linea-suave">
            {i < paso ? <div className="absolute inset-0 rounded-full bg-acento-vivo" /> : null}
            {i === paso ? <div className="progreso-vivo absolute inset-y-0 rounded-full bg-acento-vivo" /> : null}
          </div>
        ))}
      </div>

      {aviso ? <p className="text-[0.8rem] leading-snug text-apagado">{aviso}</p> : null}
    </div>
  );
}
