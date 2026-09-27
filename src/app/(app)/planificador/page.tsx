"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { Boton } from "@/components/ui/boton";
import { Visto } from "@/components/marcas";
import { SECCIONES, TIPOS_ACTIVIDAD } from "@/components/ui/secciones";
import { textoDeEntrada } from "@/components/ui/texto-entrada";
import { EditorHito, type HitoAEditar } from "@/components/editor-hito";
import { EditorObjetivo, type ObjetivoAEditar } from "@/components/editor-objetivo";
import { useCuaderno } from "@/datos/almacen";
import { usePreferencia } from "@/datos/preferencias";
import {
  agenda,
  diasDelRango,
  lunesDe,
  rejillaDelMes,
  resumenObjetivos,
  type EntradaAgenda,
} from "@/nucleo/agenda";
import { fechaCorta, fechaLarga, hoyISO, sumarDias } from "@/nucleo/fechas";
import type { Tema } from "@/nucleo/tipos";

/**
 * Planificador.
 *
 * Enseña en cada día todo lo que hay: lo que has hecho, los repasos que tocan
 * (o que has movido) y lo que te has propuesto, cada cosa con el color de su
 * tipo. Todo se puede pulsar para editarlo, y los repasos son los mismos del
 * registro de estudio: cambiarlos aquí los cambia allí.
 *
 * Semana o mes: el mes, para no cargar la pantalla, enseña solo marcas de
 * color por día; al pulsar un día se despliega su detalle debajo.
 */

type Vista = "semana" | "mes";

const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function nombreMes(fecha: string): string {
  const [anio, mes] = fecha.split("-").map(Number);
  return `${MESES[mes - 1]} de ${anio}`;
}

function sumarMeses(fecha: string, n: number): string {
  const [anio, mes] = fecha.split("-").map(Number);
  const d = new Date(anio, mes - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function finDeMes(fecha: string): string {
  const [anio, mes] = fecha.split("-").map(Number);
  return `${fecha.slice(0, 7)}-${String(new Date(anio, mes, 0).getDate()).padStart(2, "0")}`;
}

export default function PaginaPlanificador() {
  const { temas, eventos, objetivos, perfil, cargado } = useCuaderno();
  const hoy = hoyISO();
  const [vista, setVista] = usePreferencia<Vista>("planificador-vista", "semana");
  const [ancla, setAncla] = useState(hoy);
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);
  const [editandoHito, setEditandoHito] = useState<HitoAEditar | null>(null);
  const [editandoObjetivo, setEditandoObjetivo] = useState<ObjetivoAEditar | null>(null);

  const dias = useMemo(
    () =>
      vista === "semana"
        ? diasDelRango(lunesDe(ancla), sumarDias(lunesDe(ancla), 6))
        : rejillaDelMes(ancla.slice(0, 7)),
    [vista, ancla],
  );

  const mapa = useMemo(
    () =>
      agenda(dias[0], dias[dias.length - 1], {
        eventos,
        objetivos,
        temaIds: temas.map((t) => t.id),
        intervalos: perfil.intervalosRepaso,
        hoy,
      }),
    [dias, eventos, objetivos, temas, perfil.intervalosRepaso, hoy],
  );

  const lunes = lunesDe(vista === "semana" ? ancla : hoy);
  const semana = resumenObjetivos(objetivos, lunes, sumarDias(lunes, 6));
  const inicioMes = `${ancla.slice(0, 7)}-01`;
  const mes = resumenObjetivos(objetivos, inicioMes, finDeMes(inicioMes));

  if (!cargado) return <p className="text-apagado">Abriendo el cuaderno…</p>;

  const pulsar = (e: EntradaAgenda) => {
    if (e.origen === "objetivo" && e.objetivoId) setEditandoObjetivo({ id: e.objetivoId, fecha: e.fecha });
    else if (e.temaId !== undefined && e.indice !== undefined) {
      setEditandoHito({ temaId: e.temaId, indice: e.indice });
    }
  };

  const titulo =
    vista === "semana"
      ? `Semana del ${fechaCorta(dias[0])} al ${fechaCorta(dias[6])}`
      : nombreMes(inicioMes);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-[2.1rem]">Planificador</h1>
          <p className="mt-1 max-w-[68ch] text-[0.98rem] text-texto">
            Todo lo de cada día con su color. Pulsa cualquier cosa para marcarla, moverla o
            editarla; los repasos son los mismos que en el registro.
          </p>
        </div>
        <Boton onClick={() => setEditandoObjetivo({ fecha: hoy })}>Añadir objetivo</Boton>
      </header>

      {/* Resumen de objetivos: semana y mes */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Resumen titulo={vista === "semana" ? "Esta semana" : "Semana actual"} datos={semana} />
        <Resumen titulo={`En ${nombreMes(inicioMes)}`} datos={mes} />
      </div>

      {/* Barra de control */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Vista" className="inline-flex gap-2">
          {(["semana", "mes"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={vista === v}
              onClick={() => {
                setVista(v);
                setDiaAbierto(null);
              }}
              className={clsx(
                "min-h-11 rounded-full border-[3px] border-borde px-5 text-[0.9rem] font-extrabold",
                vista === v ? "bg-acento-vivo text-sobre-boton" : "bg-papel-alto text-tinta hover:bg-papel-franja",
              )}
            >
              {v === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Boton
            tono="secundario"
            onClick={() => setAncla(vista === "semana" ? sumarDias(ancla, -7) : sumarMeses(ancla, -1))}
          >
            <span aria-hidden="true">←</span>
            <span className="sr-only">{vista === "semana" ? "Semana anterior" : "Mes anterior"}</span>
          </Boton>
          <Boton tono="fantasma" onClick={() => setAncla(hoy)}>
            Hoy
          </Boton>
          <Boton
            tono="secundario"
            onClick={() => setAncla(vista === "semana" ? sumarDias(ancla, 7) : sumarMeses(ancla, 1))}
          >
            <span aria-hidden="true">→</span>
            <span className="sr-only">{vista === "semana" ? "Semana siguiente" : "Mes siguiente"}</span>
          </Boton>
        </div>

        <h2 className="text-[1.15rem] first-letter:uppercase" aria-live="polite">
          {titulo}
        </h2>

        <Leyenda />
      </div>

      {vista === "semana" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {dias.map((dia, i) => (
            <DiaSemana
              key={dia}
              dia={dia}
              nombre={DIAS[i]}
              hoy={hoy}
              entradas={mapa.get(dia) ?? []}
              temas={temas}
              onPulsar={pulsar}
              onAnadir={() => setEditandoObjetivo({ fecha: dia })}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="grid grid-cols-7 gap-1.5 text-center text-[0.8rem] font-extrabold text-apagado sm:gap-2">
              {DIAS_CORTOS.map((d, i) => (
                <div key={d} className="py-1" aria-hidden="true">
                  {d}
                  <span className="sr-only">{DIAS[i]}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
              {dias.map((dia) => (
                <DiaMes
                  key={dia}
                  dia={dia}
                  hoy={hoy}
                  delMes={dia.slice(0, 7) === inicioMes.slice(0, 7)}
                  abierto={diaAbierto === dia}
                  entradas={mapa.get(dia) ?? []}
                  onAbrir={() => setDiaAbierto(diaAbierto === dia ? null : dia)}
                />
              ))}
            </div>
          </div>

          {diaAbierto ? (
            <div className="entra">
              <DiaSemana
                dia={diaAbierto}
                nombre={fechaLarga(diaAbierto)}
                hoy={hoy}
                entradas={mapa.get(diaAbierto) ?? []}
                temas={temas}
                onPulsar={pulsar}
                onAnadir={() => setEditandoObjetivo({ fecha: diaAbierto })}
                ancho
              />
            </div>
          ) : (
            <p className="text-[0.88rem] text-apagado">Pulsa un día para ver y editar lo que tiene.</p>
          )}
        </div>
      )}

      <details className="max-w-[70ch] text-[0.9rem] text-texto">
        <summary className="regla w-fit cursor-pointer text-tinta">¿De dónde salen los repasos?</summary>
        <p className="mt-2 leading-relaxed text-apagado">
          De lo que marcas como estudiado. El repaso 1 toca a los {perfil.intervalosRepaso[0]} días,
          y los siguientes a los {perfil.intervalosRepaso.slice(1).join(", ")} días del anterior,
          contados desde el día en que de verdad lo hiciste. Solo se ve el próximo de cada tema,
          porque los demás dependen de cuándo hagas ese. Puedes moverlo a otro día sin hacerlo.
        </p>
      </details>

      <EditorHito hito={editandoHito} onCerrar={() => setEditandoHito(null)} />
      <EditorObjetivo objetivo={editandoObjetivo} onCerrar={() => setEditandoObjetivo(null)} />
    </div>
  );
}

function Resumen({
  titulo,
  datos,
}: {
  titulo: string;
  datos: { total: number; hechos: number; porcentaje: number | null };
}) {
  return (
    <Ficha className="flex items-center gap-4 px-5 py-4">
      <div className="flex-1">
        <p className="text-[0.85rem] text-apagado">{titulo}</p>
        <p className="text-[0.98rem] text-tinta">
          <strong className="font-semibold" data-numerico>
            {datos.hechos} de {datos.total}
          </strong>{" "}
          objetivos cumplidos
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-linea-suave" aria-hidden="true">
          <div
            className="h-full rounded-full bg-visto-vivo transition-[width] duration-500"
            style={{ width: `${datos.porcentaje ?? 0}%` }}
          />
        </div>
      </div>
      <span className="font-display text-[1.8rem] font-bold text-tinta" data-numerico>
        {datos.porcentaje === null ? "—" : `${datos.porcentaje}%`}
      </span>
    </Ficha>
  );
}

function Leyenda() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-apagado lg:ml-auto" aria-label="Colores">
      {TIPOS_ACTIVIDAD.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={clsx("inline-block h-2.5 w-2.5 rounded-full", SECCIONES[t].lleno)} />
          {SECCIONES[t].nombre}
        </li>
      ))}
    </ul>
  );
}

function DiaSemana({
  dia,
  nombre,
  hoy,
  entradas,
  temas,
  onPulsar,
  onAnadir,
  ancho,
}: {
  dia: string;
  nombre: string;
  hoy: string;
  entradas: EntradaAgenda[];
  temas: Tema[];
  onPulsar: (e: EntradaAgenda) => void;
  onAnadir: () => void;
  ancho?: boolean;
}) {
  const { alternarObjetivo } = useCuaderno();
  const esHoy = dia === hoy;
  const pasado = dia < hoy;

  return (
    <Ficha
      className={clsx(
        "flex min-h-[12rem] flex-col gap-2 px-3.5 py-3",
        esHoy && "border-[3px] border-acento-vivo bg-acento-fondo",
        pasado && !esHoy && "opacity-90",
      )}
    >
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <span className={clsx("text-[0.9rem] font-semibold first-letter:uppercase", esHoy ? "text-acento" : "text-tinta")}>
          {nombre}
          {esHoy ? <span className="ml-1.5 text-[0.75rem] font-normal">· hoy</span> : null}
        </span>
        {!ancho ? (
          <span className="text-[0.78rem] text-apagado" data-numerico>
            {fechaCorta(dia)}
          </span>
        ) : null}
      </div>

      <ul className={clsx("flex flex-col gap-1.5", ancho && "sm:grid sm:grid-cols-2")}>
        {entradas.map((e) => {
          const s = SECCIONES[e.tipo];
          const hecho = e.estado === "hecho";
          return (
            <li key={e.clave} className="flex items-stretch gap-1">
              {e.origen === "objetivo" && e.objetivoId ? (
                <button
                  type="button"
                  onClick={() => alternarObjetivo(e.objetivoId!)}
                  aria-pressed={hecho}
                  className={clsx(
                    "inline-flex w-9 shrink-0 items-center justify-center rounded-[10px] border",
                    hecho ? "border-transparent bg-visto-fondo" : "border-linea bg-papel-alto hover:border-borde",
                  )}
                >
                  {hecho ? <Visto className="h-4 w-4" animado={false} /> : null}
                  <span className="sr-only">
                    {hecho ? "Desmarcar" : "Marcar como hecho"}: {e.texto}
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onPulsar(e)}
                className={clsx(
                  "flex min-h-10 flex-1 items-center gap-2 rounded-[10px] border-l-[4px] px-2.5 py-1.5 text-left text-[0.84rem] font-bold leading-snug transition-colors",
                  s.borde,
                  hecho ? "bg-papel-franja text-apagado" : clsx(s.fondo, "text-tinta hover:brightness-95"),
                  e.estado === "atrasado" && "outline outline-1 outline-margen",
                )}
              >
                {hecho && e.origen !== "objetivo" ? (
                  <Visto className={clsx("h-3.5 w-3.5 shrink-0", s.texto)} animado={false} tono="text-current" />
                ) : null}
                <span className={clsx("flex-1", hecho && e.origen === "objetivo" && "line-through")}>
                  {textoDeEntrada(e, temas)}
                  {e.estado === "atrasado" && e.diasDeRetraso ? (
                    <span className="block text-[0.74rem] font-semibold text-margen">
                      {e.diasDeRetraso} {e.diasDeRetraso === 1 ? "día" : "días"} tarde
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onAnadir}
        className="mt-auto min-h-10 rounded-full border-2 border-dashed border-linea text-[0.85rem] font-bold text-apagado hover:border-borde hover:text-tinta"
      >
        + Añadir<span className="sr-only"> objetivo el {fechaLarga(dia)}</span>
      </button>
    </Ficha>
  );
}

function DiaMes({
  dia,
  hoy,
  delMes,
  abierto,
  entradas,
  onAbrir,
}: {
  dia: string;
  hoy: string;
  delMes: boolean;
  abierto: boolean;
  entradas: EntradaAgenda[];
  onAbrir: () => void;
}) {
  const esHoy = dia === hoy;
  const visibles = entradas.slice(0, 4);
  const resto = entradas.length - visibles.length;
  const atrasado = entradas.some((e) => e.estado === "atrasado");

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-expanded={abierto}
      className={clsx(
        "flex min-h-[5.5rem] flex-col gap-1.5 rounded-[14px] p-1.5 text-left transition-colors sm:p-2",
        esHoy
          ? "border-[3px] border-acento-vivo bg-acento-fondo"
          : abierto
            ? "border-[3px] border-borde bg-papel-alto"
            : delMes
              ? "border-2 border-linea bg-papel-alto hover:border-borde"
              : "border-2 border-transparent bg-papel-franja",
      )}
    >
      <span
        className={clsx(
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-[0.85rem] font-extrabold",
          esHoy ? "text-acento" : delMes ? "text-tinta" : "text-tenue",
          atrasado && "ring-2 ring-margen",
        )}
        data-numerico
      >
        {Number(dia.slice(8))}
      </span>
      <span className="flex flex-col gap-1">
        {visibles.map((e) => (
          <span
            key={e.clave}
            aria-hidden="true"
            className={clsx(
              "h-2 rounded-full",
              SECCIONES[e.tipo].lleno,
              e.estado === "hecho" && "opacity-40",
            )}
          />
        ))}
        {resto > 0 ? <span className="text-[0.7rem] text-apagado">+{resto}</span> : null}
      </span>
      <span className="sr-only">
        {fechaLarga(dia)}: {entradas.length === 0 ? "nada" : `${entradas.length} cosas`}
        {atrasado ? ", con algo atrasado" : ""}
      </span>
    </button>
  );
}
