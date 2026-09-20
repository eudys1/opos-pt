import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Tono = "principal" | "secundario" | "fantasma";
type Tamano = "normal" | "grande";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pliegue font-sans font-semibold transition-[background-color,color,border-color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55";

const tonos: Record<Tono, string> = {
  principal:
    "bg-tinta text-papel border border-tinta hover:bg-tinta-fuerte hover:border-tinta-fuerte",
  secundario:
    "bg-papel-alto text-tinta border border-linea hover:border-tinta hover:bg-papel-franja",
  fantasma:
    "bg-transparent text-tinta border border-transparent hover:border-linea hover:bg-papel-alto",
};

const tamanos: Record<Tamano, string> = {
  normal: "px-4 py-2.5 text-[0.95rem] min-h-11",
  grande: "px-7 py-4 text-[1.05rem] min-h-12",
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
