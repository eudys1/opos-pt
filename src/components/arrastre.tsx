"use client";

import { useRef, type ReactNode } from "react";
import clsx from "clsx";
import { Button, useDrag, useDrop, type DropItem } from "react-aria-components";
import type { EntradaAgenda } from "@/nucleo/agenda";

/**
 * Arrastrar y soltar del planificador, con React Aria: con ratón, con el dedo
 * y también con teclado (el asa ⠿ de cada entrada: Intro para cogerla, Tab
 * para elegir el día, Intro para soltarla). Lo que se puede mover y adónde lo
 * decide `comoMover` en el núcleo; aquí solo se lleva y se trae.
 */

const TIPO = "application/x-cuaderno-entrada";

/** Lo que viaja al arrastrar: la entrada entera, que el día destino necesita. */
function empaquetar(entrada: EntradaAgenda): Record<string, string> {
  return { [TIPO]: JSON.stringify(entrada), "text/plain": entrada.texto ?? "" };
}

async function desempaquetar(items: DropItem[]): Promise<EntradaAgenda | null> {
  for (const item of items) {
    if (item.kind === "text" && item.types.has(TIPO)) {
      return JSON.parse(await item.getText(TIPO)) as EntradaAgenda;
    }
  }
  return null;
}

/**
 * Envuelve una entrada para poder arrastrarla. Con `asa`, además lleva un
 * botón ⠿ para moverla con el teclado.
 */
export function Arrastrable({
  entrada,
  deshabilitado,
  asa,
  nombre,
  className,
  children,
}: {
  entrada: EntradaAgenda;
  deshabilitado?: boolean;
  asa?: boolean;
  /** Para el lector de pantalla: "Mover Repaso 2 · tema 3". */
  nombre: string;
  className?: string;
  children: ReactNode;
}) {
  const { dragProps, dragButtonProps, isDragging } = useDrag({
    getItems: () => [empaquetar(entrada)],
    isDisabled: deshabilitado,
    hasDragButton: asa,
  });
  return (
    <div
      {...(deshabilitado ? {} : dragProps)}
      className={clsx(className, !deshabilitado && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    >
      {children}
      {asa && !deshabilitado ? (
        <Button
          {...dragButtonProps}
          aria-label={`Mover ${nombre} a otro día`}
          className="inline-flex w-7 shrink-0 cursor-grab items-center justify-center rounded-[8px] text-tenue outline-none hover:bg-papel-franja hover:text-tinta data-[focus-visible]:ring-2 data-[focus-visible]:ring-acento"
        >
          <svg viewBox="0 0 10 16" width="9" height="14" aria-hidden="true" fill="currentColor">
            <circle cx="2.5" cy="3" r="1.4" />
            <circle cx="7.5" cy="3" r="1.4" />
            <circle cx="2.5" cy="8" r="1.4" />
            <circle cx="7.5" cy="8" r="1.4" />
            <circle cx="2.5" cy="13" r="1.4" />
            <circle cx="7.5" cy="13" r="1.4" />
          </svg>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Un día que acepta entradas. Mientras algo se arrastra por encima se ilumina,
 * para que se vea dónde va a caer.
 */
export function DiaQueRecibe({
  dia,
  onSoltar,
  className,
  claseEncima = "ring-[3px] ring-acento-vivo ring-offset-2 ring-offset-papel",
  etiqueta,
  children,
}: {
  dia: string;
  onSoltar: (entrada: EntradaAgenda, dia: string) => void;
  className?: string;
  claseEncima?: string;
  /** Lo que lee el lector de pantalla al llegar aquí arrastrando con teclado. */
  etiqueta: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { dropProps, isDropTarget } = useDrop({
    ref,
    async onDrop(e) {
      const entrada = await desempaquetar(e.items);
      if (entrada) onSoltar(entrada, dia);
    },
  });
  return (
    <div
      {...dropProps}
      ref={ref}
      aria-label={etiqueta}
      className={clsx(className, "transition-shadow duration-150", isDropTarget && claseEncima)}
    >
      {children}
    </div>
  );
}
