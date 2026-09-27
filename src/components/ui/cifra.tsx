"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Un número que cuenta hasta su valor al aparecer, con cola larga (power3):
 * rápido al principio y posándose al final. Vale un entero con o sin coletilla
 * ("18", "18 días"); cualquier otra cosa ("—", "4 h 30") se pinta tal cual. Con movimiento reducido, o si el
 * valor cambia después, se pone directo: la animación es para la llegada, no
 * para cada actualización.
 *
 * El número final está siempre en el DOM para lectores de pantalla.
 */
export function Cifra({ valor, duracion = 900 }: { valor: string | number; duracion?: number }) {
  const texto = String(valor);
  const partes = texto.match(/^(\d+)(\s+\D.*)?$/);
  const entero = partes ? Number(partes[1]) : null;
  const coletilla = partes?.[2] ?? "";
  const [mostrado, setMostrado] = useState<number | null>(entero === null ? null : 0);
  const animado = useRef(false);

  useEffect(() => {
    if (entero === null) return;
    const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animado.current || reducido || entero === 0) {
      const id = requestAnimationFrame(() => setMostrado(entero));
      return () => cancelAnimationFrame(id);
    }
    animado.current = true;
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
  }, [entero, duracion]);

  if (entero === null) return <>{texto}</>;
  return (
    <>
      <span aria-hidden="true">
        {mostrado ?? entero}
        {coletilla}
      </span>
      <span className="sr-only">{texto}</span>
    </>
  );
}
