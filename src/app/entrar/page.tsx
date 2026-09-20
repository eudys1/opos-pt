"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Ficha } from "@/components/ui/ficha";
import { Boton, BotonEnlace } from "@/components/ui/boton";
import { Marca } from "@/components/marcas";
import { clienteNavegador, hayNube } from "@/datos/supabase";

/**
 * Entrar.
 *
 * Una sola pantalla y una sola decisión: Google o tu correo. No hay "crear
 * cuenta" porque no hace falta: la primera vez que pides el enlace, la cuenta
 * se crea sola. La contraseña es opcional y se pone desde dentro; aquí solo
 * aparece si ya tienes una, escondida tras un enlace.
 */

export default function PaginaEntrar() {
  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-14 sm:px-8"
    >
      <div>
        <Link href="/" className="rounded-pliegue">
          <Marca />
          <span className="sr-only">Volver a la portada</span>
        </Link>
        <h1 className="mt-5 text-[2.2rem]">Entrar</h1>
        <p className="mt-1 text-[0.97rem] leading-relaxed text-apagado">
          Tu temario, tus marcas y tus exámenes viven en tu cuenta.
        </p>
      </div>

      <Suspense fallback={null}>
        <ErrorDeVuelta />
      </Suspense>

      {hayNube() ? <Acceso /> : <SinCuentasTodavia />}
    </main>
  );
}

/** El enlace del correo, si falla, vuelve aquí con el motivo en la URL. */
function ErrorDeVuelta() {
  const motivo = useSearchParams().get("error");
  if (!motivo) return null;

  const texto =
    motivo === "sin-codigo"
      ? "Ese enlace ya no vale: le faltaba el código. Pide uno nuevo."
      : /expired|invalid/i.test(motivo)
        ? "El enlace había caducado. Pide otro y ábrelo en menos de una hora."
        : traducir(motivo);

  return (
    <p role="alert" className="text-[0.92rem] leading-relaxed text-margen">
      {texto}
    </p>
  );
}

function Acceso() {
  const [conContrasena, setConContrasena] = useState(false);

  return (
    <Ficha className="flex flex-col gap-5 px-6 py-7">
      <ConGoogle />

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-linea" />
        <span className="text-[0.82rem] text-apagado">o con tu correo</span>
        <span className="h-px flex-1 bg-linea" />
      </div>

      {conContrasena ? (
        <ConContrasena volverAlEnlace={() => setConContrasena(false)} />
      ) : (
        <ConEnlace irAContrasena={() => setConContrasena(true)} />
      )}
    </Ficha>
  );
}

function ConGoogle() {
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");

  async function entrar() {
    setError("");
    setAbriendo(true);
    try {
      const supabase = clienteNavegador();
      const { error: fallo } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/registro` },
      });
      if (fallo) throw fallo;
    } catch (e) {
      setAbriendo(false);
      setError(
        e instanceof Error && /provider is not enabled/i.test(e.message)
          ? "Google todavía no está activado en esta copia. Entra con tu correo."
          : e instanceof Error
            ? e.message
            : "No se ha podido entrar con Google.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Boton
        tono="secundario"
        tamano="grande"
        onClick={() => void entrar()}
        disabled={abriendo}
        className="w-full"
      >
        <LogoGoogle />
        {abriendo ? "Abriendo Google…" : "Continuar con Google"}
      </Boton>
      {error ? (
        <p role="alert" className="text-[0.88rem] leading-snug text-margen">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ConEnlace({ irAContrasena }: { irAContrasena: () => void }) {
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<"quieto" | "enviando" | "enviado" | "error">("quieto");
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setError("");
    try {
      const supabase = clienteNavegador();
      const { error: fallo } = await supabase.auth.signInWithOtp({
        email: correo,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/registro` },
      });
      if (fallo) throw fallo;
      setEstado("enviado");
    } catch (e) {
      setEstado("error");
      setError(traducir(e instanceof Error ? e.message : ""));
    }
  }

  if (estado === "enviado") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[1.02rem] leading-relaxed text-tinta">
          Enlace enviado a <strong className="font-semibold">{correo}</strong>.
        </p>
        <p className="text-[0.92rem] leading-relaxed text-apagado">
          Ábrelo en este mismo dispositivo y entras directamente. Caduca en una hora; si no lo ves,
          mira en spam.
        </p>
        <button
          type="button"
          onClick={() => setEstado("quieto")}
          className="regla self-start text-[0.9rem] text-texto"
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <>
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
            placeholder="tucorreo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="mt-1.5 w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.98rem]"
          />
        </div>

        <Boton type="submit" tamano="grande" disabled={estado === "enviando"}>
          {estado === "enviando" ? "Enviando…" : "Enviarme un enlace para entrar"}
        </Boton>
      </form>

      <p className="-mt-2 text-[0.88rem] leading-relaxed text-apagado">
        Sin contraseñas: pinchas el enlace y ya estás dentro. La primera vez, la cuenta se crea
        sola.
      </p>

      {error ? (
        <p role="alert" className="text-[0.92rem] leading-relaxed text-margen">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={irAContrasena}
        className="regla self-start text-[0.88rem] text-texto"
      >
        Tengo contraseña, prefiero usarla
      </button>
    </>
  );
}

function ConContrasena({ volverAlEnlace }: { volverAlEnlace: () => void }) {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setError("");
    try {
      const supabase = clienteNavegador();
      const { error: fallo } = await supabase.auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });
      if (fallo) throw fallo;
      router.push("/registro");
    } catch (e) {
      setError(traducir(e instanceof Error ? e.message : ""));
      setEntrando(false);
    }
  }

  return (
    <>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div>
          <label htmlFor="correo-clave" className="block text-[0.9rem] font-semibold text-tinta">
            Tu correo
          </label>
          <input
            id="correo-clave"
            type="email"
            required
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="mt-1.5 w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.98rem]"
          />
        </div>

        <div>
          <label htmlFor="clave" className="block text-[0.9rem] font-semibold text-tinta">
            Contraseña
          </label>
          <input
            id="clave"
            type="password"
            required
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            className="mt-1.5 w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.98rem]"
          />
        </div>

        <Boton type="submit" tamano="grande" disabled={entrando}>
          {entrando ? "Entrando…" : "Entrar"}
        </Boton>
      </form>

      {error ? (
        <p role="alert" className="text-[0.92rem] leading-relaxed text-margen">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={volverAlEnlace}
        className="regla self-start text-[0.88rem] text-texto"
      >
        No la recuerdo: mándame un enlace al correo
      </button>
    </>
  );
}

function SinCuentasTodavia() {
  return (
    <>
      <Ficha className="flex flex-col gap-3 px-6 py-6">
        <h2 className="text-xl">Esta copia no tiene cuentas configuradas</h2>
        <p className="text-[0.97rem] leading-relaxed text-texto">
          El cuaderno necesita cuenta para funcionar, y aquí todavía no están puestas las claves de
          la base de datos.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <BotonEnlace href="/">Volver a la portada</BotonEnlace>
        </div>
      </Ficha>

      <Ficha className="border-dashed px-6 py-6">
        <h2 className="text-lg">Qué falta</h2>
        <ol className="mt-3 flex flex-col gap-2 text-[0.95rem] leading-relaxed text-texto">
          <li>1. Crear un proyecto gratuito en supabase.com.</li>
          <li>2. Pegar su URL y su publishable key en el archivo .env.local del proyecto.</li>
          <li>3. Ejecutar las migraciones que están en supabase/migrations.</li>
        </ol>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-apagado">
          Los pasos exactos están en el README.
        </p>
      </Ficha>
    </>
  );
}

/** La G de Google, para que el botón se reconozca de un vistazo. */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/** Los mensajes de Supabase llegan en inglés y son crípticos. */
function traducir(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) {
    return "Ese correo y esa contraseña no cuadran. Si nunca pusiste una, entra con el enlace al correo.";
  }
  if (/email not confirmed/i.test(mensaje)) {
    return "Falta confirmar el correo: busca el mensaje en tu bandeja.";
  }
  if (/signups not allowed|signup is disabled/i.test(mensaje)) {
    return "El registro está cerrado en esta copia. Pide que te den de alta.";
  }
  if (/rate limit|too many requests/i.test(mensaje)) {
    return "Has pedido varios enlaces seguidos. Espera un minuto y vuelve a intentarlo.";
  }
  if (/for security purposes/i.test(mensaje)) {
    return "Espera unos segundos antes de pedir otro enlace.";
  }
  return mensaje || "No se ha podido completar la operación.";
}
