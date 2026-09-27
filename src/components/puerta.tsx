"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Ficha } from "@/components/ui/ficha";
import { Boton, BotonEnlace } from "@/components/ui/boton";
import { Marca } from "@/components/marcas";
import { useSesion } from "@/datos/sesion";

/**
 * La puerta: el cuaderno solo se abre con una cuenta de la lista.
 *
 * Dos comprobaciones: que haya sesión y que el correo esté permitido. La lista
 * está en el servidor; se pregunta a /api/acceso una vez por sesión. Si no se
 * puede preguntar (sin conexión), se deja pasar: los datos están protegidos
 * igual por la RLS y por las rutas de la API, que también miran la lista.
 */
export function Puerta({ children }: { children: ReactNode }) {
  const { usuario, comprobando, salir } = useSesion();
  const [permiso, setPermiso] = useState<{ id: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    fetch("/api/acceso")
      .then((r) => {
        if (vivo) setPermiso({ id: usuario.id, ok: r.status !== 403 });
      })
      .catch(() => {
        if (vivo) setPermiso({ id: usuario.id, ok: true });
      });
    return () => {
      vivo = false;
    };
  }, [usuario]);

  if (comprobando || (usuario && permiso?.id !== usuario.id)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-apagado">Comprobando tu sesión…</p>
      </div>
    );
  }

  if (usuario && permiso?.ok) return <>{children}</>;

  if (usuario && permiso && !permiso.ok) {
    return (
      <main
        id="contenido"
        className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-5 py-14 sm:px-8"
      >
        <Marca />
        <h1 className="text-[2rem]">Esta cuenta no tiene acceso</h1>
        <Ficha className="flex flex-col gap-3 px-6 py-6">
          <p className="text-[0.98rem] leading-relaxed text-texto">
            Has entrado como <strong className="font-extrabold">{usuario.email}</strong>, pero esta copia
            del cuaderno es privada y ese correo no está dado de alta. Si crees que debería estarlo,
            pídeselo a quien la ha montado.
          </p>
          <Boton tono="secundario" className="self-start" onClick={() => void salir()}>
            Salir y entrar con otra cuenta
          </Boton>
        </Ficha>
      </main>
    );
  }

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
          este navegador. Así es el mismo cuaderno en el ordenador y en el móvil.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <BotonEnlace href="/entrar" tamano="grande">
            Entrar
          </BotonEnlace>
          <BotonEnlace href="/crear-cuenta" tono="secundario" tamano="grande">
            Crear cuenta
          </BotonEnlace>
        </div>
      </Ficha>
    </main>
  );
}
