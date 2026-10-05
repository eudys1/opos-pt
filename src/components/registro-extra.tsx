"use client";

import { useState } from "react";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { CampoFecha, CampoTexto } from "@/components/ui/campos";
import { Visto } from "@/components/marcas";
import { useCuaderno } from "@/datos/almacen";
import { empezadoDesde, inicioPrevistoDe } from "@/nucleo/agenda";
import { cuando, fechaCorta, fechaLarga, hoyISO } from "@/nucleo/fechas";
import { proximoNumeroDeRepaso } from "@/nucleo/repasos";
import type { Tema } from "@/nucleo/tipos";

/**
 * Lo que el Registro añade a la tabla de hitos: el día previsto para empezar
 * cada tema y el número de repasos.
 *
 * El inicio previsto es un objetivo del tema (src/nucleo/agenda.ts): por eso
 * sale también en el planificador, el día que toca, y marcarlo allí o aquí es
 * lo mismo.
 */

// --------------------------------------------------------- inicio previsto

export function CeldaInicio({
  tema,
  practicado,
  onPulsar,
}: {
  tema: Tema;
  /** Tiene prácticas en la cuenta (test, cortas…), aunque no esté marcado como estudiado. */
  practicado: boolean;
  onPulsar: () => void;
}) {
  const { objetivos, eventos } = useCuaderno();
  const inicio = inicioPrevistoDe(objetivos, tema.id);
  const hoy = hoyISO();
  const base =
    "inline-flex min-h-11 min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-pliegue border-2 px-2 text-[0.78rem] transition-colors";

  // Si el propio registro ya dice que lo empezaste (estudiado, repasos o
  // prácticas), no hay nada que planear ni que marcar: se enseña y punto, con
  // el día real en que empezó.
  const empezado = empezadoDesde(tema.id, eventos, objetivos);
  const hayPruebas = eventos.some((e) => e.temaId === tema.id) || practicado;
  if (hayPruebas) {
    const porque =
      tema.estadoEstudio !== "por_estudiar" ? "tiene marcado el estudiado" : "ya has practicado con él";
    return (
      <button
        type="button"
        onClick={onPulsar}
        title={`Ya lo empezaste: ${porque}. Pulsa para cambiar el día.`}
        className={clsx(base, "border-transparent text-sec-temario hover:border-linea hover:bg-papel-alto")}
      >
        <Visto className="h-4 w-4" animado={false} tono="text-current" />
        <span className="text-apagado" data-numerico>
          {empezado ? fechaCorta(empezado.fecha) : "empezado"}
        </span>
        {/* De dónde sale: si quitas tu día, se ve que sigue empezado por el estudiado. */}
        <span className="text-[0.64rem] font-extrabold leading-none text-tenue">
          {empezado?.motivo === "marcado" ? "tuyo" : tema.estadoEstudio !== "por_estudiar" ? "estudiado" : "práctica"}
        </span>
        <span className="sr-only">
          Empezado{empezado ? ` el ${fechaLarga(empezado.fecha)}` : ""}: {porque}. Cambiar.
        </span>
      </button>
    );
  }

  if (!inicio) {
    return (
      <button
        type="button"
        onClick={onPulsar}
        className={clsx(base, "border-dashed border-linea text-tenue hover:border-sec-temario-vivo hover:text-sec-temario")}
      >
        <span aria-hidden="true" className="text-[1rem] leading-none">
          +
        </span>
        <span>planear</span>
        <span className="sr-only">el día para empezar el tema {tema.numero}</span>
      </button>
    );
  }

  if (inicio.hecho) {
    return (
      <button
        type="button"
        onClick={onPulsar}
        className={clsx(base, "border-transparent text-sec-temario hover:border-linea hover:bg-papel-alto")}
      >
        <Visto className="h-4 w-4" animado={false} tono="text-current" />
        <span className="text-apagado" data-numerico>
          {fechaCorta(inicio.fecha)}
        </span>
        <span className="sr-only">Empezado. Cambiar</span>
      </button>
    );
  }

  const tarde = inicio.fecha < hoy;
  return (
    <button
      type="button"
      onClick={onPulsar}
      className={clsx(
        base,
        tarde
          ? "border-margen bg-margen-fondo text-margen"
          : inicio.fecha === hoy
            ? "border-sec-temario-vivo bg-sec-temario-fondo text-sec-temario"
            : "border-linea text-apagado hover:border-sec-temario-vivo",
      )}
    >
      <span className="font-extrabold" data-numerico>
        {fechaCorta(inicio.fecha)}
      </span>
      <span>{tarde ? "va tarde" : inicio.fecha === hoy ? "hoy" : "previsto"}</span>
    </button>
  );
}

export function EditorInicio({
  tema,
  practicado,
  onCerrar,
}: {
  tema: Tema | null;
  practicado: boolean;
  onCerrar: () => void;
}) {
  return (
    <Dialogo
      abierto={tema !== null}
      onCerrar={onCerrar}
      titulo={tema ? `Empezar el tema ${tema.numero}` : ""}
      subtitulo="Es el mismo dato que «Empezar el tema» del planificador: lo que cambies aquí, cambia allí."
    >
      {/* Se monta de nuevo con cada tema: el borrador nace de lo guardado. */}
      {tema ? <FormularioInicio key={tema.id} tema={tema} practicado={practicado} onCerrar={onCerrar} /> : null}
    </Dialogo>
  );
}

function FormularioInicio({
  tema,
  practicado,
  onCerrar,
}: {
  tema: Tema;
  practicado: boolean;
  onCerrar: () => void;
}) {
  const { objetivos, eventos, planearInicio, quitarInicio } = useCuaderno();
  const inicio = inicioPrevistoDe(objetivos, tema.id);
  const empezado = empezadoDesde(tema.id, eventos, objetivos);
  // Lo que el registro prueba por sí mismo, sin contar lo marcado a mano.
  const conEstudiado = tema.estadoEstudio !== "por_estudiar";
  const pruebas = conEstudiado || practicado || eventos.some((e) => e.temaId === tema.id);
  const porque = conEstudiado ? "tiene marcado el estudiado" : "ya has practicado con él";
  const [fecha, setFecha] = useState(empezado?.fecha ?? inicio?.fecha ?? hoyISO());
  const [error, setError] = useState("");

  /** Guarda el día y, si se indica, si ya está empezado. */
  function guardar(hecho?: boolean) {
    if (!fecha) {
      setError("Elige un día, o pulsa «Cancelar» para dejarlo como estaba.");
      return;
    }
    planearInicio(tema.id, fecha, hecho);
    onCerrar();
  }

  const quitar = (
    <Boton
      tono="fantasma"
      onClick={() => {
        quitarInicio(tema.id);
        onCerrar();
      }}
    >
      {pruebas ? "Quitar mi día" : "Quitar la fecha"}
    </Boton>
  );

  // --- Ya consta como empezado: se puede corregir el día, o quitar el puesto a mano.
  if (pruebas) {
    const propio = inicio?.hecho;
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-pliegue bg-sec-temario-fondo px-4 py-3 text-[0.9rem] leading-relaxed text-tinta">
          Cuenta como empezado porque {porque}.{" "}
          {propio
            ? `El día lo has puesto tú: el ${fechaLarga(inicio.fecha)}.`
            : empezado
              ? `Se toma el primer día con algo hecho: el ${fechaLarga(empezado.fecha)}.`
              : ""}
        </p>
        <CampoFecha
          etiqueta="Día en que lo empezaste"
          valor={fecha}
          maximo={hoyISO()}
          onCambio={(f) => {
            setFecha(f);
            setError("");
          }}
          error={error}
          ayuda="Si lo empezaste a leer antes de marcarlo, pon ese día."
        />
        <div className="flex flex-wrap gap-2 border-t-2 border-linea-suave pt-4">
          <Boton onClick={() => guardar(true)}>Guardar el día</Boton>
          {propio ? quitar : null}
          <Boton tono="fantasma" onClick={onCerrar} className="ml-auto">
            Cancelar
          </Boton>
        </div>
        <p className="text-[0.82rem] leading-relaxed text-apagado">
          {propio
            ? "Si quitas tu día, se vuelve a tomar el del registro. "
            : ""}
          Para que deje de contar como empezado del todo,{" "}
          {conEstudiado ? "desmarca el «Estudiado» en su casilla." : "tendrías que borrar sus prácticas."}
        </p>
      </div>
    );
  }

  // --- Aún no consta: planearlo, marcarlo como empezado o quitarlo.
  return (
    <div className="flex flex-col gap-4">
      <CampoFecha
        etiqueta={inicio?.hecho ? "Día en que lo empezaste" : "Día previsto"}
        valor={fecha}
        onCambio={(f) => {
          setFecha(f);
          setError("");
        }}
        error={error}
        ayuda={fecha ? fechaLarga(fecha) + (inicio?.hecho ? "" : ` · ${cuando(fecha, hoyISO())}`) : undefined}
      />

      <div className="flex flex-wrap gap-2 border-t-2 border-linea-suave pt-4">
        {inicio?.hecho ? (
          <>
            <Boton onClick={() => guardar()}>Guardar el día</Boton>
            <Boton tono="secundario" onClick={() => guardar(false)}>
              Aún no lo he empezado
            </Boton>
          </>
        ) : (
          <>
            <Boton onClick={() => guardar(true)}>Ya lo he empezado</Boton>
            <Boton tono="secundario" onClick={() => guardar()}>
              {inicio ? "Cambiar el día" : "Planearlo"}
            </Boton>
          </>
        )}
        {inicio ? quitar : null}
        <Boton tono="fantasma" onClick={onCerrar} className="ml-auto">
          Cancelar
        </Boton>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ repasos

/**
 * Cuántos repasos lleva cada tema. Por defecto cinco (a 1, 3, 7, 15 y 30
 * días); se pueden añadir más para seguir repasando, y quitar el último si
 * ningún tema lo ha hecho todavía.
 */
export function EditorRepasos({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Repasos de todos los temas"
      subtitulo="Cada tema pasa por los mismos repasos; cada uno toca a los días indicados desde el anterior. Un cambio aquí vale para los 25."
    >
      {abierto ? <FormularioRepasos onCerrar={onCerrar} /> : null}
    </Dialogo>
  );
}

function FormularioRepasos({ onCerrar }: { onCerrar: () => void }) {
  const { perfil, eventos, temas, cambiarRepasos } = useCuaderno();
  const intervalos = perfil.intervalosRepaso;
  const ultimo = intervalos[intervalos.length - 1] ?? 30;
  const [dias, setDias] = useState(String(Math.min(ultimo * 2, 365)));
  const [error, setError] = useState("");

  // El último solo se puede quitar si ningún tema lo ha hecho: si no, se
  // perdería una marca de verdad.
  const alguienHizoElUltimo = temas.some((t) => proximoNumeroDeRepaso(eventos, t.id) > intervalos.length);

  function anadir() {
    const n = Number(dias);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      setError("Pon un número de días entre 1 y 365.");
      return;
    }
    cambiarRepasos([...intervalos, n]);
    onCerrar();
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-2" aria-label="Repasos actuales">
        {intervalos.map((d, i) => (
          <li
            key={i}
            className="rounded-full border-2 border-transparent bg-sec-repaso-fondo px-3 py-1 text-[0.85rem] font-extrabold text-sec-repaso"
            data-numerico
          >
            R{i + 1} · {d} {d === 1 ? "día" : "días"}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-3">
        <CampoTexto
          etiqueta={`Añadir el repaso ${intervalos.length + 1}`}
          ayuda="Días después del repaso anterior."
          tipo="number"
          valor={dias}
          onCambio={(v) => {
            setDias(v);
            setError("");
          }}
          error={error}
          className="w-44"
        />
        <Boton onClick={anadir} className="mb-[1.6rem]">
          Añadir
        </Boton>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t-2 border-linea-suave pt-4">
        {intervalos.length > 1 ? (
          <Boton
            tono="secundario"
            onClick={() => {
              if (alguienHizoElUltimo) return;
              cambiarRepasos(intervalos.slice(0, -1));
              onCerrar();
            }}
            aria-describedby="quitar-ultimo-ayuda"
          >
            Quitar el R{intervalos.length}
          </Boton>
        ) : null}
        <Boton tono="fantasma" onClick={onCerrar} className="ml-auto">
          Cancelar
        </Boton>
        {alguienHizoElUltimo ? (
          <p id="quitar-ultimo-ayuda" className="w-full text-[0.84rem] text-apagado">
            El R{intervalos.length} no se puede quitar: algún tema ya lo tiene hecho, y se perdería
            esa marca. Desmárcalo antes en la tabla si de verdad quieres quitarlo.
          </p>
        ) : null}
      </div>
    </div>
  );
}
