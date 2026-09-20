"use client";

import Link from "next/link";
import { useSesion } from "@/datos/sesion";

/**
 * Dice siempre dónde se están guardando los datos. Es la diferencia entre
 * "esto solo está en este portátil" y "esto está en mi cuenta", que en una
 * oposición de dos años importa bastante.
 */
export function EstadoCuenta() {
  const { usuario, estadoNube, mensaje, salir } = useSesion();

  if (estadoNube === "sin-nube") {
    return (
      <p className="text-[0.8rem] leading-relaxed text-apagado">
        Guardado <strong className="font-semibold">solo en este navegador</strong>. Sin cuenta
        todavía.
      </p>
    );
  }

  if (!usuario) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[0.8rem] leading-relaxed text-apagado">
          Guardado solo en este navegador.
        </p>
        <Link href="/entrar" className="regla self-start text-[0.85rem] font-semibold text-tinta">
          Entrar para sincronizar
        </Link>
      </div>
    );
  }

  const etiqueta =
    estadoNube === "sincronizando"
      ? "Guardando…"
      : estadoNube === "error"
        ? "No se ha podido guardar"
        : "Guardado en tu cuenta";

  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-[0.8rem] text-apagado">
        <span
          aria-hidden="true"
          className={
            estadoNube === "error"
              ? "inline-block h-2 w-2 rounded-full bg-margen"
              : estadoNube === "sincronizando"
                ? "inline-block h-2 w-2 rounded-full bg-margen-hilo"
                : "inline-block h-2 w-2 rounded-full bg-visto"
          }
        />
        <span aria-live="polite">{etiqueta}</span>
      </p>
      <p className="truncate text-[0.8rem] text-tenue" title={usuario.email ?? undefined}>
        {usuario.email}
      </p>
      {mensaje ? <p className="text-[0.78rem] leading-snug text-apagado">{mensaje}</p> : null}
      <button type="button" onClick={salir} className="regla self-start text-[0.8rem] text-texto">
        Salir
      </button>
    </div>
  );
}
