"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Ventana sobre la página, con el <dialog> del navegador: atrapa el foco,
 * se cierra con Escape y devuelve el foco a donde estaba. Todo lo que edita
 * algo lleva siempre un "Cancelar" que cierra sin tocar nada.
 */
export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => {
        // Un clic en el fondo, fuera de la caja, también cierra.
        if (e.target === ref.current) onCerrar();
      }}
      aria-labelledby="dialogo-titulo"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-ficha border border-linea bg-papel-alto p-0 text-tinta shadow-flota backdrop:bg-black/40"
    >
      {abierto ? (
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex items-start gap-3">
            <h2 id="dialogo-titulo" className="flex-1 text-[1.25rem]">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              className="-mr-2 -mt-1 inline-flex h-11 w-11 items-center justify-center rounded-pliegue text-apagado hover:bg-papel-franja hover:text-tinta"
            >
              <span aria-hidden="true" className="text-[1.4rem] leading-none">
                ×
              </span>
              <span className="sr-only">Cerrar</span>
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
