import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase en el servidor. Lo necesita el intercambio del enlace de
 * acceso del correo por una sesión: el código llega a `/auth/callback` y solo
 * desde allí se pueden escribir las cookies de sesión.
 */
export async function clienteServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clavePublica =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !clavePublica) {
    throw new Error("Faltan las variables de Supabase en .env.local");
  }

  const almacenCookies = await cookies();

  return createServerClient(url, clavePublica, {
    cookies: {
      getAll() {
        return almacenCookies.getAll();
      },
      setAll(cookiesNuevas) {
        for (const { name, value, options } of cookiesNuevas) {
          almacenCookies.set(name, value, options);
        }
      },
    },
  });
}
