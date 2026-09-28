"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Ficha } from "@/components/ui/ficha";
import { BotonEnlace } from "@/components/ui/boton";
import { SECCIONES_APP, type ClaveSeccion } from "@/components/ui/secciones";
import { useCuaderno, temasConContenido } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { useRecordado } from "@/datos/cache";
import { agenda } from "@/nucleo/agenda";
import { hoyISO } from "@/nucleo/fechas";
import { Cifra } from "@/components/ui/cifra";
import { calcularRacha } from "@/nucleo/racha";

/**
 * Mi examen: la entrada a la app, con la estructura del panel de la
 * dirección B.
 *
 *   1. Qué toca hoy, dicho en una frase, y la racha.
 *   2. La sesión de hoy: lo que hay, lo hecho y un botón para empezar.
 *   3. Las partes del examen, cada una con su color y su dato.
 *   4. El camino: los 25 temas, rellenos según vas avanzando.
 */

type Datos = {
  supuestos: number;
  conResolucion: number;
  preguntas: number;
  fallosHoy: number;
  fallosAbiertos: number;
  ultimaNota: number | null;
  normas: number;
};

export default function PaginaInicio() {
  const { temas, eventos, objetivos, perfil, cargado } = useCuaderno();
  const { usuario, cliente } = useSesion();
  const hoy = hoyISO();

  // Recordado entre visitas: al volver a Mi examen se pinta al instante con lo
  // de la última vez y se actualiza por detrás, sin saltos.
  const { datos, listo } = useRecordado<Datos>(
    cliente && usuario ? `inicio:${usuario.id}:${hoy}` : null,
    async () => {
      const [sup, items, fallosHoy, fallosAbiertos, sims, normas] = await Promise.all([
        cliente!.from("supuestos").select("id, solucion_de_academia"),
        cliente!.from("items").select("id", { count: "exact", head: true }).is("variante_de", null),
        cliente!
          .from("fallos")
          .select("item_id", { count: "exact", head: true })
          .is("resuelto_en", null)
          .lte("proxima_fecha", hoy),
        cliente!.from("fallos").select("item_id", { count: "exact", head: true }).is("resuelto_en", null),
        cliente!
          .from("simulacros")
          .select("nota")
          .eq("estado", "corregido")
          .order("creado_en", { ascending: false })
          .limit(1),
        cliente!.from("normas").select("id", { count: "exact", head: true }),
      ]);
      return {
        supuestos: sup.data?.length ?? 0,
        conResolucion: (sup.data ?? []).filter((s) => s.solucion_de_academia).length,
        preguntas: items.count ?? 0,
        fallosHoy: fallosHoy.count ?? 0,
        fallosAbiertos: fallosAbiertos.count ?? 0,
        ultimaNota: sims.data?.[0]?.nota != null ? Number(sims.data[0].nota) : null,
        normas: normas.count ?? 0,
      };
    },
  );

  const deHoy = useMemo(
    () =>
      agenda(hoy, hoy, {
        eventos,
        objetivos,
        temaIds: temas.map((t) => t.id),
        intervalos: perfil.intervalosRepaso,
        hoy,
      }).get(hoy) ?? [],
    [eventos, objetivos, temas, perfil.intervalosRepaso, hoy],
  );

  // La primera vez se espera a los datos de la cuenta antes de pintar: con
  // ellos a medias, el titular y las tarjetas cambiaban al llegar y todo saltaba.
  if (!cargado || !listo) return <p className="text-apagado">Abriendo el cuaderno…</p>;

  const pendientes = deHoy.filter((e) => e.estado !== "hecho");
  const hechos = deHoy.filter((e) => e.estado === "hecho");
  const repasos = pendientes.filter((e) => e.origen === "previsto").length;
  const fallosHoy = datos?.fallosHoy ?? 0;
  const racha = calcularRacha(eventos, { hoy, diasLibresAlMes: perfil.diasLibresAlMes });
  const estudiados = temas.filter((t) => t.estadoEstudio !== "por_estudiar").length;
  const conContenido = temasConContenido(temas).length;

  const titular =
    pendientes.length === 0 && fallosHoy === 0
      ? hechos.length > 0
        ? "Hoy lo tienes todo hecho"
        : "Hoy no toca nada: buen día para un tema nuevo"
      : repasos > 0
        ? `Hoy toca: ${repasos} ${repasos === 1 ? "repaso" : "repasos"}${fallosHoy ? ` y ${fallosHoy} ${fallosHoy === 1 ? "fallo" : "fallos"}` : ""}`
        : `Hoy toca: ${pendientes.length || fallosHoy} ${pendientes.length ? "objetivos" : "fallos"}`;

  // A dónde lleva «Empezar»: a lo primero pendiente.
  const primero = pendientes[0];
  const empezarEn = primero
    ? primero.origen === "previsto"
      ? "/registro"
      : "/planificador"
    : fallosHoy > 0
      ? "/fallos"
      : "/practicar";

  const totalSesion = deHoy.length + fallosHoy;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="entra flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-[1.9rem] leading-tight">{titular}</h1>
        {racha.dias > 0 ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-acento-vivo px-4 py-2 text-[0.88rem] font-extrabold text-sobre-boton shadow-boton">
            <span aria-hidden="true" className="h-4 w-4 rounded-full bg-sombra" />
            Racha {racha.dias}
          </span>
        ) : null}
      </header>

      {/* Sesión de hoy */}
      <Ficha destacada className="entra flex flex-wrap items-center gap-5 px-6 py-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.25rem]">Sesión de hoy</h2>
          <p className="mt-0.5 text-[0.9rem] text-apagado">
            {[
              repasos ? `${repasos} ${repasos === 1 ? "repaso" : "repasos"}` : null,
              fallosHoy ? `${fallosHoy} ${fallosHoy === 1 ? "fallo" : "fallos"}` : null,
              pendientes.length - repasos > 0 ? `${pendientes.length - repasos} objetivos` : null,
              hechos.length ? `${hechos.length} ${hechos.length === 1 ? "cosa hecha" : "cosas hechas"}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Nada pendiente"}
          </p>
          {totalSesion > 0 ? (
            <div className="mt-3 flex gap-1.5" aria-hidden="true">
              {Array.from({ length: Math.min(totalSesion, 14) }, (_, i) => (
                <span
                  key={i}
                  className={clsx(
                    "h-2.5 flex-1 rounded-full",
                    i < hechos.length ? "bg-visto-vivo" : "bg-linea-suave",
                  )}
                />
              ))}
            </div>
          ) : null}
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {pendientes.slice(0, 5).map((e) => {
              const tema = temas.find((t) => t.id === e.temaId);
              return (
                <li
                  key={e.clave}
                  className={clsx(
                    "rounded-full border-2 px-3 py-1 text-[0.8rem] font-extrabold",
                    e.estado === "atrasado"
                      ? "border-margen bg-margen-fondo text-margen"
                      : "border-transparent bg-sec-repaso-fondo text-sec-repaso",
                  )}
                >
                  {e.origen === "previsto" ? `Repaso ${e.indice} · tema ${tema?.numero ?? "?"}` : e.texto}
                  {e.estado === "atrasado" && e.diasDeRetraso ? ` · ${e.diasDeRetraso} d tarde` : ""}
                </li>
              );
            })}
          </ul>
        </div>
        <BotonEnlace href={empezarEn} tamano="grande">
          Empezar
        </BotonEnlace>
      </Ficha>

      {/* Las partes del examen, como los accesos de colores de B */}
      <section aria-labelledby="partes" className="flex flex-col gap-2">
        <h2 id="partes" className="sr-only">
          Las partes de tu examen
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Acceso
            href="/temario"
            titulo="El tema"
            pie={`Parte B · ${estudiados} de ${temas.length} estudiados`}
            dato={`${conContenido}`}
            unidad="subidos"
            seccion="temario"
          />
          <Acceso
            href="/supuestos"
            titulo="El supuesto"
            pie={`Parte A · ${datos?.conResolucion ?? 0} con resolución de la academia`}
            dato={datos ? `${datos.supuestos}` : "…"}
            unidad="en tu banco"
            seccion="supuestos"
          />
          <Acceso
            href="/simulacros"
            titulo="Simulacro"
            pie="Las dos partes, real o flexible"
            dato={datos?.ultimaNota != null ? datos.ultimaNota.toFixed(1) : "—"}
            unidad="última nota"
            seccion="simulacros"
          />
          <Acceso
            href="/practicar"
            titulo="Practicar"
            pie="Test, cortas, flashcards y leyes"
            dato={datos ? `${datos.preguntas}` : "…"}
            unidad="preguntas"
            seccion="practicar"
          />
          <Acceso
            href="/fallos"
            titulo="Fallos"
            pie="Vuelven preguntados de otra forma"
            dato={`${fallosHoy}`}
            unidad="por repasar hoy"
            seccion="fallos"
          />
          <Acceso
            href="/normativa"
            titulo="Legislación"
            pie="Tu banco de normativa"
            dato={datos ? `${datos.normas}` : "…"}
            unidad="normas"
            seccion="normativa"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        {/* El camino del temario */}
        <section
          aria-labelledby="camino"
          className="rounded-ficha border-2 border-borde bg-sec-temario-fondo px-5 py-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="camino" className="text-[1.1rem] text-sec-temario">
              Tu camino
            </h2>
            <Link href="/registro" className="regla text-[0.85rem] font-bold text-sec-temario">
              Ver el registro →
            </Link>
          </div>
          <ol className="mt-3 flex flex-wrap gap-2" aria-label="Estado de cada tema">
            {temas.map((t) => {
              const dominado = t.estadoEstudio === "dominado";
              const estudiado = t.estadoEstudio !== "por_estudiar";
              const subido = t.estadoContenido !== "sin_contenido";
              return (
                <li key={t.id}>
                  <Link
                    href={`/tema/${t.numero}`}
                    target="_blank"
                    className={clsx(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 text-[0.78rem] font-extrabold transition-transform hover:-translate-y-0.5",
                      dominado
                        ? "border-borde bg-visto-vivo text-sobre-boton"
                        : estudiado
                          ? "border-borde bg-sec-temario-vivo text-white"
                          : subido
                            ? "border-sec-temario-vivo bg-papel-alto text-sec-temario"
                            : "border-linea bg-papel-alto text-tenue",
                    )}
                    data-numerico
                  >
                    {t.numero}
                    <span className="sr-only">
                      :{" "}
                      {dominado ? "dominado" : estudiado ? "estudiado" : subido ? "subido, sin estudiar" : "sin subir"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[0.8rem] font-bold text-sec-temario">
            {estudiados} estudiados · {temas.filter((t) => t.estadoEstudio === "dominado").length} con la
            vuelta completa · pulsa uno para abrirlo
          </p>
        </section>

        <div className="flex flex-col gap-4">
          <Link
            href="/fallos"
            className="levanta rounded-ficha border-2 border-borde bg-sec-fallos-fondo px-5 py-4 shadow-ficha"
          >
            <p className="font-display text-[1.1rem] font-semibold text-sec-fallos">
              {datos?.fallosAbiertos ?? 0} fallos esperando
            </p>
            <p className="mt-0.5 text-[0.85rem] text-sec-fallos">
              {fallosHoy > 0
                ? `${fallosHoy} te tocan hoy. Con tres aciertos seguidos, salen de la cola.`
                : "Hoy no te toca ninguno. Puedes repasarlos igualmente."}
            </p>
          </Link>
          <div className="rounded-ficha border-2 border-dashed border-linea px-5 py-4">
            <p className="font-display text-[1.05rem] font-semibold text-tinta">Segunda prueba</p>
            <p className="mt-0.5 text-[0.85rem] text-apagado">
              Programación didáctica y defensa: todavía no está en la app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Acceso({
  href,
  titulo,
  pie,
  dato,
  unidad,
  seccion,
}: {
  href: string;
  titulo: string;
  pie: string;
  dato: string;
  unidad: string;
  seccion: ClaveSeccion;
}) {
  const { fondo, bordeVivo: borde, lleno: icono, texto } = SECCIONES_APP[seccion];
  return (
    <Link
      href={href}
      className={clsx(
        "levanta entra group flex items-center gap-3 rounded-[20px] border-2 px-4 py-3.5 shadow-[3px_3px_0_var(--color-sombra)]",
        fondo,
        borde,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "h-10 w-10 shrink-0 rounded-[12px] transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110",
          icono,
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[1rem] font-extrabold text-tinta">{titulo}</span>
        <span className="block truncate text-[0.8rem] text-apagado">{pie}</span>
      </span>
      <span className="text-right">
        <span className={clsx("block font-display text-[1.4rem] font-bold leading-none", texto)} data-numerico>
          <Cifra valor={dato} clave={`inicio:${href}`} />
        </span>
        <span className="text-[0.7rem] font-bold text-apagado">{unidad}</span>
      </span>
    </Link>
  );
}
