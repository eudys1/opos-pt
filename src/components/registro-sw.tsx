"use client";

import { useEffect } from "react";

/**
 * Registra el service worker para que la app se pueda instalar y abrir sin
 * conexión. En desarrollo no se registra: molestaría al recargar.
 */
export function RegistroSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la app funciona igual, solo que sin modo sin conexión.
      });
    };

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar);

    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
