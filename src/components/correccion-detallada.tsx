"use client";

import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import type { CorreccionSupuesto } from "@/ia/supuestos";

/**
 * Corrección de un supuesto o de una parte de examen: la nota por criterio, lo
 * que está bien, lo que falta y lo que está mal. La usan los supuestos y los
 * simulacros para que la corrección se lea siempre igual.
 */
export function CorreccionDetallada({
  correccion,
  rubrica,
}: {
  correccion: CorreccionSupuesto;
  rubrica: { criterio: string; peso: number }[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Ficha className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-5">
        <div>
          <p className="text-[0.8rem] uppercase tracking-[0.1em] text-apagado">Nota orientativa</p>
          <p className="font-display text-[2.6rem] leading-none" data-numerico>
            {correccion.notaGlobal.toFixed(1)}
            <span className="text-[1.2rem] text-apagado"> / 10</span>
          </p>
        </div>
        <p className="max-w-[44ch] text-[0.9rem] leading-relaxed text-apagado">
          Es una nota orientativa, calculada con los pesos de la rúbrica. Sirve para verte evolucionar,
          no para predecir lo que pondrá un tribunal.
        </p>
      </Ficha>

      <section>
        <h3 className="text-xl">Por criterios</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {correccion.porCriterio.map((criterio) => {
            const peso = rubrica.find((r) => r.criterio === criterio.criterio)?.peso;
            return (
              <li key={criterio.criterio}>
                <Ficha className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h4 className="font-display text-[1.05rem]">{criterio.criterio}</h4>
                    {peso ? (
                      <span className="text-[0.8rem] text-apagado" data-numerico>
                        {peso} % de la nota
                      </span>
                    ) : null}
                    <span
                      className={clsx(
                        "ml-auto font-display text-[1.3rem]",
                        criterio.nota >= 7
                          ? "text-visto"
                          : criterio.nota >= 5
                            ? "text-tinta"
                            : "text-margen",
                      )}
                      data-numerico
                    >
                      {criterio.nota.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-linea-suave">
                    <div
                      className={clsx(
                        "h-1.5 rounded-full",
                        criterio.nota >= 7 ? "bg-visto" : criterio.nota >= 5 ? "bg-tinta" : "bg-margen",
                      )}
                      style={{ width: `${Math.max(3, criterio.nota * 10)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-texto">
                    {criterio.comentario}
                  </p>
                </Ficha>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Lista titulo="Lo que has hecho bien" lineas={correccion.bien} tono="visto" />
        <Lista titulo="Lo que falta" lineas={correccion.falta} tono="margen" />
        <Lista titulo="Errores" lineas={correccion.errores} tono="margen" />
      </div>

      {correccion.ortografia.length > 0 ? (
        <Ficha className="px-5 py-4">
          <h3 className="text-[1.05rem]">Ortografía y acentuación</h3>
          <p className="mt-1 text-[0.85rem] text-apagado">
            {correccion.ortografia.length}{" "}
            {correccion.ortografia.length === 1 ? "falta detectada" : "faltas detectadas"}. En
            Andalucía no hay penalización publicada por faltas, pero en el examen se nota.
          </p>
          <p className="mt-2 text-[0.95rem] text-texto">{correccion.ortografia.join(" · ")}</p>
        </Ficha>
      ) : null}

      <Ficha className="border-dashed px-5 py-4">
        <h3 className="text-[1.05rem]">Para la próxima</h3>
        <p className="mt-1 text-[0.97rem] leading-relaxed text-texto">{correccion.consejo}</p>
      </Ficha>
    </div>
  );
}

function Lista({
  titulo,
  lineas,
  tono,
}: {
  titulo: string;
  lineas: string[];
  tono: "visto" | "margen";
}) {
  return (
    <Ficha className="px-5 py-4">
      <h3 className={clsx("text-[0.85rem] font-semibold uppercase tracking-[0.08em]", tono === "visto" ? "text-visto" : "text-margen")}>
        {titulo}
      </h3>
      {lineas.length === 0 ? (
        <p className="mt-2 text-[0.9rem] text-apagado">Nada que señalar.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {lineas.map((linea) => (
            <li key={linea} className="text-[0.93rem] leading-relaxed text-texto">
              · {linea}
            </li>
          ))}
        </ul>
      )}
    </Ficha>
  );
}
