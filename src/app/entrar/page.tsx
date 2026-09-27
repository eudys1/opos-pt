"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import {
  Campo,
  ConGoogle,
  EntradaClave,
  ErrorDeVuelta,
  MarcoAcceso,
  Separador,
  SinCuentasTodavia,
  claseEntrada,
  correoValido,
  traducir,
} from "@/components/acceso";
import { clienteNavegador, hayNube } from "@/datos/supabase";

/**
 * Entrar, para quien ya tiene cuenta: Google, o correo y contraseña. Si no
 * recuerdas la contraseña, un enlace al correo te deja entrar y la cambias en
 * Mi cuenta. Crear cuenta está en su propia pantalla, como es lo habitual.
 */
export default function PaginaEntrar() {
  return (
    <MarcoAcceso titulo="Entrar" subtitulo="Con la cuenta que ya tienes.">
      <Suspense fallback={null}>
        <ErrorDeVuelta />
      </Suspense>
      {hayNube() ? <Acceso /> : <SinCuentasTodavia />}
    </MarcoAcceso>
  );
}

function Acceso() {
  const [conEnlace, setConEnlace] = useState(false);
  return (
    <>
      <Ficha destacada className="entra flex flex-col gap-5 px-6 py-7">
        <ConGoogle texto="Entrar con Google" />
        <Separador texto="o con tu correo" />
        {conEnlace ? (
          <ConEnlace volver={() => setConEnlace(false)} />
        ) : (
          <ConContrasena irAEnlace={() => setConEnlace(true)} />
        )}
      </Ficha>
      <p className="text-center text-[0.95rem] text-texto">
        ¿No tienes cuenta?{" "}
        <Link href="/crear-cuenta" className="regla font-extrabold text-acento">
          Crear cuenta
        </Link>
      </p>
    </>
  );
}

function ConContrasena({ irAEnlace }: { irAEnlace: () => void }) {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<{ correo?: string; clave?: string; general?: string }>({});
  const [entrando, setEntrando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const nuevos: typeof errores = {};
    if (!correo.trim()) nuevos.correo = "Escribe tu correo.";
    else if (!correoValido(correo)) nuevos.correo = "Ese correo no parece válido: revisa que tenga @ y dominio.";
    if (!clave) nuevos.clave = "Escribe tu contraseña.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEntrando(true);
    const { error } = await clienteNavegador().auth.signInWithPassword({ email: correo.trim(), password: clave });
    if (error) {
      setErrores({ general: traducir(error.message) });
      setEntrando(false);
      return;
    }
    router.push("/inicio");
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <Campo id="correo" etiqueta="Correo" error={errores.correo}>
        <input
          id="correo"
          type="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          value={correo}
          onChange={(e) => {
            setCorreo(e.target.value);
            setErrores((x) => ({ ...x, correo: undefined, general: undefined }));
          }}
          aria-invalid={errores.correo ? true : undefined}
          aria-describedby={errores.correo ? "correo-error" : undefined}
          className={claseEntrada(Boolean(errores.correo))}
        />
      </Campo>
      <Campo id="clave" etiqueta="Contraseña" error={errores.clave}>
        <EntradaClave
          id="clave"
          valor={clave}
          onCambio={(v) => {
            setClave(v);
            setErrores((x) => ({ ...x, clave: undefined, general: undefined }));
          }}
          autoComplete="current-password"
          error={Boolean(errores.clave)}
          describedBy={errores.clave ? "clave-error" : undefined}
        />
      </Campo>
      {errores.general ? (
        <p role="alert" className="rounded-pliegue border-2 border-margen bg-margen-fondo px-4 py-2.5 text-[0.9rem] font-bold text-margen">
          {errores.general}
        </p>
      ) : null}
      <Boton type="submit" tamano="grande" disabled={entrando}>
        {entrando ? "Entrando…" : "Entrar"}
      </Boton>
      <button type="button" onClick={irAEnlace} className="regla self-start text-[0.88rem] font-bold text-texto">
        ¿No recuerdas la contraseña, o nunca pusiste una? Entra con un enlace al correo
      </button>
    </form>
  );
}

function ConEnlace({ volver }: { volver: () => void }) {
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState("");
  const [estado, setEstado] = useState<"quieto" | "enviando" | "enviado">("quieto");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!correoValido(correo)) {
      setError(correo.trim() ? "Ese correo no parece válido." : "Escribe tu correo.");
      return;
    }
    setEstado("enviando");
    const { error: fallo } = await clienteNavegador().auth.signInWithOtp({
      email: correo.trim(),
      // Solo entrar: si el correo no tiene cuenta, no se crea una desde aquí.
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback?next=/inicio` },
    });
    if (fallo) {
      setEstado("quieto");
      setError(
        /signups not allowed|not found|otp_disabled/i.test(fallo.message)
          ? "No hay ninguna cuenta con ese correo. Si es la primera vez, crea una."
          : traducir(fallo.message),
      );
      return;
    }
    setEstado("enviado");
  }

  if (estado === "enviado") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[1.02rem] leading-relaxed text-tinta">
          Enlace enviado a <strong className="font-extrabold">{correo}</strong>.
        </p>
        <p className="text-[0.92rem] leading-relaxed text-apagado">
          Ábrelo en este mismo dispositivo y entras directamente. Caduca en una hora; si no lo ves, mira en
          spam. Una vez dentro, puedes poner una contraseña nueva en Mi cuenta.
        </p>
        <button type="button" onClick={volver} className="regla self-start text-[0.9rem] font-bold text-texto">
          ← Volver a entrar con contraseña
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <Campo id="correo-enlace" etiqueta="Correo" ayuda="Te llega un enlace para entrar sin contraseña." error={error}>
        <input
          id="correo-enlace"
          type="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          value={correo}
          onChange={(e) => {
            setCorreo(e.target.value);
            setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "correo-enlace-error" : "correo-enlace-ayuda"}
          className={claseEntrada(Boolean(error))}
        />
      </Campo>
      <Boton type="submit" tamano="grande" disabled={estado === "enviando"}>
        {estado === "enviando" ? "Enviando…" : "Enviarme el enlace"}
      </Boton>
      <button type="button" onClick={volver} className="regla self-start text-[0.88rem] font-bold text-texto">
        ← Volver a entrar con contraseña
      </button>
    </form>
  );
}
