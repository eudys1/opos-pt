import { ProveedorCuaderno } from "@/datos/almacen";
import { ProveedorSesion } from "@/datos/sesion";
import { Puerta } from "@/components/puerta";

/**
 * Pantallas de trabajo a pantalla completa, como el editor de un tema: con
 * cuenta, pero sin la barra lateral, para que el texto tenga todo el ancho.
 */
export default function LayoutEditor({ children }: LayoutProps<"/">) {
  return (
    <ProveedorCuaderno>
      <ProveedorSesion>
        <Puerta>{children}</Puerta>
      </ProveedorSesion>
    </ProveedorCuaderno>
  );
}
