"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferencias pequeñas de este navegador: un aviso cerrado, la vista elegida
 * en el planificador… Cosas que se pueden perder sin que pase nada, por eso van
 * en localStorage y no en la cuenta.
 *
 * Se leen con useSyncExternalStore: en el servidor valen el valor por defecto y
 * en el navegador el guardado, sin discordancia de hidratación.
 */

const escuchas = new Set<() => void>();

function suscribir(escucha: () => void) {
  escuchas.add(escucha);
  const alCambiarEnOtraPestana = (e: StorageEvent) => {
    if (e.key?.startsWith("cuaderno:")) escucha();
  };
  window.addEventListener("storage", alCambiarEnOtraPestana);
  return () => {
    escuchas.delete(escucha);
    window.removeEventListener("storage", alCambiarEnOtraPestana);
  };
}

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function usePreferencia<T extends string>(
  clave: string,
  porDefecto: T,
): [T, (valor: T) => void] {
  const completa = `cuaderno:${clave}`;
  const valor = useSyncExternalStore(
    suscribir,
    () => (leer(completa) as T | null) ?? porDefecto,
    () => porDefecto,
  );

  const guardar = useCallback(
    (nuevo: T) => {
      try {
        window.localStorage.setItem(completa, nuevo);
      } catch {
        // Sin almacenamiento, la preferencia dura lo que dure la página.
      }
      for (const e of escuchas) e();
    },
    [completa],
  );

  return [valor, guardar];
}
