"use client";

import { useState } from "react";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { SECCIONES, TIPOS_ACTIVIDAD } from "@/components/ui/secciones";
import { CampoFecha, CampoTexto, Casilla, Selector } from "@/components/ui/campos";
import { useCuaderno } from "@/datos/almacen";
import { tituloCorto } from "@/contenido/temario-pt";
import { fechaLarga } from "@/nucleo/fechas";
import type { TipoActividad } from "@/nucleo/tipos";

/**
 * Crear o editar un objetivo del planificador: qué, de qué tipo (su color),
 * de qué tema si es de uno, y qué día. Siempre con "Cancelar".
 */

export type ObjetivoAEditar = { id?: string; fecha: string };

export function EditorObjetivo({
  objetivo,
  onCerrar,
}: {
  objetivo: ObjetivoAEditar | null;
  onCerrar: () => void;
}) {
  return (
    <Dialogo
      abierto={Boolean(objetivo)}
      onCerrar={onCerrar}
      titulo={objetivo?.id ? "Editar objetivo" : "Nuevo objetivo"}
    >
      {objetivo ? (
        <Contenido key={objetivo.id ?? objetivo.fecha} objetivo={objetivo} onCerrar={onCerrar} />
      ) : null}
    </Dialogo>
  );
}

function Contenido({ objetivo, onCerrar }: { objetivo: ObjetivoAEditar; onCerrar: () => void }) {
  const { objetivos, temas, anadirObjetivo, editarObjetivo, borrarObjetivo, alternarObjetivo } =
    useCuaderno();
  const existente = objetivo.id ? objetivos.find((o) => o.id === objetivo.id) : undefined;

  const [texto, setTexto] = useState(existente?.texto ?? "");
  const [tipo, setTipo] = useState<TipoActividad>(existente?.tipo ?? "temario");
  const [temaId, setTemaId] = useState(existente?.temaId ?? "");
  const [fecha, setFecha] = useState(existente?.fecha ?? objetivo.fecha);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [falta, setFalta] = useState(false);
  const [sinFecha, setSinFecha] = useState(false);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || !fecha) {
      setFalta(!texto.trim());
      setSinFecha(!fecha);
      return;
    }
    if (existente) {
      editarObjetivo(existente.id, {
        texto: texto.trim(),
        tipo,
        temaId: temaId || undefined,
        fecha,
      });
    } else {
      anadirObjetivo(fecha, texto.trim(), tipo, temaId || undefined);
    }
    onCerrar();
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
      <CampoTexto
        etiqueta="Qué vas a hacer"
        valor={texto}
        onCambio={(v) => {
          setTexto(v);
          setFalta(false);
        }}
        placeholder="Leer el tema 7, preparar la UD de las emociones…"
        error={falta ? "Escribe qué vas a hacer: es lo único obligatorio." : undefined}
      />

      <fieldset>
        <legend className="mb-2 text-[0.9rem] font-semibold text-tinta">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_ACTIVIDAD.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={clsx(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-[0.88rem]",
                tipo === t
                  ? clsx(SECCIONES[t].fondo, SECCIONES[t].texto, SECCIONES[t].borde, "font-semibold")
                  : "border-linea text-texto hover:border-borde",
              )}
            >
              <span aria-hidden="true" className={clsx("h-2.5 w-2.5 rounded-full", SECCIONES[t].lleno)} />
              {SECCIONES[t].nombre}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Selector
          etiqueta="Tema (opcional)"
          valor={temaId || "ninguno"}
          onCambio={(v) => setTemaId(v === "ninguno" ? "" : v)}
          opciones={[
            { valor: "ninguno", texto: "Ninguno" },
            ...temas.map((t) => ({ valor: t.id, texto: `Tema ${t.numero}`, detalle: tituloCorto(t.titulo, 48) })),
          ]}
        />
        <CampoFecha
          etiqueta="Día"
          valor={fecha}
          onCambio={(f) => {
            setFecha(f);
            setSinFecha(false);
          }}
          error={sinFecha ? "Elige un día." : undefined}
        />
      </div>

      {(tipo === "temario" || tipo === "repaso") && temaId ? (
        <p className="rounded-pliegue bg-sec-repaso-fondo px-3 py-2 text-[0.85rem] leading-relaxed text-sec-repaso">
          Esto es un objetivo tuyo: marcarlo como hecho no cambia el registro de estudio. Para
          marcar el tema como estudiado o un repaso, pulsa el repaso que aparece solo en el
          planificador, o la casilla en Registro.
        </p>
      ) : null}

      {existente ? (
        <Casilla marcada={existente.hecho} onCambio={() => alternarObjetivo(existente.id)}>
          Hecho
        </Casilla>
      ) : fecha ? (
        <p className="text-[0.85rem] text-apagado">Para el {fechaLarga(fecha)}.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-linea-suave pt-4">
        <Boton type="submit">
          {existente ? "Guardar" : "Añadir"}
        </Boton>
        <Boton tono="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        {existente ? (
          confirmarBorrar ? (
            <span className="ml-auto flex items-center gap-2">
              <span className="text-[0.88rem] text-margen">¿Seguro?</span>
              <Boton
                tono="fantasma"
                onClick={() => {
                  borrarObjetivo(existente.id);
                  onCerrar();
                }}
              >
                Sí, borrar
              </Boton>
            </span>
          ) : (
            <Boton tono="fantasma" className="ml-auto" onClick={() => setConfirmarBorrar(true)}>
              Borrar
            </Boton>
          )
        ) : null}
      </div>
    </form>
  );
}
