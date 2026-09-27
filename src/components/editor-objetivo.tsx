"use client";

import { useState } from "react";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { SECCIONES, TIPOS_ACTIVIDAD } from "@/components/ui/secciones";
import { useCuaderno } from "@/datos/almacen";
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

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) {
      setFalta(true);
      document.getElementById("obj-texto")?.focus();
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
      <div>
        <label htmlFor="obj-texto" className="block text-[0.9rem] font-semibold text-tinta">
          Qué vas a hacer
        </label>
        <input
          id="obj-texto"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setFalta(false);
          }}
          placeholder="Leer el tema 7, hacer un supuesto de TEA…"
          aria-invalid={falta ? true : undefined}
          aria-describedby={falta ? "obj-texto-falta" : undefined}
          className={clsx(
            "mt-1.5 w-full rounded-pliegue border bg-papel-alto px-4 py-2.5",
            falta ? "border-2 border-margen" : "border-linea",
          )}
        />
        {falta ? (
          <p id="obj-texto-falta" role="alert" className="mt-1 text-[0.85rem] font-bold text-margen">
            Escribe qué vas a hacer: es lo único obligatorio.
          </p>
        ) : null}
      </div>

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
        <div>
          <label htmlFor="obj-tema" className="block text-[0.9rem] font-semibold text-tinta">
            Tema <span className="font-normal text-apagado">(opcional)</span>
          </label>
          <select
            id="obj-tema"
            value={temaId}
            onChange={(e) => setTemaId(e.target.value)}
            className="mt-1.5 w-full rounded-pliegue border border-linea bg-papel-alto px-3 py-2.5"
          >
            <option value="">Ninguno</option>
            {temas.map((t) => (
              <option key={t.id} value={t.id}>
                Tema {t.numero}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="obj-fecha" className="block text-[0.9rem] font-semibold text-tinta">
            Día
          </label>
          <input
            id="obj-fecha"
            type="date"
            value={fecha}
            required
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1.5 w-full rounded-pliegue border border-linea bg-papel-alto px-3 py-2.5"
          />
        </div>
      </div>

      {(tipo === "temario" || tipo === "repaso") && temaId ? (
        <p className="rounded-pliegue bg-sec-repaso-fondo px-3 py-2 text-[0.85rem] leading-relaxed text-sec-repaso">
          Esto es un objetivo tuyo: marcarlo como hecho no cambia el registro de estudio. Para
          marcar el tema como estudiado o un repaso, pulsa el repaso que aparece solo en el
          planificador, o la casilla en Registro.
        </p>
      ) : null}

      {existente ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.95rem]">
          <input
            type="checkbox"
            checked={existente.hecho}
            onChange={() => alternarObjetivo(existente.id)}
            className="h-4 w-4 accent-[color:var(--color-visto)]"
          />
          Hecho
        </label>
      ) : (
        <p className="text-[0.85rem] text-apagado">Para el {fechaLarga(fecha)}.</p>
      )}

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
