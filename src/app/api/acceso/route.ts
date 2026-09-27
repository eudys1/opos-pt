import { NextResponse } from "next/server";
import { prepararSesion } from "@/ia/guardas";

/**
 * ¿Puede esta cuenta usar la app? La lista de correos permitidos vive en el
 * servidor (CORREOS_PERMITIDOS) y no sale al navegador: la puerta pregunta
 * aquí. `prepararSesion` ya responde 401 sin sesión y 403 si el correo no
 * está en la lista.
 */
export async function GET() {
  const sesion = await prepararSesion();
  if (sesion instanceof NextResponse) return sesion;
  return NextResponse.json({ permitido: true });
}
