"use client";

import { useSyncExternalStore } from "react";

/**
 * Claro, oscuro o el del sistema. Se guarda en este navegador y se aplica antes
 * del primer pintado con el script de `layout.tsx`, para que no haya fogonazo.
 */

export const CLAVE_TEMA = "cuaderno:tema";

type Tema = "auto" | "claro" | "oscuro";

const escuchas = new Set<() => void>();
let tema: Tema = "auto";
let leido = false;

function aplicar(valor: Tema) {
  const raiz = document.documentElement;
  if (valor === "auto") raiz.removeAttribute("data-tema");
  else raiz.setAttribute("data-tema", valor);
}

function suscribir(escucha: () => void) {
  if (!leido) {
    leido = true;
    try {
      const guardado = window.localStorage.getItem(CLAVE_TEMA);
      if (guardado === "claro" || guardado === "oscuro") tema = guardado;
    } catch {
      // Sin almacenamiento: se queda en automático.
    }
    escucha();
  }
  escuchas.add(escucha);
  return () => {
    escuchas.delete(escucha);
  };
}

function cambiar(valor: Tema) {
  tema = valor;
  aplicar(valor);
  try {
    if (valor === "auto") window.localStorage.removeItem(CLAVE_TEMA);
    else window.localStorage.setItem(CLAVE_TEMA, valor);
  } catch {
    // La preferencia no se recordará, pero la sesión sí la respeta.
  }
  for (const escucha of escuchas) escucha();
}

const OPCIONES: { valor: Tema; texto: string }[] = [
  { valor: "claro", texto: "Claro" },
  { valor: "oscuro", texto: "Oscuro" },
  { valor: "auto", texto: "Automático" },
];

export function SelectorTema({ className }: { className?: string }) {
  const actual = useSyncExternalStore(
    suscribir,
    () => tema,
    () => "auto" as Tema,
  );

  return (
    <div className={className}>
      <label htmlFor="selector-tema" className="sr-only">
        Aspecto del cuaderno
      </label>
      <select
        id="selector-tema"
        value={actual}
        onChange={(e) => cambiar(e.target.value as Tema)}
        className="min-h-11 rounded-pliegue border border-linea bg-papel-alto px-3 py-2 text-[0.85rem] text-texto"
      >
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
