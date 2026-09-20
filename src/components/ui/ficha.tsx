import clsx from "clsx";
import type { ComponentProps } from "react";

/** Hoja del cuaderno: fondo claro y filete de 1 px. Sin sombras difusas. */
export function Ficha({ className, rayada, ...props }: ComponentProps<"div"> & { rayada?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-ficha border border-linea bg-papel-alto",
        rayada && "pauta",
        className,
      )}
      {...props}
    />
  );
}
