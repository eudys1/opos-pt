"use client";

import Link from "next/link";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { useRecordado } from "@/datos/cache";
import { fechaCorta } from "@/nucleo/fechas";

/**
 * Las gráficas que dependen de la cuenta: aciertos por tema, fallos y notas de
 * simulacro.
 *
 * El dato va en la forma: el acierto es el largo de la barra y su color dice
 * si va bien (verde), regular (ámbar) o mal (rojo). Todas llevan su tabla de
 * datos en un desplegable, para lector de pantalla y para comprobar las barras.
 */

type Dominio = { tema_id: string; dominio: number; intentos: number };
type Simulacro = {
  id: string;
  modalidad: string;
  nota: number | null;
  creado_en: string;
  reloj?: string | null;
};
type Resistente = { veces_fallado: number; tema_id: string; items: { enunciado: string } | null };

function nivel(porcentaje: number): { barra: string; texto: string } {
  if (porcentaje >= 80) return { barra: "bg-visto-vivo", texto: "text-visto" };
  if (porcentaje >= 60) return { barra: "bg-aviso-vivo", texto: "text-aviso" };
  return { barra: "bg-margen", texto: "text-margen" };
}

type DatosGraficas = {
  dominios: Dominio[];
  fallos: { abiertos: number; superados: number };
  resiste: Resistente | null;
  simulacros: Simulacro[];
};

export function GraficasNube() {
  const { temas } = useCuaderno();
  const { usuario, cliente } = useSesion();

  // Recordado entre visitas (src/datos/cache.ts): al volver a Mi progreso las
  // gráficas están ya, en vez de aparecer abajo un momento después.
  const { datos: leido } = useRecordado<DatosGraficas>(
    cliente && usuario ? `graficas:${usuario.id}` : null,
    async () => {
      const [dom, fls, peor, sims] = await Promise.all([
        cliente!.from("dominio_por_tema").select("tema_id, dominio, intentos"),
        cliente!.from("fallos").select("resuelto_en"),
        cliente!
          .from("fallos")
          .select("veces_fallado, tema_id, items(enunciado)")
          .is("resuelto_en", null)
          .order("veces_fallado", { ascending: false })
          .limit(1),
        cliente!
          .from("simulacros")
          .select("id, modalidad, nota, creado_en, reloj")
          .eq("estado", "corregido")
          .order("creado_en"),
      ]);
      const fallo = dom.error ?? fls.error ?? peor.error ?? sims.error;
      if (fallo) throw new Error(fallo.message);
      return {
        dominios: (dom.data ?? []) as Dominio[],
        fallos: {
          abiertos: (fls.data ?? []).filter((f) => !f.resuelto_en).length,
          superados: (fls.data ?? []).filter((f) => f.resuelto_en).length,
        },
        resiste: ((peor.data ?? [])[0] as unknown as Resistente) ?? null,
        simulacros: (sims.data ?? []) as Simulacro[],
      };
    },
  );

  if (!usuario || !leido) return null;
  const { dominios, fallos, resiste, simulacros } = leido;


  const practicados = dominios
    .map((d) => ({ ...d, tema: temas.find((t) => t.id === d.tema_id) }))
    .filter((d) => d.tema && d.intentos >= 3)
    .sort((a, b) => a.tema!.numero - b.tema!.numero);

  const conNota = simulacros.filter((s) => s.nota !== null);
  const totalFallos = fallos.abiertos + fallos.superados;
  const temaResiste = resiste ? temas.find((t) => t.id === resiste.tema_id) : undefined;

  if (practicados.length === 0 && conNota.length === 0 && totalFallos === 0) {
    return (
      <Ficha className="px-5 py-5">
        <h2 className="text-xl">Aciertos, fallos y simulacros</h2>
        <p className="mt-1 text-[0.92rem] text-texto">
          Aparecerán aquí en cuanto respondas preguntas en{" "}
          <Link href="/practicar" className="regla font-semibold text-tinta">
            Practicar
          </Link>{" "}
          o hagas un simulacro.
        </p>
      </Ficha>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      {practicados.length > 0 ? (
        <Ficha className="flex flex-col gap-3 px-5 py-5">
          <div>
            <h2 className="text-xl">Aciertos por tema</h2>
            <p className="text-[0.85rem] text-apagado">Temas con al menos tres preguntas respondidas.</p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {practicados.map((d) => {
              const porcentaje = Math.round(Number(d.dominio) * 100);
              const n = nivel(porcentaje);
              return (
                <li key={d.tema_id} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-[0.82rem] font-semibold text-apagado" data-numerico>
                    Tema {d.tema!.numero}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-linea-suave">
                    <span
                      className={clsx("block h-full rounded-full", n.barra)}
                      style={{ width: `${Math.max(3, porcentaje)}%` }}
                    />
                  </span>
                  <span className={clsx("w-10 shrink-0 text-right text-[0.82rem] font-bold", n.texto)} data-numerico>
                    {porcentaje}%
                  </span>
                </li>
              );
            })}
          </ul>
          <details className="text-[0.85rem] text-apagado">
            <summary className="regla w-fit cursor-pointer text-texto">Ver los datos</summary>
            <p className="mt-2 leading-relaxed" data-numerico>
              {practicados
                .map((d) => `tema ${d.tema!.numero}: ${Math.round(Number(d.dominio) * 100)} % en ${d.intentos} respuestas`)
                .join(" · ")}
            </p>
          </details>
        </Ficha>
      ) : null}

      {totalFallos > 0 ? (
        <Ficha className="flex flex-col gap-3 px-5 py-5">
          <div>
            <h2 className="text-xl">Fallos</h2>
            <p className="text-[0.85rem] text-apagado">Se supera tras tres aciertos seguidos.</p>
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded-full" aria-hidden="true">
            <span className="bg-margen" style={{ width: `${(fallos.abiertos / totalFallos) * 100}%` }} />
            <span className="flex-1 bg-visto-vivo" />
          </div>
          <dl className="flex gap-6">
            <div>
              <dd className="font-display text-[1.8rem] font-bold leading-none text-margen" data-numerico>
                {fallos.abiertos}
              </dd>
              <dt className="text-[0.82rem] text-apagado">abiertos</dt>
            </div>
            <div>
              <dd className="font-display text-[1.8rem] font-bold leading-none text-visto" data-numerico>
                {fallos.superados}
              </dd>
              <dt className="text-[0.82rem] text-apagado">superados</dt>
            </div>
          </dl>
          {resiste?.items ? (
            <Link
              href="/fallos"
              className="mt-auto rounded-pliegue bg-papel-franja px-3.5 py-3 text-[0.88rem] leading-snug text-texto hover:text-tinta"
            >
              <span className="font-semibold text-tinta">Lo que más se te resiste</span>
              {temaResiste ? <span className="text-apagado"> · tema {temaResiste.numero}</span> : null}
              <span className="mt-1 block">
                «{resiste.items.enunciado}», {resiste.veces_fallado}{" "}
                {resiste.veces_fallado === 1 ? "fallo" : "fallos"}.
              </span>
            </Link>
          ) : null}
        </Ficha>
      ) : null}

      {conNota.length > 0 ? (
        <Ficha className="flex flex-col gap-3 px-5 py-5 lg:col-span-2">
          <div>
            <h2 className="text-xl">Notas de los simulacros</h2>
            <p className="text-[0.85rem] text-apagado">
              Orientativas, sobre 10, en el orden en que los has hecho. Las rayadas son flexibles.
            </p>
          </div>
          <div className="flex h-44 items-end gap-2">
            {conNota.slice(-14).map((s) => {
              const nota = Number(s.nota);
              return (
                <div key={s.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[0.72rem] font-semibold text-apagado" data-numerico>
                    {nota.toFixed(1)}
                  </span>
                  <div
                    className={clsx(
                      "w-full rounded-t-[6px]",
                      nota >= 5 ? "bg-sec-simulacro" : "bg-margen",
                      s.reloj === "flexible" &&
                        "bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(255_255_255/0.35)_4px_7px)]",
                    )}
                    style={{ height: `${Math.max(4, nota * 10)}%` }}
                  />
                  <span className="text-[0.65rem] text-tenue" data-numerico>
                    {fechaCorta(s.creado_en.slice(0, 10))}
                  </span>
                </div>
              );
            })}
          </div>
          <details className="text-[0.85rem] text-apagado">
            <summary className="regla w-fit cursor-pointer text-texto">Ver los datos</summary>
            <p className="mt-2 leading-relaxed">
              {conNota
                .slice(-14)
                .map(
                  (s) =>
                    `${fechaCorta(s.creado_en.slice(0, 10))}: ${Number(s.nota).toFixed(1)} (${s.modalidad}${s.reloj === "flexible" ? ", flexible" : ""})`,
                )
                .join(" · ")}
            </p>
          </details>
        </Ficha>
      ) : null}
    </div>
  );
}
