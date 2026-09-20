import { Navegacion } from "@/components/navegacion";
import { ProveedorCuaderno } from "@/datos/almacen";
import { ProveedorSesion } from "@/datos/sesion";
import { AvisoCobertura } from "@/components/aviso-cobertura";

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <ProveedorCuaderno>
      <ProveedorSesion>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Navegacion />
          <div className="flex min-w-0 flex-1 flex-col">
            <AvisoCobertura />
            <main id="contenido" className="flex-1 px-5 py-7 sm:px-8 lg:px-10">
              {children}
            </main>
          </div>
        </div>
      </ProveedorSesion>
    </ProveedorCuaderno>
  );
}
