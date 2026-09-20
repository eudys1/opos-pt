"use client";

import { useState } from "react";
import Link from "next/link";
import { Ficha } from "@/components/ui/ficha";
import { Boton, BotonEnlace } from "@/components/ui/boton";
import { Marca } from "@/components/marcas";
import { clienteNavegador, hayNube } from "@/datos/supabase";

/**
 * Entrar con cuenta.
 *
 * Mientras no haya claves de Supabase, la página no finge un formulario que no
 * funcionaría: explica dónde están los datos ahora mismo y qué falta para tener
 * cuenta. Con claves, entra por enlace de acceso al correo.
 */
export default function PaginaEntrar() {
  return (
    <main id="contenido" className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-7 px-5 py-14 sm:px-8">
      <div>
        <Link href="/" className="rounded-pliegue">
          <Marca />
          <span className="sr-only">Volver a la portada</span>
        </Link>
        <h1 className="mt-5 text-[2.2rem]">Entrar</h1>
      </div>

      {hayNube() ? <FormularioAcceso /> : <SinCuentasTodavia />}
    </main>
  );
}

function SinCuentasTodavia() {
  return (
    <>
      <Ficha className="flex flex-col gap-3 px-6 py-6">
        <h2 className="text-xl">Todavía no hay cuentas</h2>
        <p className="text-[0.97rem] leading-relaxed text-texto">
          El cuaderno funciona ya, pero guarda todo <strong>en este navegador</strong>. No hace falta
          entrar: puedes abrirlo y empezar a marcar temas. Lo que registres se conserva aquí aunque
          cierres el navegador.
        </p>
        <p className="text-[0.97rem] leading-relaxed text-texto">
          Eso sí, lo de este ordenador no se ve en el móvil, y si borras los datos de navegación se
          pierde. Por eso el siguiente paso es conectar la nube.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <BotonEnlace href="/registro">Abrir el cuaderno</BotonEnlace>
          <BotonEnlace href="/temario" tono="secundario">
            Empezar por el temario
          </BotonEnlace>
        </div>
      </Ficha>

      <Ficha className="border-dashed px-6 py-6">
        <h2 className="text-lg">Qué falta para tener cuenta</h2>
        <ol className="mt-3 flex flex-col gap-2 text-[0.95rem] leading-relaxed text-texto">
          <li>1. Crear un proyecto gratuito en supabase.com.</li>
          <li>2. Pegar sus dos claves en el archivo .env.local del proyecto.</li>
          <li>3. Ejecutar la migración que está en supabase/migrations.</li>
        </ol>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-apagado">
          Los pasos exactos están en el README. En cuanto estén las claves, esta misma página pasa a
          pedir el correo y lo guardado aquí se puede subir a la cuenta.
        </p>
      </Ficha>
    </>
  );
}

function FormularioAcceso() {
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<"quieto" | "enviando" | "enviado" | "error">("quieto");
  const [mensaje, setMensaje] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setMensaje("");
    try {
      const supabase = clienteNavegador();
      const { error } = await supabase.auth.signInWithOtp({
        email: correo,
        options: { emailRedirectTo: `${window.location.origin}/registro` },
      });
      if (error) throw error;
      setEstado("enviado");
    } catch (error) {
      setEstado("error");
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se ha podido enviar el enlace. Inténtalo otra vez en un momento.",
      );
    }
  }

  return (
    <Ficha className="flex flex-col gap-4 px-6 py-6">
      <p className="text-[0.97rem] leading-relaxed text-texto">
        Escribe tu correo y te llega un enlace para entrar. Sin contraseñas que recordar.
      </p>

      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div>
          <label htmlFor="correo" className="block text-[0.9rem] font-semibold text-tinta">
            Tu correo
          </label>
          <input
            id="correo"
            type="email"
            required
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            aria-describedby="correo-ayuda"
            className="mt-1.5 w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.98rem]"
          />
          <p id="correo-ayuda" className="mt-1.5 text-[0.85rem] text-apagado">
            Solo se usa para entrar. El enlace caduca en una hora.
          </p>
        </div>

        <Boton type="submit" tamano="grande" disabled={estado === "enviando"}>
          {estado === "enviando" ? "Enviando…" : "Enviarme el enlace"}
        </Boton>
      </form>

      <p aria-live="polite" className="text-[0.92rem] leading-relaxed">
        {estado === "enviado" ? (
          <span className="text-visto">
            Enlace enviado a {correo}. Ábrelo en este mismo dispositivo.
          </span>
        ) : null}
        {estado === "error" ? <span className="text-margen">{mensaje}</span> : null}
      </p>
    </Ficha>
  );
}
