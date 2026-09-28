"use client";

import { useEffect, useState } from "react";

/**
 * Un número que cuenta hasta su valor al aparecer, con cola larga (power3):
 * rápido al principio y posándose al final. Vale un entero con o sin coletilla
 * ("18", "18 días"); cualquier otra cosa ("—", "4 h 30") se pinta tal cual.
 *
 * Sin saltos:
 *   - Ocupa desde el primer momento el ancho del número final: mientras cuenta
 *     de 0 a 60 no empuja nada de alrededor.
 *   - Con `clave`, cuenta una sola vez por sesión. Al volver a la pantalla sale
 *     ya el valor, en vez de repetir la cuenta desde 0 en cada visita.
 *   - Con movimiento reducido, o si el valor cambia después, se pone directo.
 *
 * El número final está siempre en el DOM para lectores de pantalla.
 */

const yaContadas = new Set<string>();

export function Cifra({
  valor,
  duracion = 900,
  clave,
}: {
  valor: string | number;
  duracion?: number;
  /** Identifica la cifra para contarla solo la primera vez que se ve en la sesión. */
  clave?: string;
}) {
  const texto = String(valor);
  const partes = texto.match(/^(\d+)(\s+\D.*)?$/);
  const entero = partes ? Number(partes[1]) : null;
  const coletilla = partes?.[2] ?? "";
  const contada = clave !== undefined && yaContadas.has(clave);
  const [mostrado, setMostrado] = useState<number | null>(entero === null || contada ? entero : 0);

  useEffect(() => {
    if (entero === null) return;
    const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const repetida = clave !== undefined && yaContadas.has(clave);
    if (clave !== undefined) yaContadas.add(clave);
    if (repetida || reducido || entero === 0) {
      const id = requestAnimationFrame(() => setMostrado(entero));
      return () => cancelAnimationFrame(id);
    }
    const inicio = performance.now();
    let id = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      const suave = 1 - Math.pow(1 - t, 3);
      setMostrado(Math.round(entero * suave));
      if (t < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
    // Solo al llegar o si cambia el valor; la clave no cambia en vida del componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entero, duracion]);

  if (entero === null) return <>{texto}</>;
  return (
    <>
      {/* Las dos capas en la misma celda: la invisible fija el ancho final. */}
      <span aria-hidden="true" className="inline-grid">
        <span className="invisible col-start-1 row-start-1">
          {entero}
          {coletilla}
        </span>
        <span className="col-start-1 row-start-1">
          {mostrado ?? entero}
          {coletilla}
        </span>
      </span>
      <span className="sr-only">{texto}</span>
    </>
  );
}
