"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { Boton } from "@/components/ui/boton";
import { Visto } from "@/components/marcas";
import { useCuaderno } from "@/datos/almacen";

import { fechaCorta, hoyISO, sumarDias } from "@/nucleo/fechas";
import { repasosDelDia, progresoDelTema } from "@/nucleo/repasos";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Lunes de la semana a la que pertenece una fecha. */
function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const diaSemana = (d.getDay() + 6) % 7; // 0 = lunes
  return sumarDias(fecha, -diaSemana);
}

export default function PaginaPlanificador() {
  const { temas, eventos, objetivos, perfil, anadirObjetivo, alternarObjetivo, borrarObjetivo, aplazarObjetivo, cargado } =
    useCuaderno();
  const hoy = hoyISO();
  const [lunes, setLunes] = useState(() => lunesDe(hoy));

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes]);

  const pendientesHoy = useMemo(
    () =>
      repasosDelDia(
        eventos,
        temas.map((t) => t.id),
        { intervalos: perfil.intervalosRepaso, hoy },
      ),
    [eventos, temas, perfil.intervalosRepaso, hoy],
  );

  // Repasos con fecha futura dentro de la semana mostrada.
  const repasosPorDia = useMemo(() => {
    const mapa = new Map<string, { temaId: string; indice: number }[]>();
    for (const tema of temas) {
      const { siguiente } = progresoDelTema(eventos, tema.id, {
        intervalos: perfil.intervalosRepaso,
        hoy,
      });
      if (!siguiente?.tocaEn) continue;
      const lista = mapa.get(siguiente.tocaEn) ?? [];
      lista.push({ temaId: tema.id, indice: siguiente.indice });
      mapa.set(siguiente.tocaEn, lista);
    }
    return mapa;
  }, [temas, eventos, perfil.intervalosRepaso, hoy]);

  const delMes = objetivos.filter((o) => o.fecha.slice(0, 7) === hoy.slice(0, 7));
  const cumplidos = delMes.filter((o) => o.hecho).length;
  const porcentaje = delMes.length ? Math.round((cumplidos / delMes.length) * 100) : null;

  if (!cargado) return <p className="text-apagado">Abriendo el cuaderno…</p>;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-[2.1rem]">Planificador</h1>
          <p className="mt-1 text-[0.98rem] text-texto">
            Apunta lo que quieres hacer cada día y márcalo al terminar. Los repasos que tocan
            aparecen solos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Boton tono="secundario" onClick={() => setLunes(sumarDias(lunes, -7))}>
            ← Semana anterior
          </Boton>
          <Boton tono="fantasma" onClick={() => setLunes(lunesDe(hoy))}>
            Esta semana
          </Boton>
          <Boton tono="secundario" onClick={() => setLunes(sumarDias(lunes, 7))}>
            Semana siguiente →
          </Boton>
        </div>
      </header>

      {pendientesHoy.length > 0 ? (
        <Ficha className="flex flex-wrap items-center gap-x-3 gap-y-1 border-margen-hilo bg-margen-fondo px-5 py-3">
          <p className="text-[0.95rem] text-tinta">
            <strong className="font-semibold">Hoy toca:</strong>{" "}
            {pendientesHoy
              .slice(0, 4)
              .map((p) => {
                const tema = temas.find((t) => t.id === p.temaId);
                return `${p.casilla.indice === 0 ? "estudiar" : `repaso ${p.casilla.indice}`} del tema ${tema?.numero}`;
              })
              .join(" · ")}
            {pendientesHoy.length > 4 ? ` y ${pendientesHoy.length - 4} más` : ""}
          </p>
        </Ficha>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-7">
        {dias.map((dia, i) => {
          const esHoy = dia === hoy;
          const delDia = objetivos.filter((o) => o.fecha === dia);
          const repasos = repasosPorDia.get(dia) ?? [];
          return (
            <Ficha
              key={dia}
              className={clsx(
                "flex min-h-[13rem] flex-col gap-2 px-4 py-3",
                esHoy && "border-tinta",
                (i === 5 || i === 6) && "bg-papel-franja",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className={clsx("text-[0.9rem] font-semibold", esHoy && "text-margen")}>
                  {DIAS[i]}
                </span>
                <span className="text-[0.8rem] text-apagado" data-numerico>
                  {fechaCorta(dia)}
                </span>
              </div>

              {repasos.map((r) => {
                const tema = temas.find((t) => t.id === r.temaId);
                if (!tema) return null;
                return (
                  <p
                    key={`${r.temaId}-${r.indice}`}
                    className="rounded-pliegue border border-dashed border-linea px-2 py-1.5 text-[0.82rem] text-apagado"
                  >
                    {r.indice === 0 ? "Estudiar" : `Repaso ${r.indice}`} · tema {tema.numero}
                  </p>
                );
              })}

              <ul className="flex flex-col gap-1.5">
                {delDia.map((o) => (
                  <li key={o.id} className="group flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => alternarObjetivo(o.id)}
                      aria-pressed={o.hecho}
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-linea bg-papel-alto"
                    >
                      {o.hecho ? <Visto className="h-4 w-4" /> : null}
                      <span className="sr-only">
                        {o.hecho ? "Desmarcar" : "Marcar como cumplido"}: {o.texto}
                      </span>
                    </button>
                    <span
                      className={clsx(
                        "flex-1 text-[0.88rem] leading-snug",
                        o.hecho ? "text-tenue line-through" : "text-texto",
                      )}
                    >
                      {o.texto}
                    </span>
                    <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      {!o.hecho ? (
                        <button
                          type="button"
                          onClick={() => aplazarObjetivo(o.id, sumarDias(o.fecha, 1))}
                          title="Pasar a mañana"
                          className="text-[0.75rem] text-apagado hover:text-tinta"
                        >
                          →
                          <span className="sr-only">Pasar a mañana: {o.texto}</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => borrarObjetivo(o.id)}
                        title="Borrar"
                        className="text-[0.75rem] text-apagado hover:text-margen"
                      >
                        ×<span className="sr-only">Borrar: {o.texto}</span>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>

              <FormularioObjetivo dia={dia} etiqueta={DIAS[i]} onAnadir={anadirObjetivo} />
            </Ficha>
          );
        })}
      </div>

      <Ficha className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <p className="text-[0.95rem] text-texto">
          Este mes: <strong className="font-semibold">{cumplidos}</strong> de {delMes.length}{" "}
          objetivos cumplidos
          {porcentaje !== null ? (
            <span className="ml-2 font-display text-[1.2rem]" data-numerico>
              {porcentaje}%
            </span>
          ) : null}
        </p>
        {delMes.length === 0 ? (
          <p className="text-[0.9rem] text-apagado">
            Empieza apuntando un objetivo pequeño para hoy: «leer el tema 1», por ejemplo.
          </p>
        ) : null}
      </Ficha>

      <details className="max-w-[70ch] text-[0.9rem] text-texto">
        <summary className="regla cursor-pointer text-tinta">
          ¿De dónde salen los repasos que aparecen solos?
        </summary>
        <p className="mt-2 leading-relaxed text-apagado">
          De lo que marcas en el registro de estudio. Al marcar un tema como estudiado, la app fija
          el repaso 1 a los {perfil.intervalosRepaso[0]} días, y los siguientes a los{" "}
          {perfil.intervalosRepaso.slice(1).join(", ")} días del anterior. Solo se muestra el próximo
          repaso de cada tema, porque los demás dependen de cuándo hagas este.
        </p>
      </details>

      <p className="text-[0.85rem] text-apagado">
        Llevas {temas.filter((t) => t.estadoEstudio !== "por_estudiar").length} temas empezados de{" "}
        {temas.length}. Los que aún no has estudiado no generan repasos.
      </p>
    </div>
  );
}

function FormularioObjetivo({
  dia,
  etiqueta,
  onAnadir,
}: {
  dia: string;
  etiqueta: string;
  onAnadir: (fecha: string, texto: string) => void;
}) {
  const [texto, setTexto] = useState("");

  return (
    <form
      className="mt-auto flex gap-1 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!texto.trim()) return;
        onAnadir(dia, texto.trim());
        setTexto("");
      }}
    >
      <label htmlFor={`obj-${dia}`} className="sr-only">
        Añadir objetivo para el {etiqueta} {fechaCorta(dia)}
      </label>
      <input
        id={`obj-${dia}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Añadir…"
        className="min-w-0 flex-1 rounded-pliegue border border-linea bg-papel-alto px-2 py-1.5 text-[0.85rem]"
      />
      <button
        type="submit"
        className="rounded-pliegue border border-linea bg-papel-alto px-2 text-[0.9rem] text-texto hover:border-tinta"
      >
        +<span className="sr-only">Añadir objetivo</span>
      </button>
    </form>
  );
}
