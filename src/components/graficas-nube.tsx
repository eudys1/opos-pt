"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { tituloCorto } from "@/contenido/temario-pt";
import { fechaCorta } from "@/nucleo/fechas";

/**
 * Las gráficas que dependen de la cuenta: aciertos por tema, estado de los
 * fallos y evolución de las notas de simulacro.
 *
 * Todas llevan su tabla de datos en un desplegable, para que se puedan leer con
 * lector de pantalla y para comprobar de dónde sale cada barra.
 */

type Dominio = { tema_id: string; dominio: number; intentos: number };
type Simulacro = { id: string; modalidad: string; nota: number | null; creado_en: string };

export function GraficasNube() {
  const { temas } = useCuaderno();
  const { usuario, cliente } = useSesion();

  const [dominios, setDominios] = useState<Dominio[]>([]);
  const [fallos, setFallos] = useState<{ abiertos: number; superados: number }>({
    abiertos: 0,
    superados: 0,
  });
  const [simulacros, setSimulacros] = useState<Simulacro[]>([]);
  const [pedido, setPedido] = useState(false);

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    void (async () => {
      const [{ data: dom }, { data: fls }, { data: sims }] = await Promise.all([
        cliente.from("dominio_por_tema").select("tema_id, dominio, intentos"),
        cliente.from("fallos").select("resuelto_en"),
        cliente
          .from("simulacros")
          .select("id, modalidad, nota, creado_en")
          .eq("estado", "corregido")
          .order("creado_en"),
      ]);
      if (!vivo) return;
      setDominios((dom ?? []) as Dominio[]);
      setFallos({
        abiertos: (fls ?? []).filter((f) => !f.resuelto_en).length,
        superados: (fls ?? []).filter((f) => f.resuelto_en).length,
      });
      setSimulacros((sims ?? []) as Simulacro[]);
      setPedido(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, usuario]);

  if (!usuario || !pedido) return null;

  const practicados = dominios
    .map((d) => ({ ...d, tema: temas.find((t) => t.id === d.tema_id) }))
    .filter((d) => d.tema && d.intentos >= 3)
    .sort((a, b) => Number(a.dominio) - Number(b.dominio));

  const conNota = simulacros.filter((s) => s.nota !== null);
  const maximaNota = 10;

  if (practicados.length === 0 && conNota.length === 0 && fallos.abiertos + fallos.superados === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {practicados.length > 0 ? (
        <Ficha className="flex flex-col gap-3 px-5 py-5">
          <div>
            <h2 className="text-xl">Aciertos por tema</h2>
            <p className="text-[0.85rem] text-apagado">
              Solo los temas con al menos tres preguntas respondidas, de peor a mejor.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {practicados.slice(0, 10).map((d) => {
              const porcentaje = Math.round(Number(d.dominio) * 100);
              return (
                <li key={d.tema_id} className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-[0.8rem] text-tenue" data-numerico>
                    {String(d.tema!.numero).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.85rem] text-texto">
                      {tituloCorto(d.tema!.titulo, 40)}
                    </span>
                    <span className="mt-1 block h-2 w-full rounded-[2px] bg-linea-suave">
                      <span
                        className={clsx(
                          "block h-2 rounded-[2px]",
                          porcentaje >= 80 ? "bg-visto" : porcentaje >= 60 ? "bg-tinta" : "bg-margen",
                        )}
                        style={{ width: `${Math.max(3, porcentaje)}%` }}
                      />
                    </span>
                  </span>
                  <span className="w-10 shrink-0 text-right text-[0.8rem] text-apagado" data-numerico>
                    {porcentaje}%
                  </span>
                </li>
              );
            })}
          </ul>
        </Ficha>
      ) : null}

      {fallos.abiertos + fallos.superados > 0 ? (
        <Ficha className="flex flex-col gap-3 px-5 py-5">
          <div>
            <h2 className="text-xl">Fallos</h2>
            <p className="text-[0.85rem] text-apagado">
              Un fallo se supera tras tres aciertos seguidos.
            </p>
          </div>
          <div className="flex h-8 w-full overflow-hidden rounded-[3px] border border-linea">
            <div
              className="bg-margen"
              style={{
                width: `${(fallos.abiertos / (fallos.abiertos + fallos.superados)) * 100}%`,
              }}
            />
            <div className="flex-1 bg-visto" />
          </div>
          <dl className="flex gap-6 text-[0.9rem]">
            <div>
              <dt className="text-apagado">Abiertos</dt>
              <dd className="font-display text-[1.5rem] text-margen" data-numerico>
                {fallos.abiertos}
              </dd>
            </div>
            <div>
              <dt className="text-apagado">Superados</dt>
              <dd className="font-display text-[1.5rem] text-visto" data-numerico>
                {fallos.superados}
              </dd>
            </div>
          </dl>
        </Ficha>
      ) : null}

      {conNota.length > 0 ? (
        <Ficha className="flex flex-col gap-3 px-5 py-5 lg:col-span-2">
          <div>
            <h2 className="text-xl">Notas de los simulacros</h2>
            <p className="text-[0.85rem] text-apagado">
              Orientativas, sobre 10, en el orden en que los has hecho.
            </p>
          </div>
          <div className="flex h-40 items-end gap-2">
            {conNota.slice(-14).map((s) => (
              <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[0.7rem] text-apagado" data-numerico>
                  {s.nota!.toFixed(1)}
                </span>
                <div
                  className={clsx(
                    "w-full rounded-t-[2px]",
                    s.nota! >= 7 ? "bg-visto" : s.nota! >= 5 ? "bg-tinta" : "bg-margen",
                  )}
                  style={{ height: `${Math.max(4, (s.nota! / maximaNota) * 100)}%` }}
                />
                <span className="text-[0.65rem] text-tenue" data-numerico>
                  {fechaCorta(s.creado_en.slice(0, 10))}
                </span>
              </div>
            ))}
          </div>
          <details className="text-[0.85rem] text-apagado">
            <summary className="regla cursor-pointer text-texto">Ver los datos</summary>
            <p className="mt-2 leading-relaxed">
              {conNota
                .slice(-14)
                .map((s) => `${fechaCorta(s.creado_en.slice(0, 10))}: ${s.nota!.toFixed(1)} (${s.modalidad})`)
                .join(" · ")}
            </p>
          </details>
        </Ficha>
      ) : null}
    </div>
  );
}
