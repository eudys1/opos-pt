"use client";

import Link from "next/link";
import { useState } from "react";
import { useSesion } from "@/datos/sesion";

/**
 * Dice siempre dónde se están guardando los datos. Es la diferencia entre
 * "esto solo está en este portátil" y "esto está en mi cuenta", que en una
 * oposición de dos años importa bastante.
 *
 * También es donde se pone la contraseña, si se quiere una: en la pantalla de
 * entrar no hay "crear cuenta" ni "elegir contraseña", porque allí lo único que
 * hace falta es el correo.
 */
export function EstadoCuenta() {
  const { usuario, estadoNube, mensaje, salir } = useSesion();

  if (estadoNube === "sin-nube") {
    return (
      <p className="text-[0.8rem] leading-relaxed text-apagado">
        Guardado <strong className="font-semibold">solo en este navegador</strong>. Sin cuenta
        todavía.
      </p>
    );
  }

  if (!usuario) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[0.8rem] leading-relaxed text-apagado">
          Guardado solo en este navegador.
        </p>
        <Link href="/entrar" className="regla self-start text-[0.85rem] font-semibold text-tinta">
          Entrar para sincronizar
        </Link>
      </div>
    );
  }

  const etiqueta =
    estadoNube === "sincronizando"
      ? "Guardando…"
      : estadoNube === "error"
        ? "No se ha podido guardar"
        : "Guardado en tu cuenta";

  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-[0.8rem] text-apagado">
        <span
          aria-hidden="true"
          className={
            estadoNube === "error"
              ? "inline-block h-2 w-2 rounded-full bg-margen"
              : estadoNube === "sincronizando"
                ? "inline-block h-2 w-2 rounded-full bg-margen-hilo"
                : "inline-block h-2 w-2 rounded-full bg-visto"
          }
        />
        <span aria-live="polite">{etiqueta}</span>
      </p>
      <p className="truncate text-[0.8rem] text-tenue" title={usuario.email ?? undefined}>
        {usuario.email}
      </p>
      {mensaje ? <p className="text-[0.78rem] leading-snug text-apagado">{mensaje}</p> : null}

      <Contrasena />

      <button type="button" onClick={salir} className="regla self-start text-[0.8rem] text-texto">
        Salir
      </button>
    </div>
  );
}

/** Opcional: quien prefiera contraseña a enlace del correo, la pone aquí. */
function Contrasena() {
  const { cliente } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) return;
    setGuardando(true);
    setError("");
    setAviso("");
    const { error: fallo } = await cliente.auth.updateUser({ password: clave });
    setGuardando(false);
    if (fallo) {
      setError(
        /at least/i.test(fallo.message)
          ? "Demasiado corta: mínimo seis caracteres."
          : fallo.message,
      );
      return;
    }
    setClave("");
    setAbierto(false);
    setAviso("Contraseña guardada. Ya puedes entrar con ella.");
  }

  if (!abierto) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="regla self-start text-[0.8rem] text-texto"
        >
          Poner o cambiar contraseña
        </button>
        {aviso ? (
          <p aria-live="polite" className="text-[0.78rem] leading-snug text-visto">
            {aviso}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <form onSubmit={guardar} className="mt-1 flex flex-col gap-2">
      <label htmlFor="clave-nueva" className="text-[0.8rem] text-apagado">
        Contraseña nueva (mínimo seis)
      </label>
      <input
        id="clave-nueva"
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={clave}
        onChange={(e) => setClave(e.target.value)}
        className="w-full rounded-pliegue border border-linea bg-papel-alto px-3 py-2 text-[0.9rem]"
      />
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="regla text-[0.8rem] font-semibold text-tinta disabled:opacity-55"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setClave("");
            setError("");
          }}
          className="regla text-[0.8rem] text-texto"
        >
          Dejarlo
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-[0.78rem] leading-snug text-margen">
          {error}
        </p>
      ) : null}
    </form>
  );
}
