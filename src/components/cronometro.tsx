"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

/**
 * El reloj del examen.
 *
 * Regla del proyecto: NO avisa de nada. Sin alertas a los 30, 15 o 5 minutos,
 * sin sonidos, sin cambios de color de aviso y sin mensajes de ánimo. Solo el
 * tiempo, como un reloj de pared, y la opción de no mirarlo.
 *
 * La cuenta sale de `iniciadoEn` (hora del servidor) más la duración, así que
 * recargar la página, cerrarla o cambiar la hora del ordenador no da tiempo extra.
 */

export type ModoReloj = "restante" | "transcurrido" | "hora" | "oculto";

const MODOS: { valor: ModoReloj; texto: string }[] = [
  { valor: "restante", texto: "Restante" },
  { valor: "transcurrido", texto: "Transcurrido" },
  { valor: "hora", texto: "Hora" },
  { valor: "oculto", texto: "Oculto" },
];

export function Cronometro({
  iniciadoEn,
  duracionSegundos,
  modo,
  onCambiarModo,
  onTiempoAgotado,
}: {
  iniciadoEn: string;
  duracionSegundos: number;
  modo: ModoReloj;
  onCambiarModo: (modo: ModoReloj) => void;
  onTiempoAgotado?: () => void;
}) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const inicio = new Date(iniciadoEn).getTime();
  const transcurrido = Math.max(0, Math.floor((ahora - inicio) / 1000));
  const restante = duracionSegundos - transcurrido;
  const agotado = restante <= 0;

  useEffect(() => {
    if (agotado) onTiempoAgotado?.();
  }, [agotado, onTiempoAgotado]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <p
          className={clsx(
            "font-display text-[2.6rem] leading-none tracking-[-0.02em]",
            modo === "oculto" && "text-tenue",
          )}
          data-numerico
          // El reloj no se anuncia a cada segundo: sería insoportable con lector
          // de pantalla y rompería la concentración.
          aria-live="off"
        >
          {modo === "oculto"
            ? "—:—:—"
            : modo === "hora"
              ? new Date(ahora).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
              : reloj(modo === "restante" ? Math.max(0, restante) : transcurrido)}
        </p>
        {agotado && modo !== "oculto" ? (
          <span className="text-[0.85rem] text-apagado">tiempo cumplido</span>
        ) : null}
      </div>

      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Cómo ver el reloj</legend>
        {MODOS.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={modo === opcion.valor}
            onClick={() => onCambiarModo(opcion.valor)}
            className={clsx(
              "min-h-11 rounded-pliegue border px-3 text-[0.82rem]",
              modo === opcion.valor
                ? "border-tinta bg-papel-franja font-semibold"
                : "border-linea bg-papel-alto text-texto hover:border-tinta",
            )}
          >
            {opcion.texto}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

export function reloj(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
