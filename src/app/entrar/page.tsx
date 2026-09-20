"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { Boton, BotonEnlace } from "@/components/ui/boton";
import { Marca } from "@/components/marcas";
import { clienteNavegador, hayNube } from "@/datos/supabase";

/**
 * Entrar con cuenta.
 *
 * Tres caminos, porque cada persona se apaña mejor con uno: enlace al correo
 * (sin contraseñas que recordar), correo y contraseña de toda la vida, y Google
 * cuando esté activado en Supabase.
 *
 * Mientras no haya claves de Supabase, la página no finge un formulario que no
 * funcionaría: explica dónde están los datos ahora mismo y qué falta.
 */

type Via = "enlace" | "contrasena";

export default function PaginaEntrar() {
  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-7 px-5 py-14 sm:px-8"
    >
      <div>
        <Link href="/" className="rounded-pliegue">
          <Marca />
          <span className="sr-only">Volver a la portada</span>
        </Link>
        <h1 className="mt-5 text-[2.2rem]">Entrar</h1>
      </div>

      {hayNube() ? <Acceso /> : <SinCuentasTodavia />}
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
          <li>2. Pegar su URL y su publishable key en el archivo .env.local del proyecto.</li>
          <li>3. Ejecutar las migraciones que están en supabase/migrations.</li>
        </ol>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-apagado">
          Los pasos exactos están en el README. En cuanto estén las claves, esta misma página pasa a
          pedir el correo y lo guardado aquí se puede subir a la cuenta.
        </p>
      </Ficha>
    </>
  );
}

function Acceso() {
  const [via, setVia] = useState<Via>("enlace");

  return (
    <Ficha className="flex flex-col gap-5 px-6 py-6">
      <fieldset>
        <legend className="sr-only">Cómo quieres entrar</legend>
        <div className="flex gap-2">
          {(
            [
              { valor: "enlace", texto: "Enlace al correo" },
              { valor: "contrasena", texto: "Correo y contraseña" },
            ] as const
          ).map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={via === opcion.valor}
              onClick={() => setVia(opcion.valor)}
              className={clsx(
                "min-h-11 flex-1 rounded-pliegue border px-3 text-[0.9rem]",
                via === opcion.valor
                  ? "border-tinta bg-papel-franja font-semibold"
                  : "border-linea bg-papel-alto text-texto hover:border-tinta",
              )}
            >
              {opcion.texto}
            </button>
          ))}
        </div>
      </fieldset>

      {via === "enlace" ? <PorEnlace /> : <PorContrasena />}

      <ConGoogle />
    </Ficha>
  );
}

function PorEnlace() {
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
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/registro` },
      });
      if (error) throw error;
      setEstado("enviado");
    } catch (error) {
      setEstado("error");
      setMensaje(error instanceof Error ? error.message : "No se ha podido enviar el enlace.");
    }
  }

  return (
    <>
      <p className="text-[0.97rem] leading-relaxed text-texto">
        Escribe tu correo y te llega un enlace para entrar. Sin contraseñas que recordar.
      </p>

      <form onSubmit={enviar} className="flex flex-col gap-3">
        <Campo
          id="correo-enlace"
          etiqueta="Tu correo"
          ayuda="Solo se usa para entrar. El enlace caduca en una hora."
        >
          <input
            id="correo-enlace"
            type="email"
            required
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            aria-describedby="correo-enlace-ayuda"
            className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.98rem]"
          />
        </Campo>

        <Boton type="submit" tamano="grande" disabled={estado === "enviando"}>
          {estado === "enviando" ? "Enviando…" : "Enviarme el enlace"}
        </Boton>
      </form>

      <Aviso
        ok={estado === "enviado" ? `Enlace enviado a ${correo}. Ábrelo en este mismo dispositivo.` : ""}
        error={estado === "error" ? mensaje : ""}
      />
    </>
  );
}

function PorContrasena() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTrabajando(true);
    setError("");
    setOk("");
    try {
      const supabase = clienteNavegador();
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
        if (error) throw error;
        router.push("/registro");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: correo,
          password: contrasena,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/registro` },
        });
        if (error) throw error;
        if (data.session) router.push("/registro");
        else setOk("Cuenta creada. Confirma el correo que te acaba de llegar y ya podrás entrar.");
      }
    } catch (e) {
      setError(traducir(e instanceof Error ? e.message : ""));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <>
      <p className="text-[0.97rem] leading-relaxed text-texto">
        {modo === "entrar"
          ? "Con el correo y la contraseña de tu cuenta."
          : "Elige una contraseña de al menos seis caracteres."}
      </p>

      <form onSubmit={enviar} className="flex flex-col gap-3">
        <Campo id="correo-contrasena" etiqueta="Tu correo" ayuda="El mismo con el que usas la app.">
          <input
            id="correo-contrasena"
            type="email"
            required
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            aria-describedby="correo-contrasena-ayuda"
            className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.98rem]"
          />
        </Campo>

        <Campo
          id="contrasena"
          etiqueta="Contraseña"
          ayuda={modo === "crear" ? "Mínimo seis caracteres." : "La que elegiste al crear la cuenta."}
        >
          <input
            id="contrasena"
            type="password"
            required
            minLength={6}
            autoComplete={modo === "crear" ? "new-password" : "current-password"}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            aria-describedby="contrasena-ayuda"
            className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.98rem]"
          />
        </Campo>

        <Boton type="submit" tamano="grande" disabled={trabajando}>
          {trabajando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear la cuenta"}
        </Boton>
      </form>

      <button
        type="button"
        onClick={() => {
          setModo(modo === "entrar" ? "crear" : "entrar");
          setError("");
          setOk("");
        }}
        className="regla self-start text-[0.9rem] text-texto"
      >
        {modo === "entrar" ? "No tengo cuenta todavía" : "Ya tengo cuenta"}
      </button>

      <Aviso ok={ok} error={error} />
    </>
  );
}

function ConGoogle() {
  const [error, setError] = useState("");

  async function entrar() {
    setError("");
    try {
      const supabase = clienteNavegador();
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/registro` },
      });
      if (e) throw e;
    } catch (e) {
      setError(
        e instanceof Error && /provider is not enabled/i.test(e.message)
          ? "Google todavía no está activado en Supabase (Authentication → Sign In / Providers)."
          : e instanceof Error
            ? e.message
            : "No se ha podido entrar con Google.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-linea-suave pt-4">
      <Boton tono="secundario" onClick={() => void entrar()} className="w-full">
        Entrar con Google
      </Boton>
      {error ? (
        <p role="alert" className="text-[0.88rem] leading-snug text-margen">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[0.9rem] font-semibold text-tinta">
        {etiqueta}
      </label>
      <p id={`${id}-ayuda`} className="mb-1.5 text-[0.85rem] text-apagado">
        {ayuda}
      </p>
      {children}
    </div>
  );
}

function Aviso({ ok, error }: { ok: string; error: string }) {
  return (
    <p aria-live="polite" className="text-[0.92rem] leading-relaxed">
      {ok ? <span className="text-visto">{ok}</span> : null}
      {error ? <span className="text-margen">{error}</span> : null}
    </p>
  );
}

/** Los mensajes de Supabase llegan en inglés y son crípticos. */
function traducir(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) {
    return "Ese correo y esa contraseña no cuadran. Si acabas de crear la cuenta, confirma antes el correo.";
  }
  if (/email not confirmed/i.test(mensaje)) {
    return "Falta confirmar el correo: busca el mensaje de Supabase en tu bandeja.";
  }
  if (/user already registered/i.test(mensaje)) {
    return "Ya existe una cuenta con ese correo. Entra con tu contraseña o pide un enlace al correo.";
  }
  if (/signups not allowed|signup is disabled/i.test(mensaje)) {
    return "El registro está cerrado en esta copia. Pide que te den de alta.";
  }
  if (/password should be at least/i.test(mensaje)) {
    return "La contraseña es demasiado corta: mínimo seis caracteres.";
  }
  return mensaje || "No se ha podido completar la operación.";
}
