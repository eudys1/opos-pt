import { NextResponse } from "next/server";
import { clienteServidor } from "@/datos/supabase-servidor";

/**
 * Aterrizaje del enlace de acceso del correo: cambia el código por una sesión
 * y lleva al cuaderno. Si algo falla, vuelve a /entrar explicando por qué en
 * vez de dejar una pantalla en blanco.
 */
export async function GET(peticion: Request) {
  const url = new URL(peticion.url);
  const codigo = url.searchParams.get("code");
  const destino = url.searchParams.get("next") ?? "/registro";

  if (!codigo) {
    return NextResponse.redirect(new URL("/entrar?error=sin-codigo", url.origin));
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(codigo);

  if (error) {
    return NextResponse.redirect(
      new URL(`/entrar?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(destino, url.origin));
}
