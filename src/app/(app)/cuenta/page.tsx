"use client";

import { useState } from "react";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { Boton } from "@/components/ui/boton";
import { SelectorTema } from "@/components/selector-tema";
import { ExportarDatos } from "@/components/exportar-datos";
import { CambiarContrasena } from "@/components/cambiar-contrasena";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { diasParaExamen } from "@/nucleo/racha";
import { fechaLarga, hoyISO } from "@/nucleo/fechas";

/**
 * Mi cuenta: lo que es de la persona y no del temario. La fecha del examen,
 * cómo se ve la app, cómo se entra, sacar una copia de todo y salir.
 */
export default function PaginaCuenta() {
  const { perfil, guardarPerfil } = useCuaderno();
  const { usuario, estadoNube, mensaje, salir } = useSesion();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-[2.1rem]">Mi cuenta</h1>
        <p className="mt-1 text-[0.98rem] text-texto">{usuario?.email}</p>
      </header>

      <FechaExamen guardada={perfil.fechaExamen} onGuardar={(f) => guardarPerfil({ fechaExamen: f })} />

      <Ficha className="flex flex-col gap-3 px-6 py-5">
        <h2 className="text-xl">Aspecto</h2>
        <p className="text-[0.92rem] text-texto">
          Claro u oscuro. Se guarda en este navegador.
        </p>
        <SelectorTema className="self-start" />
      </Ficha>

      <Ficha className="flex flex-col gap-3 px-6 py-5">
        <h2 className="text-xl">Cómo entras</h2>
        <p className="max-w-[62ch] text-[0.92rem] leading-relaxed text-texto">
          Entras con Google o con un enlace al correo. Si prefieres una contraseña, puedes ponerla
          aquí y usarla también.
        </p>
        <CambiarContrasena />
      </Ficha>

      <Ficha className="flex flex-col gap-3 px-6 py-5">
        <h2 className="text-xl">Tus datos</h2>
        <p className="flex items-center gap-2 text-[0.92rem] text-texto">
          <span
            aria-hidden="true"
            className={
              estadoNube === "error"
                ? "inline-block h-2 w-2 rounded-full bg-margen"
                : estadoNube === "sincronizando"
                  ? "inline-block h-2 w-2 rounded-full bg-aviso-vivo"
                  : "inline-block h-2 w-2 rounded-full bg-visto-vivo"
            }
          />
          <span aria-live="polite">
            {estadoNube === "sincronizando"
              ? "Guardando en tu cuenta…"
              : estadoNube === "error"
                ? "No se ha podido guardar el último cambio."
                : "Todo está guardado en tu cuenta."}
          </span>
        </p>
        {mensaje ? <p className="text-[0.85rem] text-apagado">{mensaje}</p> : null}
        <ExportarDatos />
      </Ficha>

      <div className="flex flex-wrap items-center gap-3 border-t border-linea pt-5">
        <Boton tono="secundario" onClick={() => void salir()}>
          Cerrar sesión
        </Boton>
        <p className="text-[0.85rem] text-apagado">
          Lo que tienes está guardado en tu cuenta: al volver a entrar aparece igual.
        </p>
      </div>
    </div>
  );
}

/**
 * La fecha del examen no se guarda al tocar el calendario: se cambia, se ve
 * cuántos días saldrían y se guarda o se deshace con un botón. Mover la fecha
 * cambia la cuenta atrás y el ritmo de toda la app, así que va a propósito.
 */
function FechaExamen({
  guardada,
  onGuardar,
}: {
  guardada: string | undefined;
  onGuardar: (fecha: string | undefined) => void;
}) {
  const [borrador, setBorrador] = useState(guardada ?? "");
  const [base, setBase] = useState(guardada);
  const [error, setError] = useState("");
  const [recienGuardada, setRecienGuardada] = useState(false);
  // Si la fecha cambia fuera (llega de la nube o de otra pestaña) y aquí no
  // había nada a medias, se muestra la nueva.
  if (guardada !== base) {
    setBase(guardada);
    if (borrador === (base ?? "")) setBorrador(guardada ?? "");
  }
  const cambiada = borrador !== (guardada ?? "");
  const dias = diasParaExamen(borrador || undefined);

  function guardar() {
    if (borrador && borrador < hoyISO()) {
      setError("Esa fecha ya ha pasado. Elige una de aquí en adelante.");
      return;
    }
    onGuardar(borrador || undefined);
    setRecienGuardada(true);
  }

  return (
    <Ficha className="flex flex-col gap-4 px-6 py-5">
      <h2 className="text-xl">Fecha del examen</h2>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label htmlFor="fecha-examen" className="block text-[0.9rem] font-semibold text-tinta">
            Fecha estimada
          </label>
          <input
            id="fecha-examen"
            type="date"
            value={borrador}
            onChange={(e) => {
              setBorrador(e.target.value);
              setError("");
              setRecienGuardada(false);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "fecha-examen-error" : "fecha-examen-ayuda"}
            className="mt-1.5 min-h-11 rounded-pliegue border-2 border-linea bg-papel-alto px-4 py-2"
          />
        </div>
        {dias !== null ? (
          <p className="flex items-baseline gap-2">
            <span
              key={dias}
              className={clsx("entra font-display text-[2.4rem] font-bold leading-none", cambiada ? "text-apagado" : "text-acento")}
              data-numerico
            >
              {dias}
            </span>
            <span className="text-[0.95rem] text-texto">días{cambiada ? " si la guardas" : ""}</span>
          </p>
        ) : null}
      </div>

      {cambiada ? (
        <div className="entra flex flex-wrap items-center gap-2">
          <Boton onClick={guardar}>{borrador ? "Guardar la fecha" : "Quitar la fecha"}</Boton>
          <Boton
            tono="secundario"
            onClick={() => {
              setBorrador(guardada ?? "");
              setError("");
            }}
          >
            Cancelar
          </Boton>
          <span className="text-[0.85rem] text-apagado">
            {guardada ? `Ahora tienes el ${fechaLarga(guardada)}.` : "Aún no tienes fecha guardada."}
          </span>
        </div>
      ) : recienGuardada ? (
        <p role="status" className="entra text-[0.9rem] font-bold text-visto">
          ✔ Fecha guardada. La cuenta atrás ya cuenta desde aquí.
        </p>
      ) : null}

      {error ? (
        <p id="fecha-examen-error" role="alert" className="text-[0.9rem] font-bold text-margen">
          {error}
        </p>
      ) : null}

      <p id="fecha-examen-ayuda" className="max-w-[62ch] text-[0.88rem] leading-relaxed text-apagado">
        {guardada && !cambiada ? `${fechaLarga(guardada)}. ` : ""}
        En Andalucía las plazas de Maestros se aplazaron a 2027: pon una fecha aproximada y
        cámbiala cuando salga la convocatoria. De ella salen la cuenta atrás y el ritmo que
        necesitas.
      </p>
    </Ficha>
  );
}
