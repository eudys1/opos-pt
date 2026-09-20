"use client";

import { useState } from "react";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Boton } from "@/components/ui/boton";
import { useCuaderno } from "@/datos/almacen";
import {
  AVISO_LITERALIDAD,
  FUENTE_TEMARIO,
  TEMARIO_PT,
  tituloCorto,
} from "@/contenido/temario-pt";
import type { EstadoContenido } from "@/nucleo/tipos";

const ETIQUETAS: Record<EstadoContenido, { texto: string; tono: "neutra" | "hecha" | "borrador" }> = {
  sin_contenido: { texto: "Sin contenido", tono: "neutra" },
  borrador_ia: { texto: "Borrador IA", tono: "borrador" },
  parcial: { texto: "Parcial", tono: "neutra" },
  completo: { texto: "Completo", tono: "hecha" },
};

export default function PaginaTemario() {
  const { temas, guardarTexto, renombrarTema, cargado } = useCuaderno();
  const [abiertoId, setAbiertoId] = useState<string | null>(null);


  if (!cargado) return <p className="text-apagado">Abriendo el cuaderno…</p>;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-[2.1rem]">Mi temario</h1>
          <p className="mt-1 max-w-[62ch] text-[0.98rem] leading-relaxed text-texto">
            Los 25 títulos son los oficiales. El contenido lo pones tú: de momento puedes pegar o
            escribir el texto de cada tema. La subida de fotos y PDF con lectura automática llega en
            la siguiente fase.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton tono="secundario" disabled title="Disponible cuando se conecte la lectura de imágenes">
            Subir fotos
          </Boton>
          <Boton tono="secundario" disabled title="Disponible cuando se conecte la lectura de PDF">
            Subir PDF
          </Boton>
        </div>
      </header>

      <ol className="flex flex-col gap-2">
        {temas.map((tema) => {
          const etiqueta = ETIQUETAS[tema.estadoContenido];
          const estaAbierto = abiertoId === tema.id;
          return (
            <li key={tema.id}>
              <Ficha className={clsx("overflow-hidden", estaAbierto && "border-tinta")}>
                <h2>
                  <button
                    type="button"
                    onClick={() => setAbiertoId(estaAbierto ? null : tema.id)}
                    aria-expanded={estaAbierto}
                    aria-controls={`panel-${tema.id}`}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
                  >
                    <span className="w-7 shrink-0 text-tenue" data-numerico>
                      {String(tema.numero).padStart(2, "0")}
                    </span>
                    <span
                      className={clsx(
                        "flex-1 font-sans text-[0.97rem] font-normal",
                        tema.estadoContenido === "sin_contenido" ? "text-tenue" : "text-tinta",
                      )}
                    >
                      {tituloCorto(tema.titulo, 86)}
                    </span>
                    <Etiqueta tono={etiqueta.tono}>{etiqueta.texto}</Etiqueta>
                    <span aria-hidden="true" className="text-apagado">
                      {estaAbierto ? "−" : "+"}
                    </span>
                  </button>
                </h2>

                {estaAbierto ? (
                  <EditorTema
                    id={`panel-${tema.id}`}
                    numero={tema.numero}
                    titulo={tema.titulo}
                    texto={tema.texto}
                    estado={tema.estadoContenido}
                    onGuardar={(texto, estado) => guardarTexto(tema.id, texto, estado)}
                    onRenombrar={(titulo) => renombrarTema(tema.id, titulo)}
                  />
                ) : null}
              </Ficha>
            </li>
          );
        })}
      </ol>

      <p className="max-w-[70ch] border-t border-linea pt-4 text-[0.85rem] leading-relaxed text-apagado">
        Títulos tomados de la {FUENTE_TEMARIO.norma} ({FUENTE_TEMARIO.boe}), restablecida por la{" "}
        {FUENTE_TEMARIO.restablecidaPor}. {AVISO_LITERALIDAD}{" "}
        <a href={FUENTE_TEMARIO.url} target="_blank" rel="noreferrer" className="regla text-texto">
          Ver en el BOE
        </a>
        .
      </p>
    </div>
  );
}

function EditorTema({
  id,
  numero,
  titulo,
  texto,
  estado,
  onGuardar,
  onRenombrar,
}: {
  id: string;
  numero: number;
  titulo: string;
  texto: string;
  estado: EstadoContenido;
  onGuardar: (texto: string, estado: EstadoContenido) => void;
  onRenombrar: (titulo: string) => void;
}) {
  const [borrador, setBorrador] = useState(texto);
  const [nuevoEstado, setNuevoEstado] = useState<EstadoContenido>(
    estado === "sin_contenido" ? "parcial" : estado,
  );
  const [guardado, setGuardado] = useState(false);

  const palabras = borrador.trim() ? borrador.trim().split(/\s+/).length : 0;
  const duda = TEMARIO_PT.find((t) => t.numero === numero)?.dudaLiteralidad;

  return (
    <div id={id} className="border-t border-linea bg-papel px-5 py-5">
      <p className="mb-2 max-w-[80ch] text-[0.9rem] leading-relaxed text-texto">
        <span className="font-semibold">Enunciado oficial:</span> {titulo}
      </p>

      {duda ? (
        <p className="mb-3 max-w-[80ch] rounded-pliegue border border-margen-hilo bg-margen-fondo px-3 py-2 text-[0.85rem] leading-relaxed text-tinta">
          <span className="font-semibold">Ojo a la transcripción:</span> {duda}
        </p>
      ) : null}

      <EditorTitulo id={id} titulo={titulo} onRenombrar={onRenombrar} />

      <label htmlFor={`${id}-texto`} className="block text-[0.9rem] font-semibold text-tinta">
        Tu tema
      </label>
      <p id={`${id}-ayuda`} className="mb-2 text-[0.85rem] text-apagado">
        Pega aquí tus apuntes o escríbelos. Puedes guardarlo a medias y seguir otro día.
      </p>
      <textarea
        id={`${id}-texto`}
        aria-describedby={`${id}-ayuda`}
        value={borrador}
        onChange={(e) => {
          setBorrador(e.target.value);
          setGuardado(false);
        }}
        rows={10}
        className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.95rem] leading-relaxed text-tinta"
      />

      <fieldset className="mt-4">
        <legend className="text-[0.9rem] font-semibold text-tinta">Estado del contenido</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          <Opcion
            id={`${id}-parcial`}
            name={`${id}-estado`}
            checked={nuevoEstado === "parcial"}
            onChange={() => setNuevoEstado("parcial")}
            texto="Parcial"
            ayuda="He subido una parte"
          />
          <Opcion
            id={`${id}-completo`}
            name={`${id}-estado`}
            checked={nuevoEstado === "completo"}
            onChange={() => setNuevoEstado("completo")}
            texto="Completo"
            ayuda="El tema entero"
          />
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Boton
          onClick={() => {
            onGuardar(borrador, borrador.trim() ? nuevoEstado : "sin_contenido");
            setGuardado(true);
          }}
        >
          Guardar el tema
        </Boton>
        <span className="text-[0.85rem] text-apagado" data-numerico>
          {palabras} palabras
        </span>
        <span aria-live="polite" className="text-[0.88rem] text-visto">
          {guardado ? "Guardado." : ""}
        </span>
      </div>
    </div>
  );
}

/** El enunciado se puede corregir: la transcripción del BOE no siempre es literal. */
function EditorTitulo({
  id,
  titulo,
  onRenombrar,
}: {
  id: string;
  titulo: string;
  onRenombrar: (titulo: string) => void;
}) {
  const [valor, setValor] = useState(titulo);
  const [hecho, setHecho] = useState(false);

  return (
    <details className="mb-5 max-w-[80ch]">
      <summary className="regla inline-block cursor-pointer text-[0.85rem] text-texto">
        Corregir el enunciado
      </summary>
      <div className="mt-2">
        <label htmlFor={`${id}-titulo`} className="block text-[0.85rem] text-apagado">
          Si tu temario lo dice de otra forma, manda el tuyo.
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <textarea
            id={`${id}-titulo`}
            value={valor}
            rows={2}
            onChange={(e) => {
              setValor(e.target.value);
              setHecho(false);
            }}
            className="flex-1 rounded-pliegue border border-linea bg-papel-alto px-3 py-2 text-[0.9rem] leading-relaxed"
          />
          <Boton
            tono="secundario"
            onClick={() => {
              const limpio = valor.trim();
              if (!limpio) return;
              onRenombrar(limpio);
              setHecho(true);
            }}
          >
            Guardar enunciado
          </Boton>
        </div>
        <span aria-live="polite" className="mt-1 block text-[0.85rem] text-visto">
          {hecho ? "Enunciado actualizado." : ""}
        </span>
      </div>
    </details>
  );
}

function Opcion({
  id,
  name,
  checked,
  onChange,
  texto,
  ayuda,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: () => void;
  texto: string;
  ayuda: string;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2.5">
      <input
        type="radio"
        id={id}
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-[color:var(--color-tinta)]"
      />
      <span className="text-[0.95rem] text-tinta">
        {texto} <span className="text-apagado">· {ayuda}</span>
      </span>
    </label>
  );
}
