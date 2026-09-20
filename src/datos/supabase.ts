import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador.
 *
 * Mientras no haya claves configuradas, la app funciona con el almacén local
 * (`src/datos/almacen.tsx`). `hayNube()` es lo que decide cuál se usa, para que
 * conectar la nube sea pegar dos variables en `.env.local` y nada más.
 *
 * Supabase renombró sus claves: la que antes se llamaba `anon` ahora es la
 * `publishable key` (`sb_publishable_…`). Se aceptan las dos, porque los
 * proyectos antiguos siguen dando la antigua. Ambas son públicas por diseño: lo
 * que protege los datos son las políticas RLS de la migración, no el secreto de
 * la clave. La `secret key` nunca debe aparecer por aquí.
 *
 * Los nombres se leen enteros y no por variable, porque Next sustituye
 * `process.env.NEXT_PUBLIC_*` en tiempo de compilación solo si están escritos así.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clavePublica =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hayNube(): boolean {
  return Boolean(url && clavePublica);
}

export function clienteNavegador() {
  if (!url || !clavePublica) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local. " +
        "Hasta que estén, la app guarda los datos en este navegador.",
    );
  }
  return createBrowserClient(url, clavePublica);
}
