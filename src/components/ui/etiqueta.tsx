import clsx from "clsx";
import type { ComponentProps } from "react";

type Tono = "neutra" | "aviso" | "hecha" | "borrador";

const tonos: Record<Tono, string> = {
  neutra: "border-linea text-apagado",
  aviso: "border-aviso-vivo/50 text-aviso bg-aviso-fondo",
  hecha: "border-visto/40 text-visto bg-visto-fondo",
  borrador: "border-margen-hilo text-margen bg-papel-alto border-dashed",
};

export function Etiqueta({
  tono = "neutra",
  className,
  ...props
}: ComponentProps<"span"> & { tono?: Tono }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold",
        tonos[tono],
        className,
      )}
      {...props}
    />
  );
}
