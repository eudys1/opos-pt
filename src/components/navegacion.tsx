"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Marca } from "@/components/marcas";
import { SelectorTema } from "@/components/selector-tema";
import { SECCIONES_APP, type ClaveSeccion } from "@/components/ui/secciones";
import { useCuaderno, temasConContenido } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { diasParaExamen } from "@/nucleo/racha";
import { repasosDelDia } from "@/nucleo/repasos";
import { reprogramadosPorTema } from "@/nucleo/agenda";
import { hoyISO } from "@/nucleo/fechas";

/**
 * Navegación lateral, como la de la dirección B: cada sección con su
 * cuadradito de color (el mismo que tiene en el planificador y en el resto de
 * la app), un contador a la derecha cuando hay algo pendiente y la cuenta
 * atrás del examen abajo.
 *
 * Fija: no se mueve al hacer scroll y cabe entera en la pantalla. El cambio
 * de claro a oscuro va arriba del todo, junto al nombre.
 */

type Enlace = { seccion: ClaveSeccion; contador?: string; alerta?: boolean };

export function Navegacion() {
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);
  const enlaces = useEnlaces();

  return (
    <>
      {/* Barra superior en móvil. */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b-[3px] border-borde bg-papel-alto px-4 py-2.5 lg:hidden">
        <Link href="/inicio" onClick={cerrar} className="mr-auto">
          <Marca className="text-[1.3rem]" />
        </Link>
        <SelectorTema />
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="menu-lateral"
          className="inline-flex min-h-11 items-center rounded-full border-2 border-borde bg-papel-alto px-4 text-[0.9rem] font-extrabold"
        >
          {abierto ? "Cerrar" : "Menú"}
        </button>
      </div>

      <aside
        id="menu-lateral"
        className={clsx(
          "bg-papel-alto",
          "lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r-[3px] lg:border-borde",
          abierto ? "flex flex-col border-b-[3px] border-borde" : "hidden",
        )}
      >
        <div className="hidden items-center justify-between gap-2 px-4 pb-3 pt-5 lg:flex">
          <Link href="/inicio" className="rounded-pliegue">
            <Marca />
          </Link>
          <SelectorTema />
        </div>

        <nav aria-label="Secciones" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {enlaces.map((e, i) => (
            <EnlaceNav key={e.seccion} {...e} orden={i} onNavegar={cerrar} />
          ))}
        </nav>

        <PieCuenta onNavegar={cerrar} />
      </aside>
    </>
  );
}

function useEnlaces(): Enlace[] {
  const { temas, eventos, objetivos, perfil, cargado } = useCuaderno();
  const { usuario, cliente } = useSesion();
  const [fallosHoy, setFallosHoy] = useState(0);
  const hoy = hoyISO();

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    cliente
      .from("fallos")
      .select("item_id", { count: "exact", head: true })
      .is("resuelto_en", null)
      .lte("proxima_fecha", hoy)
      .then(({ count }) => {
        if (vivo) setFallosHoy(count ?? 0);
      });
    return () => {
      vivo = false;
    };
  }, [cliente, usuario, hoy]);

  const repasosHoy = useMemo(
    () =>
      cargado
        ? repasosDelDia(
            eventos,
            temas.map((t) => t.id),
            {
              intervalos: perfil.intervalosRepaso,
              hoy,
              reprogramados: reprogramadosPorTema(objetivos),
            },
          ).length
        : 0,
    [cargado, eventos, temas, objetivos, perfil.intervalosRepaso, hoy],
  );

  const conContenido = temasConContenido(temas).length;

  return [
    { seccion: "examen" },
    { seccion: "temario", contador: cargado ? `${conContenido}/${temas.length}` : undefined },
    { seccion: "registro", contador: repasosHoy ? String(repasosHoy) : undefined, alerta: repasosHoy > 0 },
    { seccion: "planificador" },
    { seccion: "practicar" },
    { seccion: "fallos", contador: fallosHoy ? String(fallosHoy) : undefined, alerta: fallosHoy > 0 },
    { seccion: "supuestos" },
    { seccion: "simulacros" },
    { seccion: "progreso" },
    { seccion: "normativa" },
  ];
}

function EnlaceNav({
  seccion,
  contador,
  alerta,
  orden,
  onNavegar,
}: Enlace & { orden: number; onNavegar: () => void }) {
  const s = SECCIONES_APP[seccion];
  const ruta = usePathname();
  const activo = ruta === s.href || ruta.startsWith(`${s.href}/`);

  return (
    <Link
      href={s.href}
      aria-current={activo ? "page" : undefined}
      onClick={onNavegar}
      style={{ animationDelay: `${orden * 35}ms` }}
      className={clsx(
        "entra group flex min-h-11 items-center gap-2.5 rounded-pliegue border-2 px-2.5 py-1.5 text-[0.93rem] font-extrabold transition-colors",
        activo
          ? clsx(s.bordeVivo, s.fondo, s.texto)
          : "border-transparent text-apagado hover:bg-papel-franja hover:text-tinta",
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "h-5 w-5 shrink-0 rounded-[7px] transition-transform duration-200 group-hover:rotate-[-8deg] group-hover:scale-110",
          s.lleno,
        )}
      />
      <span className="flex-1">{s.nombre}</span>
      {contador ? (
        <span
          className={clsx("text-[0.78rem] font-extrabold", alerta ? "text-margen" : "text-tenue")}
          data-numerico
        >
          {contador}
          {alerta ? <span className="sr-only"> pendientes</span> : null}
        </span>
      ) : null}
    </Link>
  );
}

/** Abajo, siempre visible: la cuenta atrás (como en B) y la cuenta, con salir a un clic. */
function PieCuenta({ onNavegar }: { onNavegar: () => void }) {
  const { perfil } = useCuaderno();
  const { usuario, estadoNube, salir } = useSesion();
  const dias = diasParaExamen(perfil.fechaExamen);

  return (
    <div className="flex flex-col gap-2 px-3 pb-4 pt-2">
      <Link
        href="/cuenta"
        onClick={onNavegar}
        className="rounded-[16px] border-2 border-acento-vivo bg-acento-fondo px-3 py-2.5 text-center hover:brightness-[0.98]"
      >
        {dias !== null ? (
          <>
            <span className="block font-display text-[1.7rem] font-bold leading-none text-acento" data-numerico>
              {dias}
            </span>
            <span className="text-[0.75rem] font-bold text-acento">días para el examen</span>
          </>
        ) : (
          <span className="text-[0.8rem] font-bold text-acento">Pon la fecha del examen →</span>
        )}
      </Link>

      <div className="flex items-center gap-1">
        <Link
          href="/cuenta"
          onClick={onNavegar}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-pliegue px-2 hover:bg-papel-franja"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-borde bg-sec-temario-fondo text-[0.8rem] font-extrabold text-sec-temario"
          >
            {(usuario?.email ?? "?").charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[0.86rem] font-extrabold text-tinta">Mi cuenta</span>
            <span className="truncate text-[0.72rem] text-apagado">
              {estadoNube === "sincronizando"
                ? "Guardando…"
                : estadoNube === "error"
                  ? "No se ha podido guardar"
                  : "Todo guardado"}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void salir()}
          className="min-h-11 rounded-full px-3 text-[0.85rem] font-bold text-apagado hover:bg-papel-franja hover:text-tinta"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
