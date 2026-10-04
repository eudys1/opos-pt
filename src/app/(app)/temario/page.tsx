"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Boton } from "@/components/ui/boton";
import { SubidaApuntes } from "@/components/subida-apuntes";
import { GeneradorBanco } from "@/components/generador-banco";
import { ReproductorTema } from "@/components/reproductor-tema";
import { AudiosTema } from "@/components/audios-tema";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import {
  AVISO_LITERALIDAD,
  FUENTE_TEMARIO,
  TEMARIO_PT,
  tituloCorto,
} from "@/contenido/temario-pt";
import type { EstadoContenido } from "@/nucleo/tipos";
import { AreaTexto, Opciones } from "@/components/ui/campos";

const ETIQUETAS: Record<EstadoContenido, { texto: string; tono: "neutra" | "hecha" | "borrador" }> = {
  sin_contenido: { texto: "Sin contenido", tono: "neutra" },
  borrador_ia: { texto: "Borrador IA", tono: "borrador" },
  parcial: { texto: "Parcial", tono: "neutra" },
  completo: { texto: "Completo", tono: "hecha" },
};

// useSearchParams necesita un límite de Suspense para poder prerenderizar.
export default function PaginaTemario() {
  return (
    <Suspense fallback={null}>
      <Temario />
    </Suspense>
  );
}

function Temario() {
  const { temas, guardarTexto, renombrarTema, cargado } = useCuaderno();
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  // Desde otra pantalla («sin subir» en el Registro) se llega con ?tema=<número>:
  // ese tema se abre solo y se trae a la vista, listo para subirlo.
  const pedido = Number(useSearchParams().get("tema"));
  const [pedidoAtendido, setPedidoAtendido] = useState(false);
  if (!pedidoAtendido && cargado) {
    setPedidoAtendido(true);
    const tema = temas.find((t) => t.numero === pedido);
    if (tema) setAbiertoId(tema.id);
  }
  useEffect(() => {
    if (!pedido || !abiertoId) return;
    document.getElementById(`tema-${pedido}`)?.scrollIntoView({ block: "start" });
  }, [pedido, abiertoId]);

  if (!cargado) return <p className="text-apagado">Abriendo el cuaderno…</p>;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-[2.1rem]">Mi temario</h1>
          <p className="mt-1 max-w-[62ch] text-[0.98rem] leading-relaxed text-texto">
            Los 25 títulos son los oficiales. El contenido lo pones tú: de momento puedes pegar o
            escribir el texto de cada tema, o subir fotos y PDF para que se lean solos. Lo leído
            aparece para que lo revises antes de guardarlo.
          </p>
        </div>
      </header>

      <ol className="flex flex-col gap-2">
        {temas.map((tema) => {
          const etiqueta = ETIQUETAS[tema.estadoContenido];
          const estaAbierto = abiertoId === tema.id;
          return (
            <li key={tema.id} id={`tema-${tema.numero}`} className="scroll-mt-6">
              <Ficha className={clsx("overflow-hidden", estaAbierto && "border-acento-vivo")}>
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
                    temaId={tema.id}
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
  temaId,
  id,
  numero,
  titulo,
  texto,
  estado,
  onGuardar,
  onRenombrar,
}: {
  temaId: string;
  id: string;
  numero: number;
  titulo: string;
  texto: string;
  estado: EstadoContenido;
  onGuardar: (texto: string, estado: EstadoContenido) => void;
  onRenombrar: (titulo: string) => void;
}) {
  const { alDia } = useSesion();
  const [borrador, setBorrador] = useState(texto);
  const [base, setBase] = useState(texto);
  const [nuevoEstado, setNuevoEstado] = useState<EstadoContenido>(
    estado === "sin_contenido" ? "parcial" : estado,
  );
  const [guardado, setGuardado] = useState(false);
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);

  // Si el texto del tema llega después (al juntarse con la cuenta, o desde el
  // editor en otra pestaña) y aquí no se ha tocado nada, se muestra el nuevo.
  // Si ya se estaba escribiendo, no se pisa lo escrito.
  if (texto !== base) {
    setBase(texto);
    if (borrador === base) setBorrador(texto);
  }

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

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <a
          href={`/tema/${numero}`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center gap-2 rounded-pliegue bg-sec-temario-fondo px-4 text-[0.92rem] font-semibold text-sec-temario"
        >
          Abrir el tema completo en otra pestaña ↗
        </a>
        <span className="text-[0.82rem] text-apagado">
          Para leerlo con su índice y editarlo a pantalla completa.
        </span>
      </div>

      <EditorTitulo titulo={titulo} onRenombrar={onRenombrar} />

      <SubidaApuntes
        temaId={temaId}
        numeroTema={numero}
        onTextoLeido={(leido) => {
          setBorrador((previo) => (previo.trim() ? `${previo.trim()}\n\n${leido}` : leido));
          setGuardado(false);
        }}
      />

      <AreaTexto
        etiqueta="Tu tema"
        ayuda="Pega aquí tus apuntes o retoca algo rápido. Para leerlo o editarlo entero y cómodo, ábrelo en otra pestaña (botón de arriba)."
        valor={borrador}
        onCambio={(v) => {
          setBorrador(v);
          setGuardado(false);
        }}
        filas={8}
      />

      <div className="mt-4">
        <Opciones
          etiqueta="Estado del contenido"
          enFila
          valor={nuevoEstado}
          onCambio={(v) => setNuevoEstado(v as "parcial" | "completo")}
          opciones={[
            { valor: "parcial", texto: "Parcial", detalle: "He subido una parte" },
            { valor: "completo", texto: "Completo", detalle: "El tema entero" },
          ]}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Boton
          onClick={() => {
            // Vaciar un tema que tenía texto se confirma: es irreversible.
            if (!borrador.trim() && texto.trim() && !confirmarVaciar) {
              setConfirmarVaciar(true);
              return;
            }
            onGuardar(borrador, borrador.trim() ? nuevoEstado : "sin_contenido");
            setGuardado(true);
            setConfirmarVaciar(false);
          }}
          disabled={!alDia}
        >
          {confirmarVaciar ? "Sí, dejar el tema vacío" : "Guardar el tema"}
        </Boton>
        {!alDia ? (
          <span className="text-[0.85rem] text-aviso" aria-live="polite">
            Esperando a tu cuenta para no guardar encima de algo más nuevo…
          </span>
        ) : null}
        {confirmarVaciar ? (
          <span role="alert" className="text-[0.85rem] font-bold text-margen">
            Vas a borrar todo el texto de este tema. Pulsa otra vez para confirmar.
          </span>
        ) : null}
        <span className="text-[0.85rem] text-apagado" data-numerico>
          {palabras} palabras
        </span>
        {borrador !== texto ? (
          <Boton
            tono="secundario"
            onClick={() => {
              setBorrador(texto);
              setGuardado(false);
            }}
          >
            Descartar cambios
          </Boton>
        ) : null}
        <span aria-live="polite" className="text-[0.88rem] text-visto">
          {guardado ? "Guardado." : ""}
        </span>
      </div>

      {texto.trim() ? (
        <details className="mt-5 border-t border-linea-suave pt-4">
          <summary className="regla w-fit cursor-pointer text-[0.95rem] font-semibold text-tinta">
            Escuchar el tema
          </summary>
          <div className="mt-4 flex flex-col gap-5">
            <AudiosTema temaId={temaId} numero={numero} />
            <div className="border-t border-linea-suave pt-4">
              <p className="mb-2 text-[0.9rem] font-semibold text-tinta">Voz del dispositivo</p>
              <ReproductorTema texto={borrador} />
            </div>
          </div>
        </details>
      ) : null}

      <GeneradorBanco temaId={temaId} numero={numero} hayTexto={texto.trim().length > 0} />
    </div>
  );
}

/** El enunciado se puede corregir: la transcripción del BOE no siempre es literal. */
function EditorTitulo({
  titulo,
  onRenombrar,
}: {
  titulo: string;
  onRenombrar: (titulo: string) => void;
}) {
  const [valor, setValor] = useState(titulo);
  const [hecho, setHecho] = useState(false);
  const [abierto, setAbierto] = useState(false);

  return (
    <details className="mb-5 max-w-[80ch]" open={abierto}>
      <summary
        className="regla inline-block cursor-pointer text-[0.85rem] text-texto"
        onClick={(e) => {
          e.preventDefault();
          setAbierto((v) => !v);
        }}
      >
        Corregir el enunciado
      </summary>
      <div className="mt-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <AreaTexto
            etiqueta="Enunciado de tu temario"
            ayuda="Si tu temario lo dice de otra forma, manda el tuyo."
            valor={valor}
            filas={2}
            onCambio={(v) => {
              setValor(v);
              setHecho(false);
            }}
            className="flex-1"
            claseCaja="text-[0.9rem]"
          />
          <div className="flex gap-2 sm:flex-col">
            <Boton
              tono="secundario"
              onClick={() => {
                const limpio = valor.trim();
                if (!limpio) return;
                onRenombrar(limpio);
                setHecho(true);
                setAbierto(false);
              }}
            >
              Guardar enunciado
            </Boton>
            <Boton
              tono="fantasma"
              onClick={() => {
                setValor(titulo);
                setHecho(false);
                setAbierto(false);
              }}
            >
              Cancelar
            </Boton>
          </div>
        </div>
        <span aria-live="polite" className="mt-1 block text-[0.85rem] text-visto">
          {hecho ? "Enunciado actualizado." : ""}
        </span>
      </div>
    </details>
  );
}
