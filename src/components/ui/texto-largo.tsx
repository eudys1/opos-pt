"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";
import clsx from "clsx";

/**
 * Área de texto que crece con lo que lleva dentro, sin barra de scroll
 * propia: se baja con la página, como en un documento. Para textos largos
 * (un tema entero, el banco de normativa) una caja pequeña con su propio
 * scroll es incomodísima.
 */
export function TextoLargo({
  className,
  value,
  ...props
}: ComponentProps<"textarea"> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      className={clsx(
        "block w-full resize-none overflow-hidden rounded-pliegue border border-linea bg-papel-alto px-5 py-4 text-[1rem] leading-[1.75] text-tinta",
        className,
      )}
      {...props}
    />
  );
}
