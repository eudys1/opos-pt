"use client";

import { useState } from "react";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { SECCIONES, TIPOS_ACTIVIDAD } from "@/components/ui/secciones";
import { CampoFecha, CampoTexto, Casilla, Opciones, Selector } from "@/components/ui/campos";
import { progresoDelTema } from "@/nucleo/repasos";
import { SelectorApartados } from "@/components/selector-apartados";
import { useCuaderno } from "@/datos/almacen";
import { esInicioPrevisto, inicioPrevistoDe, reprogramadosPorTema } from "@/nucleo/agenda";
import { tituloCorto } from "@/contenido/temario-pt";
import { fechaLarga, hoyISO } from "@/nucleo/fechas";
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
  const {
    objetivos,
    temas,
    eventos,
    perfil,
    anadirObjetivo,
    editarObjetivo,
    borrarObjetivo,
    alternarObjetivo,
    reprogramarRepaso,
    planearInicio,
  } = useCuaderno();
  const hoy = hoyISO();
  const existente = objetivo.id ? objetivos.find((o) => o.id === objetivo.id) : undefined;
  const esDelRegistro = existente ? esInicioPrevisto(existente) : false;

  const [texto, setTexto] = useState(existente?.texto ?? "");
  const [tipo, setTipo] = useState<TipoActividad>(existente?.tipo ?? "temario");
  const [temaId, setTemaId] = useState(existente?.temaId ?? "");
  const [apartados, setApartados] = useState<string[]>(existente?.apartados ?? []);
  const [fecha, setFecha] = useState(existente?.fecha ?? objetivo.fecha);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [falta, setFalta] = useState(false);
  const [sinFecha, setSinFecha] = useState(false);
  const [vinculo, setVinculo] = useState<"registro" | "aparte">("registro");
  const [errorFecha, setErrorFecha] = useState("");

  // Si lo que se planea es un paso del Registro (el próximo repaso del tema, o
  // el día para empezarlo), se ofrece enlazarlo: así es la misma cosa en los
  // dos sitios y se marca igual. Solo al crear, y solo si existe ese paso.
  const tema = temas.find((t) => t.id === temaId);
  const paso = (() => {
    if (existente || !tema) return null;
    if (tipo === "repaso") {
      const { siguiente } = progresoDelTema(eventos, tema.id, {
        intervalos: perfil.intervalosRepaso,
        hoy,
        reprogramados: reprogramadosPorTema(objetivos)[tema.id],
      });
      return siguiente && siguiente.indice >= 1
        ? { clase: "repaso" as const, indice: siguiente.indice, tocaEn: siguiente.tocaEn }
        : null;
    }
    if (tipo === "temario" && tema.estadoEstudio === "por_estudiar" && !inicioPrevistoDe(objetivos, tema.id)?.hecho) {
      return { clase: "inicio" as const };
    }
    return null;
  })();
  const enlazado = paso !== null && vinculo === "registro";

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    // Enlazado con el Registro: no se crea nada suelto, se mueve ese paso.
    if (enlazado && tema) {
      if (!fecha) return setSinFecha(true);
      if (paso.clase === "repaso") {
        if (fecha < hoy) return setErrorFecha("Un repaso pendiente no se puede dejar para un día que ya pasó.");
        reprogramarRepaso(tema.id, paso.indice, fecha);
      } else {
        planearInicio(tema.id, fecha);
      }
      onCerrar();
      return;
    }
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
        apartados: temaId && apartados.length ? apartados : undefined,
        fecha,
      });
    } else {
      anadirObjetivo(fecha, texto.trim(), tipo, temaId || undefined, apartados);
    }
    onCerrar();
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
      {esDelRegistro ? (
        <p className="rounded-pliegue bg-sec-temario-fondo px-3 py-2 text-[0.85rem] text-sec-temario">
          Es el día para empezar el tema que pusiste en el Registro: lo que cambies o borres aquí,
          cambia también allí.
        </p>
      ) : null}
      {enlazado ? null : (
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
      )}

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
          onCambio={(v) => {
            setTemaId(v === "ninguno" ? "" : v);
            // Los apartados son de un tema: al cambiar de tema, se empieza de cero.
            setApartados([]);
          }}
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
            setErrorFecha("");
          }}
          error={sinFecha ? "Elige un día." : errorFecha || undefined}
        />
      </div>

      {temaId && !enlazado ? (
        <SelectorApartados
          temaId={temaId}
          valor={apartados}
          onCambio={setApartados}
          etiqueta="Apartados (opcional)"
          ayuda="Si el objetivo es solo de una parte del tema. Nada marcado es el tema entero."
        />
      ) : null}

      {paso && tema ? (
        <Opciones
          etiqueta="¿Qué es?"
          valor={vinculo}
          onCambio={(v) => setVinculo(v as "registro" | "aparte")}
          opciones={[
            paso.clase === "repaso"
              ? {
                  valor: "registro",
                  texto: `El repaso ${paso.indice} del Registro`,
                  detalle: `${paso.tocaEn ? `Ahora toca el ${fechaLarga(paso.tocaEn)}` : "Pendiente"}: se mueve a este día, y marcarlo lo marca en el Registro.`,
                }
              : {
                  valor: "registro",
                  texto: `El día para empezar el tema ${tema.numero}`,
                  detalle: "Es la columna «Empezar» del Registro: sale en los dos sitios.",
                },
            { valor: "aparte", texto: "Un objetivo aparte", detalle: "Tuyo, con su texto. No cambia el Registro." },
          ]}
        />
      ) : (tipo === "temario" || tipo === "repaso") && temaId ? (
        <p className="rounded-pliegue bg-papel-franja px-3 py-2 text-[0.85rem] leading-relaxed text-texto">
          {existente
            ? "Es un objetivo tuyo, aparte: marcarlo no cambia el Registro."
            : tipo === "repaso"
              ? "Este tema aún no tiene repasos en el Registro (no está estudiado): será un objetivo aparte."
              : "Este tema ya está empezado: será un objetivo aparte, que no cambia el Registro."}
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
          {existente ? "Guardar" : enlazado ? "Ponerlo este día" : "Añadir"}
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
