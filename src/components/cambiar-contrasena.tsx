"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Campo, EntradaClave, MedidorClave, MINIMO_CLAVE, claseEntrada, traducir } from "@/components/acceso";
import { useSesion } from "@/datos/sesion";

/**
 * Poner o cambiar la contraseña, como se hace en cualquier sitio: la nueva dos
 * veces, avisos claros si algo no cuadra y una confirmación visible al acabar.
 *
 * No se pide la actual: quien entró con Google o con el enlace del correo no
 * tiene ninguna. Si Supabase exige comprobar que eres tú (sesiones antiguas,
 * con "Secure password change" activado), manda un código al correo y se pide
 * aquí mismo, sin salir de la pantalla.
 */

type Errores = { clave?: string; repetida?: string; codigo?: string; general?: string };

export function CambiarContrasena() {
  const { cliente, usuario } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pideCodigo, setPideCodigo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [hecho, setHecho] = useState(false);

  const limpiar = (campo: keyof Errores) => setErrores((x) => ({ ...x, [campo]: undefined, general: undefined }));
  const coinciden = repetida.length > 0 && repetida === clave;

  function cerrar() {
    setAbierto(false);
    setClave("");
    setRepetida("");
    setCodigo("");
    setPideCodigo(false);
    setErrores({});
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) return;
    const nuevos: Errores = {};
    if (clave.length < MINIMO_CLAVE) {
      nuevos.clave = `Necesita al menos ${MINIMO_CLAVE} caracteres (llevas ${clave.length}).`;
    }
    if (!repetida) nuevos.repetida = "Repítela para comprobar que no hay erratas.";
    else if (repetida !== clave) nuevos.repetida = "Las dos no coinciden.";
    if (pideCodigo && !/^\d{6}$/.test(codigo.trim())) nuevos.codigo = "Escribe los 6 números del correo.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setGuardando(true);
    const { error } = await cliente.auth.updateUser(
      pideCodigo ? { password: clave, nonce: codigo.trim() } : { password: clave },
    );
    if (error && !pideCodigo && /reauthenticat|nonce/i.test(error.message)) {
      // Supabase quiere confirmar que eres tú: código al correo y seguimos.
      const { error: fallo } = await cliente.auth.reauthenticate();
      setGuardando(false);
      if (fallo) {
        setErrores({ general: traducir(fallo.message) });
        return;
      }
      setPideCodigo(true);
      return;
    }
    setGuardando(false);
    if (error) {
      setErrores(
        pideCodigo && /nonce|otp|token|expired|invalid/i.test(error.message)
          ? { codigo: "Ese código no vale o ha caducado. Revisa el último correo o pide otro cerrando y volviendo a guardar." }
          : { general: traducir(error.message) },
      );
      return;
    }
    cerrar();
    setHecho(true);
  }

  if (!abierto) {
    return (
      <div className="flex flex-col gap-3">
        {hecho ? (
          <p
            role="status"
            className="entra flex items-start gap-2 rounded-[14px] border-2 border-visto-vivo bg-visto-fondo px-4 py-3 text-[0.92rem] text-tinta"
          >
            <span aria-hidden="true" className="font-extrabold text-visto">
              ✔
            </span>
            <span>
              Contraseña cambiada. La próxima vez que entres con {usuario?.email ?? "tu correo"} y
              contraseña, usa la nueva. Google y el enlace al correo siguen funcionando igual.
            </span>
          </p>
        ) : null}
        <Boton
          tono="secundario"
          className="self-start"
          onClick={() => {
            setHecho(false);
            setAbierto(true);
          }}
        >
          Poner o cambiar contraseña
        </Boton>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} noValidate className="entra flex max-w-sm flex-col gap-4">
      <Campo id="clave-nueva" etiqueta="Contraseña nueva" ayuda={`Al menos ${MINIMO_CLAVE} caracteres.`} error={errores.clave}>
        <EntradaClave
          id="clave-nueva"
          valor={clave}
          onCambio={(v) => {
            setClave(v);
            limpiar("clave");
          }}
          autoComplete="new-password"
          error={Boolean(errores.clave)}
          describedBy={errores.clave ? "clave-nueva-error" : "clave-nueva-ayuda"}
        />
        <MedidorClave clave={clave} />
      </Campo>

      <Campo id="clave-repetida" etiqueta="Repite la contraseña nueva" error={errores.repetida}>
        <EntradaClave
          id="clave-repetida"
          valor={repetida}
          onCambio={(v) => {
            setRepetida(v);
            limpiar("repetida");
          }}
          autoComplete="new-password"
          error={Boolean(errores.repetida)}
          describedBy={errores.repetida ? "clave-repetida-error" : undefined}
        />
        {coinciden ? <p className="mt-1 text-[0.82rem] font-bold text-visto">✓ Coinciden</p> : null}
      </Campo>

      {pideCodigo ? (
        <Campo
          id="codigo-correo"
          etiqueta="Código del correo"
          ayuda={`Por seguridad te hemos mandado un código de 6 números a ${usuario?.email ?? "tu correo"}.`}
          error={errores.codigo}
        >
          <input
            id="codigo-correo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value.replace(/\D/g, ""));
              limpiar("codigo");
            }}
            aria-invalid={errores.codigo ? true : undefined}
            aria-describedby={errores.codigo ? "codigo-correo-error" : "codigo-correo-ayuda"}
            className={claseEntrada(Boolean(errores.codigo))}
          />
        </Campo>
      ) : null}

      {errores.general ? (
        <p role="alert" className="rounded-pliegue border-2 border-margen bg-margen-fondo px-4 py-2.5 text-[0.9rem] font-bold text-margen">
          {errores.general}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Boton type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : pideCodigo ? "Confirmar y guardar" : "Guardar la contraseña"}
        </Boton>
        <Boton tono="secundario" onClick={cerrar} disabled={guardando}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
