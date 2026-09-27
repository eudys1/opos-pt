"use client";

import Link from "next/link";
import { useCuaderno, temasConContenido } from "@/datos/almacen";
import { usePreferencia } from "@/datos/preferencias";

/**
 * Franja de cobertura: dice con cuánto temario está trabajando la app, que es
 * lo que evita la sensación de que se inventa contenido.
 *
 * Se puede cerrar con la X, y se recuerda. Vuelve sola cuando cambia el número
 * de temas con contenido, porque entonces hay algo nuevo que decir. Cerrada o
 * no, la cobertura sigue a la vista en pequeño en el lateral.
 */
export function AvisoCobertura() {
  const { temas, cargado } = useCuaderno();
  const conContenido = temasConContenido(temas).length;
  const total = temas.length;
  const [cerradoCon, setCerradoCon] = usePreferencia<string>("cobertura-cerrada", "");

  if (!cargado || conContenido === total) return null;
  if (cerradoCon === String(conContenido)) return null;

  return (
    <aside
      aria-label="Cobertura del temario"
      className="entra flex items-start gap-3 border-b border-linea bg-papel-alto px-5 py-3 sm:px-8 lg:px-10"
    >
      <span
        aria-hidden="true"
        className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-acento-vivo"
      />
      <p className="flex-1 text-[0.92rem] leading-relaxed text-texto">
        Tienes <strong className="font-semibold text-tinta">{conContenido} de {total} temas</strong>{" "}
        con contenido. Practicar, los supuestos y los simulacros solo trabajan con esos.{" "}
        <Link href="/temario" className="regla font-semibold text-tinta">
          Subir más temas
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setCerradoCon(String(conContenido))}
        className="-my-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pliegue text-apagado hover:bg-papel-franja hover:text-tinta"
      >
        <span aria-hidden="true" className="text-[1.3rem] leading-none">
          ×
        </span>
        <span className="sr-only">Cerrar el aviso de cobertura</span>
      </button>
    </aside>
  );
}
