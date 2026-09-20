"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Ficha } from "@/components/ui/ficha";
import { BotonEnlace } from "@/components/ui/boton";
import { Marca } from "@/components/marcas";
import { useSesion } from "@/datos/sesion";

/**
 * La puerta: el cuaderno solo se abre con cuenta.
 *
 * Antes se podía usar sin entrar, guardando en el navegador, y eso llevaba a
 * tener el estudio repartido entre dispositivos sin que nadie lo avisara.
 * Ahora es siempre la misma cuenta, esté donde esté.
 */
export function Puerta({ children }: { children: ReactNode }) {
  const { usuario, comprobando } = useSesion();

  if (comprobando) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-apagado">Comprobando tu sesión…</p>
      </div>
    );
  }

  if (usuario) return <>{children}</>;

  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-5 py-14 sm:px-8"
    >
      <Link href="/" className="rounded-pliegue">
        <Marca />
        <span className="sr-only">Volver a la portada</span>
      </Link>

      <h1 className="text-[2.1rem]">Entra para abrir tu cuaderno</h1>

      <Ficha className="flex flex-col gap-3 px-6 py-6">
        <p className="text-[0.98rem] leading-relaxed text-texto">
          El temario, las marcas de estudio, los fallos y los simulacros viven en tu cuenta, no en
          este navegador. Así es el mismo cuaderno en el ordenador y en el móvil, y no se pierde si
          borras los datos de navegación.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <BotonEnlace href="/entrar" tamano="grande">
            Entrar
          </BotonEnlace>
          <BotonEnlace href="/" tono="secundario" tamano="grande">
            Ver qué es esto
          </BotonEnlace>
        </div>
      </Ficha>

      <p className="text-[0.88rem] leading-relaxed text-apagado">
        Esta copia es privada: solo pueden entrar los correos dados de alta. Si crees que el tuyo
        debería estarlo y no te deja, pídeselo a quien la ha montado.
      </p>
    </main>
  );
}
