"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Boton } from "@/components/ui/boton";
import { Visto } from "@/components/marcas";
import { useCuaderno } from "@/datos/almacen";
import { tituloCorto } from "@/contenido/temario-pt";
import { cuando, fechaCorta, hoyISO } from "@/nucleo/fechas";
import { progresoDelTema, type CasillaRepaso } from "@/nucleo/repasos";
import { calcularRacha } from "@/nucleo/racha";

export default function PaginaRegistro() {
  const { temas, eventos, perfil, marcarEstudiado, marcarRepaso, deshacerUltimoHito, cargado } =
    useCuaderno();
  const [soloPendientes, setSoloPendientes] = useState(false);
  const hoy = hoyISO();

  const filas = useMemo(
    () =>
      temas.map((tema) => ({
        tema,
        progreso: progresoDelTema(eventos, tema.id, {
          intervalos: perfil.intervalosRepaso,
          hoy,
        }),
      })),
    [temas, eventos, perfil.intervalosRepaso, hoy],
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

  if (!cargado) {
    return <p className="text-apagado">Abriendo el cuaderno…</p>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-[2.1rem]">Registro de estudio</h1>
          <p className="mt-1 text-[0.98rem] text-texto">
            {estudiados === 0
              ? "Aún no has marcado ningún tema. Marca «Estudiado» y la app fija sola los repasos."
              : `Vas por la ${vueltas + 1}.ª vuelta al temario. Marca cada casilla el día que la hagas.`}
          </p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[0.95rem] text-texto">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
            className="h-4 w-4 accent-[#b03a2b]"
          />
          Ver solo lo que toca
        </label>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Dato titulo="Con contenido" valor={`${conContenido}`} pie={`de ${temas.length} temas`} />
        <Dato titulo="Estudiados" valor={`${estudiados}`} />
        <Dato titulo="Tocan hoy" valor={`${tocanHoy}`} />
        <Dato titulo="Atrasados" valor={`${atrasados}`} alerta={atrasados > 0} />
        <Dato
          titulo="Racha"
          valor={`${racha.dias} días`}
          pie={racha.hoyPendiente ? "hoy aún no cuenta" : `${racha.diasLibresRestantes} días libres`}
        />
      </dl>

      <Ficha className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-[0.95rem]">
          <caption className="px-5 pb-2 pt-4 text-left text-[0.85rem] text-apagado">
            Pulsa una casilla para marcarla con la fecha de hoy. Verde: hecho · Rojo: toca hoy o va
            con retraso · Raya: aún no toca.
          </caption>
          <thead>
            <tr className="bg-papel-franja text-[0.7rem] uppercase tracking-[0.06em] text-apagado">
              <th scope="col" className="border-y border-linea px-5 py-2.5 text-left font-bold">
                Tema
              </th>
              <th scope="col" className="w-24 border-y border-linea px-2 py-2.5 font-bold">
                Estudiado
              </th>
              {perfil.intervalosRepaso.map((intervalo, i) => (
                <th
                  key={i}
                  scope="col"
                  className="w-16 border-y border-linea px-2 py-2.5 font-bold"
                  title={`Repaso ${i + 1}: ${intervalo} días después del anterior`}
                >
                  R{i + 1}
                </th>
              ))}
              <th scope="col" className="w-44 border-y border-linea px-5 py-2.5 text-right font-bold">
                Siguiente
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(({ tema, progreso }) => (
              <tr key={tema.id} className="align-middle">
                <th scope="row" className="border-b border-linea-suave px-5 py-3 text-left font-normal">
                  <span className="mr-2 text-tenue" data-numerico>
                    {String(tema.numero).padStart(2, "0")}
                  </span>
                  <span className={tema.estadoContenido === "sin_contenido" ? "text-tenue" : ""}>
                    {tituloCorto(tema.titulo)}
                  </span>
                  {tema.estadoContenido === "sin_contenido" ? (
                    <Etiqueta className="ml-2 align-middle">sin subir</Etiqueta>
                  ) : null}
                  {tema.estadoContenido === "borrador_ia" ? (
                    <Etiqueta tono="borrador" className="ml-2 align-middle">
                      borrador
                    </Etiqueta>
                  ) : null}
                  {tema.estadoContenido === "parcial" ? (
                    <Etiqueta className="ml-2 align-middle">parcial</Etiqueta>
                  ) : null}
                </th>

                {progreso.casillas.map((casilla) => (
                  <td key={casilla.indice} className="border-b border-linea-suave px-2 py-2 text-center">
                    <Casilla
                      casilla={casilla}
                      tema={tituloCorto(tema.titulo, 40)}
                      onMarcar={() =>
                        casilla.indice === 0 ? marcarEstudiado(tema.id) : marcarRepaso(tema.id)
                      }
                    />
                  </td>
                ))}

                <td className="border-b border-linea-suave px-5 py-3 text-right text-[0.9rem]">
                  <Siguiente progreso={progreso} />
                  {progreso.casillas.some((c) => c.estado === "hecho") ? (
                    <button
                      type="button"
                      onClick={() => deshacerUltimoHito(tema.id)}
                      className="regla ml-3 text-[0.82rem] text-apagado"
                    >
                      deshacer
                    </button>
                  ) : null}
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
          className={clsx("font-display text-[1.6rem] leading-tight", alerta && "text-margen")}
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
  onMarcar,
}: {
  casilla: CasillaRepaso;
  tema: string;
  onMarcar: () => void;
}) {
  const nombre = casilla.indice === 0 ? "estudiado" : `repaso ${casilla.indice}`;

  if (casilla.estado === "hecho") {
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <Visto />
        <span className="text-[0.72rem] text-apagado" data-numerico>
          {casilla.hechoEn ? fechaCorta(casilla.hechoEn) : null}
        </span>
        <span className="sr-only">
          {nombre} de {tema}: hecho el {casilla.hechoEn}
        </span>
      </span>
    );
  }

  if (casilla.estado === "hoy" || casilla.estado === "atrasado") {
    return (
      <button
        type="button"
        onClick={onMarcar}
        className={clsx(
          "inline-flex min-h-11 min-w-11 items-center justify-center rounded-pliegue border px-2 text-[0.82rem] font-semibold transition-colors",
          casilla.estado === "atrasado"
            ? "border-margen bg-margen-fondo text-margen hover:bg-margen hover:text-papel"
            : "border-margen-hilo text-margen hover:bg-margen hover:text-papel",
        )}
      >
        {casilla.estado === "atrasado" ? "tarde" : "hoy"}
        <span className="sr-only">
          · marcar {nombre} de {tema}
        </span>
      </button>
    );
  }

  // Un tema sin empezar se marca desde aquí: es la entrada natural al registro.
  if (casilla.estado === "sin_empezar" && casilla.indice === 0) {
    return (
      <button
        type="button"
        onClick={onMarcar}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-pliegue border border-dashed border-linea px-2 text-[0.8rem] text-apagado transition-colors hover:border-tinta hover:bg-papel-franja hover:text-tinta"
      >
        marcar
        <span className="sr-only">
          {" "}
          {tema} como estudiado hoy
        </span>
      </button>
    );
  }

  if (casilla.estado === "pendiente" && casilla.tocaEn) {
    return (
      <button
        type="button"
        onClick={onMarcar}
        title={`Toca ${cuando(casilla.tocaEn)}. Puedes adelantarlo.`}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-pliegue border border-linea px-2 text-[0.8rem] text-apagado transition-colors hover:border-tinta hover:text-tinta"
      >
        {fechaCorta(casilla.tocaEn)}
        <span className="sr-only">
          · {nombre} de {tema}, toca {cuando(casilla.tocaEn)}. Marcar de todos modos.
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
      <span className={todoHecho ? "text-visto" : "text-apagado"}>
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
