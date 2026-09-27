"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { Boton } from "@/components/ui/boton";
import { Visto } from "@/components/marcas";
import { EditorHito, type HitoAEditar } from "@/components/editor-hito";
import { useCuaderno } from "@/datos/almacen";
import { tituloCorto } from "@/contenido/temario-pt";
import { cuando, fechaCorta, hoyISO } from "@/nucleo/fechas";
import { progresoDelTema, type CasillaRepaso } from "@/nucleo/repasos";
import { reprogramadosPorTema } from "@/nucleo/agenda";
import { calcularRacha } from "@/nucleo/racha";

/**
 * Registro de estudio: una fila por tema, una casilla por paso.
 *
 * Todas las casillas se pueden pulsar: las hechas para cambiar el día o
 * desmarcarlas, y la siguiente para marcarla (hoy u otro día) o moverla. Lo que
 * se cambia aquí se ve igual en el planificador, porque es el mismo dato.
 */
export default function PaginaRegistro() {
  const { temas, eventos, objetivos, perfil, cargado } = useCuaderno();
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [editando, setEditando] = useState<HitoAEditar | null>(null);
  const hoy = hoyISO();

  const reprogramados = useMemo(() => reprogramadosPorTema(objetivos), [objetivos]);

  const filas = useMemo(
    () =>
      temas.map((tema) => ({
        tema,
        progreso: progresoDelTema(eventos, tema.id, {
          intervalos: perfil.intervalosRepaso,
          hoy,
          reprogramados: reprogramados[tema.id],
        }),
      })),
    [temas, eventos, perfil.intervalosRepaso, hoy, reprogramados],
  );

  const visibles = soloPendientes
    ? filas.filter(
        (f) => f.progreso.siguiente?.estado === "hoy" || f.progreso.siguiente?.estado === "atrasado",
      )
    : filas;

  const racha = calcularRacha(eventos, { hoy, diasLibresAlMes: perfil.diasLibresAlMes });
  const conContenido = temas.filter((t) => t.estadoContenido !== "sin_contenido").length;
  const estudiados = temas.filter((t) => t.estadoEstudio !== "por_estudiar").length;
  const tocanHoy = filas.filter((f) => f.progreso.siguiente?.estado === "hoy").length;
  const atrasados = filas.filter((f) => f.progreso.siguiente?.estado === "atrasado").length;
  const vueltas = temas.length > 0 ? Math.min(...temas.map((t) => t.vueltas)) : 0;

  if (!cargado) return <p className="text-apagado">Abriendo el cuaderno…</p>;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-[2.1rem]">Registro de estudio</h1>
          <p className="mt-1 max-w-[70ch] text-[0.98rem] text-texto">
            {estudiados === 0
              ? "Aún no has marcado ningún tema. Pulsa «marcar» en un tema y la app fija sola los repasos."
              : `Vas por la ${vueltas + 1}.ª vuelta al temario. Pulsa cualquier casilla para marcarla, cambiarle el día o desmarcarla.`}
          </p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[0.95rem] text-texto">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--color-acento)]"
          />
          Ver solo lo que toca
        </label>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Dato titulo="Con contenido" valor={`${conContenido}`} pie={`de ${temas.length}`} />
        <Dato titulo="Estudiados" valor={`${estudiados}`} />
        <Dato titulo="Tocan hoy" valor={`${tocanHoy}`} />
        <Dato titulo="Atrasados" valor={`${atrasados}`} alerta={atrasados > 0} />
        <Dato
          titulo="Racha"
          valor={`${racha.dias} días`}
          pie={racha.hoyPendiente ? "hoy aún no cuenta" : `${racha.diasLibresRestantes} libres`}
        />
      </dl>

      <Ficha className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-[0.95rem]">
          <caption className="px-5 pb-3 pt-4 text-left text-[0.85rem] text-apagado">
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <EstadoSubida estado="completo" /> tema con tus apuntes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <EstadoSubida estado="sin_contenido" /> aún no lo has subido (puedes marcarlo igual)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-sec-temario" /> estudiado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-sec-repaso" /> repasos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-margen" /> toca
                hoy o va tarde
              </span>
              <span>· fecha gris: cuándo toca</span>
            </span>
          </caption>
          <thead>
            <tr className="bg-papel-franja text-[0.8rem] text-apagado">
              <th scope="col" className="border-y border-linea px-5 py-2.5 text-left font-semibold">
                Tema
              </th>
              <th scope="col" className="w-24 border-y border-linea px-2 py-2.5 font-semibold text-sec-temario">
                Estudiado
              </th>
              {perfil.intervalosRepaso.map((intervalo, i) => (
                <th
                  key={i}
                  scope="col"
                  className="w-16 border-y border-linea px-2 py-2.5 font-semibold text-sec-repaso"
                  title={`Repaso ${i + 1}: ${intervalo} días después del anterior`}
                >
                  R{i + 1}
                </th>
              ))}
              <th scope="col" className="w-44 border-y border-linea px-5 py-2.5 text-right font-semibold">
                Siguiente
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(({ tema, progreso }) => (
              <tr key={tema.id} className="align-middle hover:bg-papel-franja/50">
                <th scope="row" className="border-b border-linea-suave px-5 py-2.5 text-left font-normal">
                  <span className="mr-2 font-semibold text-tenue" data-numerico>
                    {String(tema.numero).padStart(2, "0")}
                  </span>
                  <span className={tema.estadoContenido === "sin_contenido" ? "text-tenue" : "font-bold"}>
                    {tituloCorto(tema.titulo)}
                  </span>
                  <EstadoSubida estado={tema.estadoContenido} />
                </th>

                {progreso.casillas.map((casilla) => (
                  <td key={casilla.indice} className="border-b border-linea-suave px-1.5 py-1.5 text-center">
                    <Casilla
                      casilla={casilla}
                      tema={tituloCorto(tema.titulo, 40)}
                      onPulsar={() => setEditando({ temaId: tema.id, indice: casilla.indice })}
                    />
                  </td>
                ))}

                <td className="border-b border-linea-suave px-5 py-2.5 text-right text-[0.9rem]">
                  <Siguiente progreso={progreso} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibles.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-5 py-8">
            <p className="text-[0.98rem] text-texto">
              Hoy no hay nada atrasado ni pendiente. Buen momento para estudiar un tema nuevo.
            </p>
            <Boton tono="secundario" onClick={() => setSoloPendientes(false)}>
              Ver todos los temas
            </Boton>
          </div>
        ) : null}
      </Ficha>

      <EditorHito hito={editando} onCerrar={() => setEditando(null)} />
    </div>
  );
}

function Dato({
  titulo,
  valor,
  pie,
  alerta,
}: {
  titulo: string;
  valor: string;
  pie?: string;
  alerta?: boolean;
}) {
  return (
    <Ficha className={clsx("px-4 py-3", alerta && "border-margen-hilo")}>
      <dt className={clsx("text-[0.8rem]", alerta ? "text-margen" : "text-apagado")}>{titulo}</dt>
      <dd>
        <span
          className={clsx("font-display text-[1.6rem] font-bold leading-tight", alerta && "text-margen")}
          data-numerico
        >
          {valor}
        </span>
        {pie ? <span className="ml-2 text-[0.82rem] text-apagado">{pie}</span> : null}
      </dd>
    </Ficha>
  );
}

function Casilla({
  casilla,
  tema,
  onPulsar,
}: {
  casilla: CasillaRepaso;
  tema: string;
  onPulsar: () => void;
}) {
  const nombre = casilla.indice === 0 ? "estudiado" : `repaso ${casilla.indice}`;
  const base =
    "inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-pliegue border px-1.5 text-[0.78rem] transition-colors";

  if (casilla.estado === "hecho") {
    const color = casilla.indice === 0 ? "text-sec-temario" : "text-sec-repaso";
    return (
      <button
        type="button"
        onClick={onPulsar}
        className={clsx(base, "border-transparent hover:border-linea hover:bg-papel-alto", color)}
      >
        <Visto className="h-4 w-4" animado={false} tono="text-current" />
        <span className="text-apagado" data-numerico>
          {casilla.hechoEn ? fechaCorta(casilla.hechoEn) : null}
        </span>
        <span className="sr-only">
          {nombre} de {tema}: hecho el {casilla.hechoEn}. Cambiar el día o desmarcar.
        </span>
      </button>
    );
  }

  if (casilla.estado === "hoy" || casilla.estado === "atrasado") {
    return (
      <button
        type="button"
        onClick={onPulsar}
        className={clsx(
          base,
          "font-semibold",
          casilla.estado === "atrasado"
            ? "border-margen bg-margen-fondo text-margen hover:bg-margen hover:text-papel-alto"
            : "border-margen-hilo text-margen hover:bg-margen hover:text-papel-alto",
        )}
      >
        {casilla.estado === "atrasado" ? "tarde" : "hoy"}
        <span className="sr-only"> · marcar o mover {nombre} de {tema}</span>
      </button>
    );
  }

  if (casilla.estado === "sin_empezar" && casilla.indice === 0) {
    return (
      <button
        type="button"
        onClick={onPulsar}
        className={clsx(
          base,
          "border-dashed border-linea text-apagado hover:border-sec-temario hover:bg-sec-temario-fondo hover:text-sec-temario",
        )}
      >
        marcar
        <span className="sr-only"> {tema} como estudiado</span>
      </button>
    );
  }

  if (casilla.estado === "pendiente" && casilla.tocaEn) {
    return (
      <button
        type="button"
        onClick={onPulsar}
        title={`Toca ${cuando(casilla.tocaEn)}. Puedes adelantarlo o moverlo.`}
        className={clsx(base, "border-linea text-apagado hover:border-sec-repaso hover:text-sec-repaso")}
      >
        <span data-numerico>{fechaCorta(casilla.tocaEn)}</span>
        <span className="sr-only">
          · {nombre} de {tema}, toca {cuando(casilla.tocaEn)}. Marcar o mover.
        </span>
      </button>
    );
  }

  return (
    <span className="text-linea" aria-label={`${nombre} de ${tema}: aún no toca`}>
      —
    </span>
  );
}

function Siguiente({ progreso }: { progreso: ReturnType<typeof progresoDelTema> }) {
  const s = progreso.siguiente;
  if (!s) {
    const todoHecho = progreso.casillas.every((c) => c.estado === "hecho");
    return (
      <span className={todoHecho ? "font-semibold text-visto" : "text-apagado"}>
        {todoHecho ? "Vuelta completa" : "Pendiente de estudiar"}
      </span>
    );
  }
  const nombre = s.indice === 0 ? "Estudiar" : `Repaso ${s.indice}`;
  if (s.estado === "atrasado") {
    return (
      <span className="font-semibold text-margen">
        {nombre} · {progreso.diasDeRetraso} {progreso.diasDeRetraso === 1 ? "día" : "días"} tarde
      </span>
    );
  }
  if (s.estado === "hoy") return <span className="font-semibold text-margen">{nombre} · hoy</span>;
  return (
    <span className="text-texto">
      {nombre} · {s.tocaEn ? fechaCorta(s.tocaEn) : "sin fecha"}
    </span>
  );
}

/**
 * Si el tema está subido a Mi temario, a la vista en cada fila. Subido, con el
 * violeta de Mi temario; sin subir, discreto pero claro.
 */
function EstadoSubida({ estado }: { estado: string }) {
  const base = "ml-2 inline-flex items-center rounded-full border-2 px-2 py-0.5 align-middle text-[0.72rem] font-extrabold";
  if (estado === "sin_contenido") {
    return <span className={clsx(base, "border-dashed border-linea text-tenue")}>sin subir</span>;
  }
  if (estado === "borrador_ia") {
    return <span className={clsx(base, "border-dashed border-sec-temario-vivo text-sec-temario")}>borrador IA</span>;
  }
  return (
    <span className={clsx(base, "border-transparent bg-sec-temario-fondo text-sec-temario")}>
      {estado === "parcial" ? "subido a medias" : "subido"}
    </span>
  );
}
