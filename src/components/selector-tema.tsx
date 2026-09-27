"use client";

import { useSyncExternalStore } from "react";
import clsx from "clsx";

/**
 * Claro u oscuro, con un sol y una luna. Por defecto, claro: el oscuro solo se
 * aplica si se elige aquí. Se guarda en este navegador y se aplica antes del
 * primer pintado con el script de `layout.tsx`, para que no haya fogonazo.
 */

export const CLAVE_TEMA = "cuaderno:tema";

type Tema = "claro" | "oscuro";

const escuchas = new Set<() => void>();
let tema: Tema = "claro";
let leido = false;

function suscribir(escucha: () => void) {
  if (!leido) {
    leido = true;
    try {
      // Lo que hubiera guardado de antes ("auto") cuenta como claro.
      tema = window.localStorage.getItem(CLAVE_TEMA) === "oscuro" ? "oscuro" : "claro";
    } catch {
      // Sin almacenamiento: claro.
    }
  }
  escuchas.add(escucha);
  return () => {
    escuchas.delete(escucha);
  };
}

function cambiar(valor: Tema) {
  tema = valor;
  if (valor === "oscuro") document.documentElement.setAttribute("data-tema", "oscuro");
  else document.documentElement.removeAttribute("data-tema");
  try {
    window.localStorage.setItem(CLAVE_TEMA, valor);
  } catch {
    // Dura lo que dure la página.
  }
  for (const e of escuchas) e();
}

export function SelectorTema({ className }: { className?: string }) {
  const actual = useSyncExternalStore(
    suscribir,
    () => tema,
    () => "claro" as Tema,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Aspecto"
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-full border-2 border-borde bg-papel-alto p-0.5",
        className,
      )}
    >
      <BotonTema activo={actual === "claro"} onClick={() => cambiar("claro")} texto="Claro">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
      </BotonTema>
      <BotonTema activo={actual === "oscuro"} onClick={() => cambiar("oscuro")} texto="Oscuro">
        <path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z" />
      </BotonTema>
    </div>
  );
}

function BotonTema({
  activo,
  onClick,
  texto,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  texto: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      title={texto}
      className={clsx(
        "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
        activo ? "bg-acento-vivo text-sobre-boton" : "text-apagado hover:bg-papel-franja hover:text-tinta",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
      <span className="sr-only">{texto}</span>
    </button>
  );
}
