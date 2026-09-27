import clsx from "clsx";
import type { ComponentProps } from "react";

/**
 * Tarjeta de la dirección B: blanca, con borde marrón grueso, esquinas muy
 * redondeadas y la sombra desplazada en melocotón. `destacada` la hace más
 * rotunda, para lo principal de cada pantalla.
 */
export function Ficha({
  className,
  rayada,
  destacada,
  ...props
}: ComponentProps<"div"> & { rayada?: boolean; destacada?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-ficha bg-papel-alto",
        destacada ? "border-[3px] border-borde shadow-flota" : "border-2 border-borde shadow-ficha",
        rayada && "pauta",
        className,
      )}
      {...props}
    />
  );
}
