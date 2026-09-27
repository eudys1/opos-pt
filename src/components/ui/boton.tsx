import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

/**
 * Botones de la dirección B: píldoras con relieve abajo que se hunden al
 * pulsar. El principal es el naranja con el texto en marrón oscuro (el blanco
 * sobre ese naranja no se lee bien).
 */

type Tono = "principal" | "secundario" | "fantasma";
type Tamano = "normal" | "grande";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-sans font-extrabold transition-[background-color,color,border-color,transform,box-shadow] duration-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0";

const tonos: Record<Tono, string> = {
  principal:
    "bg-boton text-sobre-boton shadow-boton hover:bg-boton-hover active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-boton-sombra)]",
  secundario:
    "bg-papel-alto text-tinta border-2 border-borde shadow-[0_3px_0_var(--color-borde)] hover:bg-papel-franja active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-borde)]",
  fantasma: "bg-transparent text-tinta hover:bg-papel-franja",
};

const tamanos: Record<Tamano, string> = {
  normal: "px-5 py-2.5 text-[0.95rem] min-h-11",
  grande: "px-7 py-3.5 text-[1.05rem] min-h-12",
};

type Comunes = { tono?: Tono; tamano?: Tamano; children: ReactNode; className?: string };

export function Boton({
  tono = "principal",
  tamano = "normal",
  className,
  children,
  ...props
}: Comunes & ComponentProps<"button">) {
  return (
    <button className={clsx(base, tonos[tono], tamanos[tamano], className)} {...props}>
      {children}
    </button>
  );
}

export function BotonEnlace({
  tono = "principal",
  tamano = "normal",
  className,
  children,
  ...props
}: Comunes & ComponentProps<typeof Link>) {
  return (
    <Link className={clsx(base, tonos[tono], tamanos[tamano], className)} {...props}>
      {children}
    </Link>
  );
}
