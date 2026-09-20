"use client";

import Link from "next/link";
import { useCuaderno, temasConContenido } from "@/datos/almacen";

/**
 * Franja de cobertura: siempre visible, dice con cuánto temario está trabajando
 * la app. Es la pieza que evita la sensación de que se inventa contenido.
 */
export function AvisoCobertura() {
  const { temas, cargado } = useCuaderno();
  if (!cargado) return null;

  const conContenido = temasConContenido(temas).length;
  const total = temas.length;

  if (conContenido === total) {
    return (
      <p className="border-b border-linea bg-visto-fondo px-5 py-2.5 text-[0.9rem] text-tinta sm:px-8 lg:px-10">
        Tienes los {total} temas con contenido. La app trabaja con el temario completo.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-margen-hilo bg-margen-fondo px-5 py-2.5 sm:px-8 lg:px-10">
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-margen">
        Cobertura
      </span>
      <p className="text-[0.92rem] text-tinta">
        Tienes <strong className="font-semibold">{conContenido} de {total} temas</strong> con
        contenido. Practicar, los supuestos y los simulacros solo trabajan con esos; el resto
        aparece bloqueado y explicado.
      </p>
      <Link href="/temario" className="regla ml-auto text-[0.9rem] font-semibold text-tinta">
        Subir más temas
      </Link>
    </div>
  );
}
