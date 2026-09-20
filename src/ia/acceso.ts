/**
 * Quién puede usar la app cuando está publicada.
 *
 * Sin esto, cualquiera que se registre gastaría la clave de Anthropic de quien
 * paga. `CORREOS_PERMITIDOS` es una lista separada por comas; si está vacía, no
 * se restringe nada (que es lo cómodo en local).
 */

export function correosPermitidos(): string[] {
  return (process.env.CORREOS_PERMITIDOS ?? "")
    .split(",")
    .map((correo) => correo.trim().toLowerCase())
    .filter(Boolean);
}

export function tieneAcceso(correo?: string | null): boolean {
  const permitidos = correosPermitidos();
  if (permitidos.length === 0) return true;
  return Boolean(correo && permitidos.includes(correo.toLowerCase()));
}

export const MENSAJE_SIN_ACCESO =
  "Esta copia de Cuaderno es privada y tu correo no está en la lista de acceso. Si debería estarlo, pídeselo a quien la ha montado.";
