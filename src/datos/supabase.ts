import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador.
 *
 * Mientras no haya claves configuradas, la app funciona con el almacén local
 * (`src/datos/almacen.tsx`). `hayNube()` es lo que decide cuál se usa, para que
 * conectar la nube sea pegar dos variables en `.env.local` y nada más.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hayNube(): boolean {
  return Boolean(url && clavePublica);
}

export function clienteNavegador() {
  if (!url || !clavePublica) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local. " +
        "Hasta que estén, la app guarda los datos en este navegador.",
    );
  }
  return createBrowserClient(url, clavePublica);
}
