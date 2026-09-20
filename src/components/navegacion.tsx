"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useState } from "react";
import { Marca } from "@/components/marcas";
import { useCuaderno } from "@/datos/almacen";
import { diasParaExamen } from "@/nucleo/racha";
import { fechaLarga } from "@/nucleo/fechas";

const secciones = [
  { href: "/temario", texto: "Mi temario" },
  { href: "/registro", texto: "Registro de estudio" },
  { href: "/planificador", texto: "Planificador" },
  { href: "/progreso", texto: "Mi progreso" },
];

const proximamente = [
  { href: "/practicar", texto: "Practicar" },
  { href: "/fallos", texto: "Repaso de fallos" },
  { href: "/supuestos", texto: "Supuestos" },
  { href: "/simulacros", texto: "Simulacros" },
];

export function Navegacion() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {/* Barra superior solo en móvil: la lateral se despliega desde aquí. */}
      <div className="flex items-center gap-3 border-b border-linea bg-papel-franja px-5 py-3 lg:hidden">
        <Link href="/">
          <Marca className="text-xl" />
        </Link>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="menu-lateral"
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-pliegue border border-linea bg-papel-alto px-4 text-[0.95rem]"
        >
          {abierto ? "Cerrar" : "Secciones"}
        </button>
      </div>

      <aside
        id="menu-lateral"
        className={clsx(
          "border-linea bg-papel-franja lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r",
          abierto ? "flex flex-col border-b" : "hidden",
        )}
      >
        <div className="hidden px-6 py-6 lg:block">
          <Link href="/">
            <Marca />
          </Link>
        </div>

        <nav aria-label="Secciones" className="flex flex-col gap-1 px-3 pb-4 lg:px-3">
          {secciones.map((s) => (
            <Enlace key={s.href} href={s.href} texto={s.texto} onNavegar={() => setAbierto(false)} />
          ))}

          <p className="px-3 pb-1 pt-5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-tenue">
            En construcción
          </p>
          {proximamente.map((s) => (
            <Enlace
              key={s.href}
              href={s.href}
              texto={s.texto}
              proximamente
              onNavegar={() => setAbierto(false)}
            />
          ))}
        </nav>

        <CuentaAtras />
      </aside>
    </>
  );
}

function Enlace({
  href,
  texto,
  proximamente,
  onNavegar,
}: {
  href: string;
  texto: string;
  proximamente?: boolean;
  onNavegar: () => void;
}) {
  const ruta = usePathname();
  const activo = ruta === href;

  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      onClick={onNavegar}
      className={clsx(
        "flex min-h-11 items-center justify-between rounded-pliegue px-3 py-2 text-[0.95rem] transition-colors",
        activo
          ? "border border-linea bg-papel-alto font-semibold text-tinta"
          : "border border-transparent text-texto hover:bg-papel-alto",
      )}
    >
      {texto}
      {proximamente ? <span className="text-[0.7rem] text-tenue">pronto</span> : null}
    </Link>
  );
}

function CuentaAtras() {
  const { perfil, guardarPerfil } = useCuaderno();
  const dias = diasParaExamen(perfil.fechaExamen);

  return (
    <div className="mt-auto border-t border-linea px-6 py-5">
      <p className="text-[0.8rem] text-apagado">Examen estimado</p>
      {dias === null ? (
        <>
          <p className="mt-1 text-[0.95rem] leading-snug text-texto">
            Sin fecha todavía. En Andalucía las plazas de Maestros se aplazaron a 2027.
          </p>
          <label htmlFor="fecha-examen" className="mt-3 block text-[0.8rem] text-apagado">
            Poner una fecha estimada
          </label>
          <input
            id="fecha-examen"
            type="date"
            className="mt-1 w-full rounded-pliegue border border-linea bg-papel-alto px-3 py-2 text-[0.9rem]"
            onChange={(e) => guardarPerfil({ fechaExamen: e.target.value || undefined })}
          />
        </>
      ) : (
        <>
          <p className="font-display text-[1.7rem] leading-tight" data-numerico>
            {dias} días
          </p>
          <p className="text-[0.8rem] text-apagado">{fechaLarga(perfil.fechaExamen!)}</p>
          <button
            type="button"
            onClick={() => guardarPerfil({ fechaExamen: undefined })}
            className="regla mt-2 text-[0.8rem] text-texto"
          >
            Cambiar la fecha
          </button>
        </>
      )}
    </div>
  );
}
