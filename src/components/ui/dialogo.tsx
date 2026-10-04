"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

/**
 * Ventana sobre la página (React Aria): atrapa el foco, se cierra con Escape
 * o con un clic fuera, devuelve el foco a donde estaba y bloquea el scroll de
 * detrás. Entra con un fundido y la caja sube un poco; sale igual. En móvil
 * se pega abajo, como una hoja, que es donde llega el pulgar.
 *
 * Todo lo que edita algo lleva siempre un "Cancelar" que cierra sin tocar nada.
 */
export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  subtitulo,
  ancho = "normal",
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  subtitulo?: ReactNode;
  ancho?: "normal" | "ancho";
  children: ReactNode;
}) {
  return (
    <ModalOverlay
      isOpen={abierto}
      onOpenChange={(abre) => {
        if (!abre) onCerrar();
      }}
      isDismissable
      className="modal-fondo fixed inset-0 z-50 flex items-end justify-center bg-velo p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
    >
      <Modal
        className={clsx(
          "modal-caja max-h-[92vh] w-full overflow-y-auto rounded-t-ficha border-[3px] border-borde bg-papel-alto text-tinta shadow-flota sm:rounded-ficha",
          ancho === "ancho" ? "sm:max-w-[44rem]" : "sm:max-w-[32rem]",
        )}
      >
        <Dialog className="flex flex-col gap-4 px-6 py-5 outline-none">
          {({ close }) => (
            <>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Heading slot="title" className="text-[1.25rem] leading-snug">
                    {titulo}
                  </Heading>
                  {subtitulo ? <p className="mt-0.5 text-[0.88rem] text-apagado">{subtitulo}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-apagado hover:bg-papel-franja hover:text-tinta"
                >
                  <span aria-hidden="true" className="text-[1.4rem] leading-none">
                    ×
                  </span>
                  <span className="sr-only">Cerrar</span>
                </button>
              </div>
              {children}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
