"use client";

import { useEffect, useState } from "react";

/**
 * El reloj de ejemplo de la portada, corriendo hacia atrás de verdad: se
 * entiende mejor "un reloj que no avisa de nada" viéndolo pasar en silencio.
 * Con movimiento reducido se queda quieto.
 */
export function RelojMuestra({ desde = 2 * 3600 + 18 * 60 + 42 }: { desde?: number }) {
  const [segundos, setSegundos] = useState(desde);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setSegundos((s) => (s > 0 ? s - 1 : desde)), 1000);
    return () => clearInterval(id);
  }, [desde]);

  const h = Math.floor(segundos / 3600);
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, "0");
  const s = String(segundos % 60).padStart(2, "0");
  return (
    <span aria-label="Ejemplo de reloj en marcha" role="img">
      {h}:{m}:{s}
    </span>
  );
}
