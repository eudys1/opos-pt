"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { Boton } from "@/components/ui/boton";
import { GraficasNube } from "@/components/graficas-nube";
import { useCuaderno } from "@/datos/almacen";
import { agenda, diasDelRango, estadoDelDia, rejillaDelMes, type EstadoDia } from "@/nucleo/agenda";
import { SECCIONES } from "@/components/ui/secciones";
import { textoDeEntrada } from "@/components/ui/texto-entrada";
import { Cifra } from "@/components/ui/cifra";
import { fechaCorta, fechaLarga, hoyISO, sumarDias } from "@/nucleo/fechas";
import { calcularRacha, diasParaExamen } from "@/nucleo/racha";
import { progresoDelTema } from "@/nucleo/repasos";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function nombreMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${anio}`;
}

function mesAnterior(mes: string, n: number): string {
  const [anio, m] = mes.split("-").map(Number);
  const d = new Date(anio, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Colores del calendario: tres, y con significado, no una escala de intensidad. */
const COLOR_DIA: Record<EstadoDia, string> = {
  nada: "bg-linea-suave",
  parcial: "bg-aviso-vivo",
  completo: "bg-visto-vivo",
};
const NOMBRE_DIA: Record<EstadoDia, string> = {
  nada: "no hiciste nada",
  parcial: "hiciste cosas, pero quedó algo sin hacer",
  completo: "lo hiciste todo",
};

export default function PaginaProgreso() {
  const { temas, eventos, objetivos, perfil, cargado } = useCuaderno();
  const hoy = hoyISO();

  const racha = calcularRacha(eventos, { hoy, diasLibresAlMes: perfil.diasLibresAlMes });
  const dias = diasParaExamen(perfil.fechaExamen, hoy);
  const estudiados = temas.filter((t) => t.estadoEstudio !== "por_estudiar").length;
  const dominados = temas.filter((t) => t.estadoEstudio === "dominado").length;

  const avance = useMemo(
    () =>
      temas.map((tema) => {
        const { casillas } = progresoDelTema(eventos, tema.id, {
          intervalos: perfil.intervalosRepaso,
          hoy,
        });
        const hechas = casillas.filter((c) => c.estado === "hecho").length;
        return { tema, hechas, total: casillas.length };
      }),
    [temas, eventos, perfil.intervalosRepaso, hoy],
  );

  // Actividad por semana: las últimas 12, de lunes a domingo.
  const semanas = useMemo(() => {
    const d = new Date(`${hoy}T00:00:00`);
    const lunes = sumarDias(hoy, -((d.getDay() + 6) % 7));
    return Array.from({ length: 12 }, (_, i) => {
      const inicio = sumarDias(lunes, -(11 - i) * 7);
      const total = eventos.filter((e) => e.fecha >= inicio && e.fecha <= sumarDias(inicio, 6)).length;
      return { inicio, total };
    });
  }, [eventos, hoy]);
  const maximoSemana = Math.max(1, ...semanas.map((s) => s.total));

  if (!cargado) return <p className="text-apagado">Abriendo el cuaderno…</p>;
  const sinDatos = eventos.length === 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-[2.1rem]">Mi progreso</h1>
        <p className="mt-1 text-[0.98rem] text-texto">
          {sinDatos
            ? "Aquí se irá dibujando tu avance en cuanto marques el primer tema."
            : "Lo que llevas hecho, sin adornos."}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          titulo="Días hasta el examen"
          valor={dias === null ? "—" : `${dias}`}
          pie={
            dias === null
              ? "pon una fecha en Mi cuenta"
              : estudiados < temas.length
                ? `${Math.max(1, Math.floor(dias / Math.max(1, temas.length - estudiados)))} días por tema que te queda`
                : "temario cubierto"
          }
          acento
        />
        <Dato
          titulo="Racha"
          valor={`${racha.dias} días`}
          pie={racha.hoyPendiente ? "hoy aún no cuenta" : `${racha.diasLibresRestantes} días libres`}
        />
        <Dato titulo="Temas estudiados" valor={`${estudiados}`} pie={`de ${temas.length}`} />
        <Dato titulo="Vueltas completas" valor={`${dominados}`} pie="temas con todos los repasos" />
      </dl>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <CalendarioActividad hoy={hoy} />

        <Ficha className="flex flex-col gap-4 px-5 py-5">
          <div>
            <h2 className="text-xl">Actividad por semana</h2>
            <p className="text-[0.85rem] text-apagado">Marcas de estudio de las últimas 12 semanas.</p>
          </div>
          {sinDatos ? (
            <p className="py-8 text-[0.95rem] text-apagado">Todavía no hay actividad registrada.</p>
          ) : (
            <>
              <div className="flex h-44 items-end gap-1.5">
                {semanas.map((s) => (
                  <div key={s.inicio} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[0.68rem] text-apagado" data-numerico>
                      {s.total || ""}
                    </span>
                    <div
                      className="w-full rounded-t-[5px] bg-sec-repaso"
                      style={{ height: `${Math.max(3, (s.total / maximoSemana) * 100)}%` }}
                    />
                    <span className="text-[0.62rem] text-tenue" data-numerico>
                      {fechaCorta(s.inicio).split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
              <details className="text-[0.85rem] text-apagado">
                <summary className="regla w-fit cursor-pointer text-texto">Ver los datos</summary>
                <p className="mt-2 leading-relaxed" data-numerico>
                  {semanas.map((s) => `semana del ${fechaCorta(s.inicio)}: ${s.total}`).join(" · ")}
                </p>
              </details>
            </>
          )}
        </Ficha>
      </div>

      <MapaTemario avance={avance} />

      <GraficasNube />

      {objetivos.length === 0 && sinDatos ? null : (
        <p className="text-[0.85rem] text-apagado">
          Para sacar una copia de todo, ve a{" "}
          <Link href="/cuenta" className="regla text-tinta">
            Mi cuenta
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function Dato({
  titulo,
  valor,
  pie,
  acento,
}: {
  titulo: string;
  valor: string;
  pie?: string;
  acento?: boolean;
}) {
  return (
    <Ficha className="px-4 py-3">
      <dt className="text-[0.8rem] text-apagado">{titulo}</dt>
      <dd>
        <span
          className={clsx("font-display text-[1.8rem] font-bold leading-tight", acento && "text-acento")}
          data-numerico
        >
          <Cifra valor={valor} />
        </span>
        {pie ? <span className="mt-0.5 block text-[0.8rem] text-apagado">{pie}</span> : null}
      </dd>
    </Ficha>
  );
}

/**
 * Calendario de actividad por meses, con tres colores que dicen algo:
 * gris, nada; ámbar, algo pero no todo; verde, todo. Se puede ir a meses
 * pasados o ver el resumen de todo lo que llevas.
 */
function CalendarioActividad({ hoy }: { hoy: string }) {
  const { eventos, objetivos } = useCuaderno();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [vista, setVista] = useState<"mes" | "total">("mes");
  const [dia, setDia] = useState(hoy);

  const primerDia = useMemo(() => {
    const fechas = [...eventos.map((e) => e.fecha), ...objetivos.map((o) => o.fecha)].filter((f) => f <= hoy);
    return fechas.length ? fechas.sort()[0] : hoy;
  }, [eventos, objetivos, hoy]);

  const rejilla = useMemo(() => rejillaDelMes(mes), [mes]);

  const resumenMeses = useMemo(() => {
    const todos = diasDelRango(primerDia, hoy);
    const porMes = new Map<string, Record<EstadoDia, number>>();
    for (const d of todos) {
      const clave = d.slice(0, 7);
      const r = porMes.get(clave) ?? { nada: 0, parcial: 0, completo: 0 };
      r[estadoDelDia(d, eventos, objetivos)] += 1;
      porMes.set(clave, r);
    }
    return [...porMes.entries()].reverse();
  }, [primerDia, hoy, eventos, objetivos]);

  const totales = resumenMeses.reduce(
    (acc, [, r]) => ({
      nada: acc.nada + r.nada,
      parcial: acc.parcial + r.parcial,
      completo: acc.completo + r.completo,
    }),
    { nada: 0, parcial: 0, completo: 0 },
  );

  return (
    <Ficha className="flex flex-col gap-4 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Calendario de actividad</h2>
          <p className="text-[0.85rem] text-apagado">Cómo fue cada día. Pulsa uno para ver qué hiciste.</p>
        </div>
        <div role="tablist" aria-label="Qué ver" className="inline-flex gap-1.5">
          {(["mes", "total"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={clsx(
                "min-h-10 rounded-full border-2 border-borde px-4 text-[0.85rem] font-extrabold",
                vista === v ? "bg-acento-vivo text-sobre-boton" : "bg-papel-alto text-tinta",
              )}
            >
              {v === "mes" ? "Por meses" : "Resumen total"}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-texto" aria-label="Qué significa cada color">
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[5px] bg-linea-suave ring-1 ring-inset ring-linea" /> Nada
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[5px] bg-aviso-vivo" /> Algo, pero no todo
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[5px] bg-visto-vivo" /> Todo lo que te propusiste
        </li>
      </ul>

      {vista === "mes" ? (
        <>
          <div className="flex items-center gap-2">
            <Boton tono="secundario" onClick={() => setMes(mesAnterior(mes, -1))}>
              <span aria-hidden="true">←</span>
              <span className="sr-only">Mes anterior</span>
            </Boton>
            <p className="flex-1 text-center text-[1rem] font-semibold first-letter:uppercase" aria-live="polite">
              {nombreMes(mes)}
            </p>
            <Boton
              tono="secundario"
              onClick={() => setMes(mesAnterior(mes, 1))}
              disabled={mes >= hoy.slice(0, 7)}
            >
              <span aria-hidden="true">→</span>
              <span className="sr-only">Mes siguiente</span>
            </Boton>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <span key={d} className="text-[0.72rem] font-semibold text-tenue" aria-hidden="true">
                {d}
              </span>
            ))}
            {rejilla.map((d) => {
              const fuera = d.slice(0, 7) !== mes;
              const futuro = d > hoy;
              const estado = estadoDelDia(d, eventos, objetivos);
              const clases = clsx(
                "flex aspect-square items-center justify-center rounded-[10px] text-[0.78rem]",
                futuro ? "border border-dashed border-linea text-tenue" : COLOR_DIA[estado],
                !futuro && estado !== "nada" ? "font-semibold text-tinta" : "text-apagado",
                d === hoy && "ring-2 ring-acento",
              );
              if (fuera || futuro) {
                return (
                  <span
                    key={d}
                    title={fechaLarga(d)}
                    className={clsx(clases, fuera && "opacity-0")}
                    aria-hidden={fuera ? true : undefined}
                    data-numerico
                  >
                    {Number(d.slice(8))}
                  </span>
                );
              }
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDia(d)}
                  aria-pressed={dia === d}
                  title={`${fechaLarga(d)}: ${NOMBRE_DIA[estado]}`}
                  className={clsx(
                    clases,
                    "transition-transform duration-150 hover:-translate-y-0.5 hover:scale-105",
                    dia === d && "outline-[3px] outline-offset-2 outline-borde [outline-style:solid]",
                  )}
                  data-numerico
                >
                  {Number(d.slice(8))}
                  <span className="sr-only">: {NOMBRE_DIA[estado]}. Ver el detalle</span>
                </button>
              );
            })}
          </div>

          {dia.slice(0, 7) === mes ? <DetalleDelDia key={dia} dia={dia} hoy={hoy} /> : null}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[0.92rem] text-texto">
            Desde el {fechaLarga(primerDia)}:{" "}
            <strong className="font-semibold text-visto" data-numerico>
              {totales.completo} días completos
            </strong>
            ,{" "}
            <strong className="font-semibold text-aviso" data-numerico>
              {totales.parcial} a medias
            </strong>{" "}
            y <span data-numerico>{totales.nada}</span> sin actividad.
          </p>
          <ul className="flex flex-col gap-2">
            {resumenMeses.map(([clave, r]) => {
              const total = r.nada + r.parcial + r.completo;
              return (
                <li key={clave} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMes(clave);
                      setVista("mes");
                    }}
                    className="regla w-32 shrink-0 text-left text-[0.85rem] text-tinta first-letter:uppercase"
                  >
                    {nombreMes(clave)}
                  </button>
                  <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-linea-suave" aria-hidden="true">
                    <span className="bg-visto-vivo" style={{ width: `${(r.completo / total) * 100}%` }} />
                    <span className="bg-aviso-vivo" style={{ width: `${(r.parcial / total) * 100}%` }} />
                  </span>
                  <span className="w-24 shrink-0 text-right text-[0.78rem] text-apagado" data-numerico>
                    {r.completo} · {r.parcial} · {r.nada}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[0.78rem] text-apagado">Cifras: completos · a medias · sin actividad.</p>
        </div>
      )}
    </Ficha>
  );
}

/**
 * Lo que pasó un día: lo que hiciste, y lo que te propusiste con su ✔ o sin
 * él. Se abre al pulsar un día del calendario, debajo, sin tapar nada.
 */
function DetalleDelDia({ dia, hoy }: { dia: string; hoy: string }) {
  const { eventos, objetivos, temas, perfil } = useCuaderno();
  const entradas = useMemo(
    () =>
      (
        agenda(dia, dia, {
          eventos,
          objetivos,
          temaIds: [],
          intervalos: perfil.intervalosRepaso,
          hoy,
        }).get(dia) ?? []
      ).filter((e) => e.origen !== "previsto"),
    [dia, eventos, objetivos, perfil.intervalosRepaso, hoy],
  );
  const hechos = entradas.filter((e) => e.origen !== "objetivo");
  const propuestos = entradas.filter((e) => e.origen === "objetivo");
  const cumplidos = propuestos.filter((e) => e.estado === "hecho").length;
  const estado = estadoDelDia(dia, eventos, objetivos);

  return (
    <section
      aria-live="polite"
      aria-label={`Detalle del ${fechaLarga(dia)}`}
      className="entra flex flex-col gap-3 rounded-[16px] border-2 border-borde bg-papel px-4 py-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[1.1rem] first-letter:uppercase">
          {dia === hoy ? "Hoy" : fechaLarga(dia)}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-[0.8rem] font-bold text-apagado">
          <span aria-hidden="true" className={clsx("h-3 w-3 rounded-[5px]", COLOR_DIA[estado])} />
          {NOMBRE_DIA[estado].replace(/^./, (l) => l.toUpperCase())}
        </span>
      </header>

      {entradas.length === 0 ? (
        <p className="text-[0.9rem] text-apagado">
          Ese día no hay nada apuntado: ni marcas en el registro ni objetivos.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-[0.78rem] font-extrabold uppercase tracking-wide text-apagado">
              Lo que hiciste
            </p>
            {hechos.length ? (
              <ul className="flex flex-col gap-1.5">
                {hechos.map((e, i) => (
                  <li
                    key={e.clave}
                    style={{ animationDelay: `${i * 45}ms` }}
                    className={clsx(
                      "entra flex items-center gap-2 rounded-[10px] border-2 px-2.5 py-1.5 text-[0.88rem] font-semibold",
                      SECCIONES[e.tipo].borde,
                      SECCIONES[e.tipo].fondo,
                      SECCIONES[e.tipo].texto,
                    )}
                  >
                    <span aria-hidden="true" className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", SECCIONES[e.tipo].lleno)} />
                    {textoDeEntrada(e, temas)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.86rem] text-apagado">Nada marcado en el registro.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[0.78rem] font-extrabold uppercase tracking-wide text-apagado">
              Lo que te propusiste
              {propuestos.length ? (
                <span className="ml-1.5 normal-case tracking-normal" data-numerico>
                  · {cumplidos} de {propuestos.length}
                </span>
              ) : null}
            </p>
            {propuestos.length ? (
              <ul className="flex flex-col gap-1.5">
                {propuestos.map((e, i) => {
                  const hecho = e.estado === "hecho";
                  return (
                    <li
                      key={e.clave}
                      style={{ animationDelay: `${(hechos.length + i) * 45}ms` }}
                      className={clsx(
                        "entra flex items-start gap-2 text-[0.88rem] leading-snug",
                        hecho ? "text-tinta" : "text-apagado",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 text-[0.75rem] font-extrabold",
                          hecho ? "border-visto-vivo bg-visto-fondo text-visto" : "border-dashed border-linea",
                        )}
                      >
                        {hecho ? "✔" : ""}
                      </span>
                      <span className={clsx(!hecho && "line-through decoration-margen-hilo decoration-2")}>
                        {textoDeEntrada(e, temas)}
                      </span>
                      <span className="sr-only">{hecho ? ": cumplido" : ": no cumplido"}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[0.86rem] text-apagado">Ningún objetivo ese día.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Mapa del temario: una columna por tema, hecha de casillas que se apilan de
 * abajo arriba, una por paso (estudiarlo y cada repaso). Se cuentan casillas,
 * no se lee una cifra: de un vistazo se ve qué temas van altos y cuáles ni
 * han empezado. El borde dice si el tema está subido a Mi temario.
 */
function MapaTemario({
  avance,
}: {
  avance: {
    tema: { id: string; numero: number; estadoContenido: string };
    hechas: number;
    total: number;
  }[];
}) {
  const pasos = avance[0]?.total ?? 0;
  const completos = avance.filter((a) => a.hechas === a.total).length;
  const empezados = avance.filter((a) => a.hechas > 0 && a.hechas < a.total).length;

  return (
    <Ficha className="flex flex-col gap-4 px-5 py-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl">Mapa del temario</h2>
        <p className="max-w-[70ch] text-[0.88rem] leading-relaxed text-texto">
          Una columna por tema, con {pasos} casillas: la de abajo es estudiarlo y las de encima,
          sus {pasos - 1} repasos. Cada vez que marcas uno en el Registro se llena una casilla.
          Llena del todo y en verde, vuelta completa.
        </p>
        <p className="text-[0.84rem] text-apagado" data-numerico>
          {completos} con la vuelta completa · {empezados} en marcha ·{" "}
          {avance.length - completos - empezados} sin empezar
        </p>
      </div>

      <div className="overflow-x-auto pb-1">
        <ol
          className="grid min-w-[36rem] gap-1.5"
          style={{ gridTemplateColumns: `repeat(${avance.length}, minmax(0, 1fr))` }}
        >
          {avance.map(({ tema, hechas, total }, i) => {
            const completo = hechas === total;
            const subido = tema.estadoContenido !== "sin_contenido";
            return (
              <li key={tema.id} className="flex flex-col items-center gap-1.5">
                <span
                  className={clsx(
                    "flex h-36 w-full flex-col-reverse gap-[3px] rounded-[10px] border-2 p-[3px]",
                    subido ? "border-sec-temario-vivo" : "border-dashed border-linea",
                  )}
                  title={`Tema ${tema.numero}${subido ? "" : " (sin subir)"}: ${hechas} de ${total} pasos`}
                >
                  {Array.from({ length: total }, (_, paso) => (
                    <span
                      key={paso}
                      style={{ animationDelay: `${i * 18 + paso * 40}ms` }}
                      className={clsx(
                        "block flex-1 rounded-[5px]",
                        paso < hechas
                          ? clsx("casilla-llena", completo ? "bg-visto-vivo" : "bg-sec-temario-vivo")
                          : "bg-linea-suave",
                      )}
                    />
                  ))}
                </span>
                <span
                  className={clsx("text-[0.72rem] font-extrabold", subido ? "text-sec-temario" : "text-tenue")}
                  data-numerico
                >
                  {tema.numero}
                </span>
                <span className="sr-only">
                  Tema {tema.numero}, {subido ? "subido" : "sin subir"}: {hechas} de {total} pasos hechos
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-texto" aria-label="Qué significa cada cosa">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-[4px] bg-sec-temario-vivo" /> Paso hecho
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-[4px] bg-visto-vivo" /> Vuelta completa
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded-[4px] border-2 border-sec-temario-vivo" /> Tema
          subido
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded-[4px] border-2 border-dashed border-linea" /> Sin
          subir (también cuenta si lo estudias en papel)
        </li>
      </ul>
    </Ficha>
  );
}
