/**
 * Se vuelve a montar en cada navegación dentro de la app (a diferencia del
 * layout), así que su animación marca el cambio de pantalla sin que la barra
 * lateral se mueva.
 */
export default function Transicion({ children }: { children: React.ReactNode }) {
  return <div className="pantalla">{children}</div>;
}
