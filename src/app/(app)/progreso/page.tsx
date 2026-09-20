"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { useCuaderno } from "@/datos/almacen";
import { tituloCorto } from "@/contenido/temario-pt";
import { fechaCorta, hoyISO, sumarDias } from "@/nucleo/fechas";
import { calcularRacha, diasParaExamen } from "@/nucleo/racha";
import { progresoDelTema } from "@/nucleo/repasos";

const SEMANAS_MAPA = 26;

export default function PaginaProgreso() {
  const { temas, eventos, perfil, cargado } = useCuaderno();
  const hoy = hoyISO();

  const racha = calcularRacha(eventos, { hoy, diasLibresAlMes: perfil.diasLibresAlMes });
  const dias = diasParaExamen(perfil.fechaExamen, hoy);

  const conContenido = temas.filter((t) => t.estadoContenido !== "sin_contenido").length;
  const estudiados = temas.filter((t) => t.estadoEstudio !== "por_estudiar").length;
  const dominados = temas.filter((t) => t.estadoEstudio === "dominado").length;

  const porDia = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const e of eventos) mapa.set(e.fecha, (mapa.get(e.fecha) ?? 0) + 1);
    return mapa;
  }, [eventos]);

  const semanas = useMemo(() => {
    const salida: { dia: string; cantidad: number }[][] = [];
    // Empezamos en el lunes de hace SEMANAS_MAPA semanas.
    const d = new Date(`${hoy}T00:00:00`);
    const desplazamiento = (d.getDay() + 6) % 7;
    const primerLunes = sumarDias(hoy, -desplazamiento - (SEMANAS_MAPA - 1) * 7);
    for (let s = 0; s < SEMANAS_MAPA; s += 1) {
      const semana: { dia: string; cantidad: number }[] = [];
      for (let j = 0; j < 7; j += 1) {
        const dia = sumarDias(primerLunes, s * 7 + j);
        semana.push({ dia, cantidad: porDia.get(dia) ?? 0 });
      }
      salida.push(semana);
    }
    return salida;
  }, [hoy, porDia]);

  const repasosPorSemana = useMemo(
    () =>
      semanas.map((semana) => ({
        etiqueta: fechaCorta(semana[0].dia),
        total: semana.reduce((acc, d) => acc + d.cantidad, 0),
      })),
    [semanas],
  );
  const maximoSemana = Math.max(1, ...repasosPorSemana.map((s) => s.total));
  const ultimas12 = repasosPorSemana.slice(-12);

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
              ? "pon una fecha estimada"
              : estudiados < temas.length
                ? `${Math.max(1, Math.floor(dias / Math.max(1, temas.length - estudiados)))} días por tema restante`
                : "temario cubierto"
          }
        />
        <Dato
          titulo="Racha"
          valor={`${racha.dias} días`}
          pie={racha.hoyPendiente ? "hoy aún no cuenta" : `${racha.diasLibresRestantes} días libres`}
        />
        <Dato titulo="Temas estudiados" valor={`${estudiados}`} pie={`de ${temas.length}`} />
        <Dato titulo="Vueltas completas" valor={`${dominados}`} pie="temas con todos los repasos" />
      </dl>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Ficha className="flex flex-col gap-4 px-5 py-5">
          <div>
            <h2 className="text-xl">Actividad por semana</h2>
            <p className="text-[0.85rem] text-apagado">
              Marcas de estudio y repaso de las últimas 12 semanas.
            </p>
          </div>

          {sinDatos ? (
            <p className="py-8 text-[0.95rem] text-apagado">
              Todavía no hay actividad registrada.
            </p>
          ) : (
            <>
              <div className="flex h-40 items-end gap-2">
                {ultimas12.map((s) => (
                  <div key={s.etiqueta} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-[2px] bg-tinta"
                      style={{ height: `${Math.max(2, (s.total / maximoSemana) * 100)}%` }}
                    />
                    <span className="text-[0.65rem] text-tenue" data-numerico>
                      {s.etiqueta}
                    </span>
                  </div>
                ))}
              </div>
              <details className="text-[0.85rem] text-apagado">
                <summary className="regla cursor-pointer text-texto">Ver los datos</summary>
                <p className="mt-2 leading-relaxed" data-numerico>
                  {ultimas12.map((s) => `${s.etiqueta}: ${s.total}`).join(" · ")}
                </p>
              </details>
            </>
          )}
        </Ficha>

        <Ficha className="flex flex-col gap-4 px-5 py-5">
          <div>
            <h2 className="text-xl">Calendario de actividad</h2>
            <p className="text-[0.85rem] text-apagado">Últimos seis meses, día a día.</p>
          </div>
          <div className="flex gap-[3px] overflow-x-auto pb-1">
            {semanas.map((semana, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {semana.map((d) => (
                  <span
                    key={d.dia}
                    title={`${d.dia}: ${d.cantidad} ${d.cantidad === 1 ? "marca" : "marcas"}`}
                    className={clsx(
                      "h-3 w-3 rounded-[2px] border border-linea-suave",
                      d.cantidad === 0 && "bg-papel",
                      d.cantidad === 1 && "border-visto/30 bg-visto/25",
                      d.cantidad === 2 && "border-visto/50 bg-visto/55",
                      d.cantidad >= 3 && "border-visto bg-visto",
                      d.dia > hoy && "opacity-40",
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="text-[0.8rem] text-apagado">
            Cada cuadro es un día. Cuanto más verde, más marcas ese día.
          </p>
        </Ficha>
      </div>

      <Ficha className="flex flex-col gap-4 px-5 py-5">
        <div>
          <h2 className="text-xl">Mapa del temario</h2>
          <p className="text-[0.85rem] text-apagado">
            Cada barra es un tema: lo relleno es lo que llevas hecho de su ciclo de repasos.
          </p>
        </div>
        <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {avance.map(({ tema, hechas, total }) => (
            <li key={tema.id} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-[0.8rem] text-tenue" data-numerico>
                {String(tema.numero).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.85rem] text-texto">
                  {tituloCorto(tema.titulo, 46)}
                </span>
                <span className="mt-1 block h-2 w-full rounded-[2px] bg-linea-suave">
                  <span
                    className={clsx(
                      "block h-2 rounded-[2px]",
                      hechas === total ? "bg-visto" : "bg-tinta",
                    )}
                    style={{ width: `${(hechas / total) * 100}%` }}
                  />
                </span>
              </span>
              <span className="w-10 shrink-0 text-right text-[0.78rem] text-apagado" data-numerico>
                {hechas}/{total}
              </span>
            </li>
          ))}
        </ol>
      </Ficha>

      <p className="text-[0.85rem] text-apagado">
        Con contenido: {conContenido} de {temas.length} temas. Las gráficas de aciertos, fallos y
        notas de simulacro aparecerán cuando esas partes estén en marcha.
      </p>
    </div>
  );
}

function Dato({ titulo, valor, pie }: { titulo: string; valor: string; pie?: string }) {
  return (
    <Ficha className="px-4 py-3">
      <dt className="text-[0.8rem] text-apagado">{titulo}</dt>
      <dd>
        <span className="font-display text-[1.7rem] leading-tight" data-numerico>
          {valor}
        </span>
        {pie ? <span className="mt-0.5 block text-[0.8rem] text-apagado">{pie}</span> : null}
      </dd>
    </Ficha>
  );
}
