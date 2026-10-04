"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Boton, BotonEnlace } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Marca } from "@/components/marcas";
import { SelectorTema } from "@/components/selector-tema";
import { clienteNavegador } from "@/datos/supabase";

/**
 * Piezas compartidas por /entrar y /crear-cuenta, para que las dos pantallas
 * se vean y se comporten igual.
 */

export function MarcoAcceso({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <main id="contenido" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-12 sm:px-8">
      <div className="entra">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="rounded-pliegue">
            <Marca />
            <span className="sr-only">Volver a la portada</span>
          </Link>
          <SelectorTema />
        </div>
        <h1 className="mt-5 text-[2.2rem]">{titulo}</h1>
        <p className="mt-1 text-[0.97rem] leading-relaxed text-apagado">{subtitulo}</p>
      </div>
      {children}
    </main>
  );
}

export function ConGoogle({ texto }: { texto: string }) {
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");

  async function entrar() {
    setError("");
    setAbriendo(true);
    try {
      const { error: fallo } = await clienteNavegador().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/inicio` },
      });
      if (fallo) throw fallo;
    } catch (e) {
      setAbriendo(false);
      setError(
        e instanceof Error && /provider is not enabled/i.test(e.message)
          ? "Google todavía no está activado en esta copia. Usa tu correo."
          : traducir(e instanceof Error ? e.message : ""),
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Boton tono="secundario" tamano="grande" onClick={() => void entrar()} disabled={abriendo} className="w-full">
        <LogoGoogle />
        {abriendo ? "Abriendo Google…" : texto}
      </Boton>
      {error ? (
        <p role="alert" className="text-[0.88rem] font-bold text-margen">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Separador({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-0.5 flex-1 rounded-full bg-linea" />
      <span className="text-[0.82rem] font-bold text-apagado">{texto}</span>
      <span className="h-0.5 flex-1 rounded-full bg-linea" />
    </div>
  );
}

/** Campo con su etiqueta, su ayuda y su error, bien enlazados para lectores de pantalla. */
export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[0.9rem] font-extrabold text-tinta">
        {etiqueta}
      </label>
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-[0.8rem] text-apagado">
          {ayuda}
        </p>
      ) : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[0.85rem] font-bold text-margen">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function claseEntrada(conError: boolean) {
  return clsx(
    "w-full rounded-pliegue border-2 bg-papel-alto px-4 py-3 text-[0.98rem]",
    conError ? "border-margen" : "border-campo hover:border-campo-foco focus:border-campo-foco",
  );
}

/** Contraseña con botón de ver u ocultar. */
export function EntradaClave({
  id,
  valor,
  onCambio,
  autoComplete,
  error,
  describedBy,
}: {
  id: string;
  valor: string;
  onCambio: (v: string) => void;
  autoComplete: string;
  error?: boolean;
  describedBy?: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={ver ? "text" : "password"}
        autoComplete={autoComplete}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(claseEntrada(Boolean(error)), "pr-20")}
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-pressed={ver}
        className="absolute inset-y-1 right-1 rounded-[10px] px-3 text-[0.8rem] font-extrabold text-apagado hover:bg-papel-franja hover:text-tinta"
      >
        {ver ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}

/** El enlace del correo, si falla, vuelve con el motivo en la URL. */
export function ErrorDeVuelta() {
  const motivo = useSearchParams().get("error");
  if (!motivo) return null;
  const texto =
    motivo === "sin-codigo"
      ? "Ese enlace ya no vale: le faltaba el código. Pide uno nuevo."
      : /expired|invalid/i.test(motivo)
        ? "El enlace había caducado. Pide otro y ábrelo en menos de una hora."
        : traducir(motivo);
  return (
    <p role="alert" className="rounded-pliegue border-2 border-margen bg-margen-fondo px-4 py-3 text-[0.92rem] font-bold text-margen">
      {texto}
    </p>
  );
}

export function SinCuentasTodavia() {
  return (
    <Ficha className="flex flex-col gap-3 px-6 py-6">
      <h2 className="text-xl">Esta copia no tiene cuentas configuradas</h2>
      <p className="text-[0.97rem] leading-relaxed text-texto">
        Faltan las claves de la base de datos en <code>.env.local</code>. Los pasos están en el README.
      </p>
      <BotonEnlace href="/" className="self-start">
        Volver a la portada
      </BotonEnlace>
    </Ficha>
  );
}

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
}

/** Mínimo de caracteres de una contraseña, al crearla o al cambiarla. */
export const MINIMO_CLAVE = 8;

/** Una pista de lo fuerte que es la contraseña, sin agobiar: tres tramos. */
export function MedidorClave({ clave }: { clave: string }) {
  if (!clave) return null;
  const puntos =
    (clave.length >= MINIMO_CLAVE ? 1 : 0) +
    (clave.length >= 12 ? 1 : 0) +
    (/[0-9]/.test(clave) && /[^A-Za-z0-9]/.test(clave) ? 1 : /[0-9]|[^A-Za-z0-9]/.test(clave) ? 0.5 : 0);
  const nivel = puntos >= 2.5 ? 3 : puntos >= 1.5 ? 2 : 1;
  const texto = ["", "Floja", "Aceptable", "Fuerte"][nivel];
  const color = ["", "bg-margen", "bg-aviso-vivo", "bg-visto-vivo"][nivel];
  return (
    <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= nivel ? color : "bg-linea-suave"}`} />
        ))}
      </div>
      <span className="text-[0.78rem] font-bold text-apagado">{texto}</span>
    </div>
  );
}

/** Los mensajes de Supabase llegan en inglés y son crípticos. */
export function traducir(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) {
    return "Ese correo y esa contraseña no cuadran. Revísalos, o entra con un enlace al correo.";
  }
  if (/email not confirmed/i.test(mensaje)) {
    return "Falta confirmar el correo: busca el mensaje que te llegó al crear la cuenta.";
  }
  if (/user already registered|already been registered/i.test(mensaje)) {
    return "Ya hay una cuenta con ese correo. Entra con ella en vez de crear otra.";
  }
  if (/signups not allowed|signup is disabled/i.test(mensaje)) {
    return "Esta copia ya no admite cuentas nuevas. Si ya tienes una, entra con ella.";
  }
  if (/password should be at least|weak password/i.test(mensaje)) {
    return "La contraseña es demasiado débil: al menos 8 caracteres.";
  }
  if (/should be different from the old/i.test(mensaje)) {
    return "Es la misma contraseña que ya tenías. Elige otra distinta.";
  }
  if (/reauthenticat/i.test(mensaje)) {
    return "Por seguridad, sal, vuelve a entrar y repite el cambio.";
  }
  if (/rate limit|too many requests/i.test(mensaje)) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  }
  if (/for security purposes/i.test(mensaje)) {
    return "Espera unos segundos antes de volver a intentarlo.";
  }
  return mensaje || "No se ha podido completar. Vuelve a intentarlo.";
}

function LogoGoogle() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
