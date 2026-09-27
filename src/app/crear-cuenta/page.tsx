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
  MedidorClave,
  MINIMO_CLAVE,
  Separador,
  SinCuentasTodavia,
  claseEntrada,
  correoValido,
  traducir,
} from "@/components/acceso";
import { clienteNavegador, hayNube } from "@/datos/supabase";

/**
 * Crear cuenta: con Google (un clic) o con correo y contraseña, repetida para
 * no equivocarse. Si el registro está cerrado en esta copia, lo dice claro.
 */

export default function PaginaCrearCuenta() {
  return (
    <MarcoAcceso titulo="Crear cuenta" subtitulo="Para guardar tu temario, tus repasos y tus simulacros.">
      <Suspense fallback={null}>
        <ErrorDeVuelta />
      </Suspense>
      {hayNube() ? <Registro /> : <SinCuentasTodavia />}
    </MarcoAcceso>
  );
}

function Registro() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [errores, setErrores] = useState<{ correo?: string; clave?: string; repetida?: string; general?: string }>({});
  const [estado, setEstado] = useState<"quieto" | "creando" | "confirmar">("quieto");

  const limpiar = (campo: keyof typeof errores) => setErrores((x) => ({ ...x, [campo]: undefined, general: undefined }));

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const nuevos: typeof errores = {};
    if (!correo.trim()) nuevos.correo = "Escribe tu correo.";
    else if (!correoValido(correo)) nuevos.correo = "Ese correo no parece válido: revisa que tenga @ y dominio.";
    if (clave.length < MINIMO_CLAVE) {
      nuevos.clave = `La contraseña necesita al menos ${MINIMO_CLAVE} caracteres (llevas ${clave.length}).`;
    }
    if (!repetida) nuevos.repetida = "Repite la contraseña para comprobar que no hay erratas.";
    else if (repetida !== clave) nuevos.repetida = "Las dos contraseñas no coinciden.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEstado("creando");
    const { data, error } = await clienteNavegador().auth.signUp({
      email: correo.trim(),
      password: clave,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/inicio` },
    });
    if (error) {
      setEstado("quieto");
      setErrores({ general: traducir(error.message) });
      return;
    }
    if (data.session) router.push("/inicio");
    else setEstado("confirmar");
  }

  if (estado === "confirmar") {
    return (
      <Ficha destacada className="entra flex flex-col gap-3 px-6 py-7">
        <h2 className="text-[1.3rem]">Revisa tu correo</h2>
        <p className="text-[0.97rem] leading-relaxed text-texto">
          Te hemos enviado un mensaje a <strong className="font-extrabold">{correo}</strong> para confirmar la
          cuenta. Pulsa el enlace y entrarás directamente. Si no lo ves, mira en spam.
        </p>
      </Ficha>
    );
  }

  const coinciden = repetida.length > 0 && repetida === clave;

  return (
    <>
      <Ficha destacada className="entra flex flex-col gap-5 px-6 py-7">
        <ConGoogle texto="Crear cuenta con Google" />
        <Separador texto="o con tu correo" />
        <form onSubmit={crear} noValidate className="flex flex-col gap-4">
          <Campo id="correo" etiqueta="Correo" error={errores.correo}>
            <input
              id="correo"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={correo}
              onChange={(e) => {
                setCorreo(e.target.value);
                limpiar("correo");
              }}
              aria-invalid={errores.correo ? true : undefined}
              aria-describedby={errores.correo ? "correo-error" : undefined}
              className={claseEntrada(Boolean(errores.correo))}
            />
          </Campo>
          <Campo
            id="clave"
            etiqueta="Contraseña"
            ayuda={`Al menos ${MINIMO_CLAVE} caracteres.`}
            error={errores.clave}
          >
            <EntradaClave
              id="clave"
              valor={clave}
              onCambio={(v) => {
                setClave(v);
                limpiar("clave");
              }}
              autoComplete="new-password"
              error={Boolean(errores.clave)}
              describedBy={errores.clave ? "clave-error" : "clave-ayuda"}
            />
            <MedidorClave clave={clave} />
          </Campo>
          <Campo id="repetida" etiqueta="Repite la contraseña" error={errores.repetida}>
            <EntradaClave
              id="repetida"
              valor={repetida}
              onCambio={(v) => {
                setRepetida(v);
                limpiar("repetida");
              }}
              autoComplete="new-password"
              error={Boolean(errores.repetida)}
              describedBy={errores.repetida ? "repetida-error" : undefined}
            />
            {coinciden ? <p className="mt-1 text-[0.82rem] font-bold text-visto">✓ Coinciden</p> : null}
          </Campo>
          {errores.general ? (
            <p role="alert" className="rounded-pliegue border-2 border-margen bg-margen-fondo px-4 py-2.5 text-[0.9rem] font-bold text-margen">
              {errores.general}
            </p>
          ) : null}
          <Boton type="submit" tamano="grande" disabled={estado === "creando"}>
            {estado === "creando" ? "Creando la cuenta…" : "Crear cuenta"}
          </Boton>
        </form>
      </Ficha>
      <p className="text-center text-[0.95rem] text-texto">
        ¿Ya tienes cuenta?{" "}
        <Link href="/entrar" className="regla font-extrabold text-acento">
          Entrar
        </Link>
      </p>
    </>
  );
}
