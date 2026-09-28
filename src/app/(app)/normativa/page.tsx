"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { useRecordado } from "@/datos/cache";
import { detectarNormas } from "@/nucleo/normas";
import { BancoNormativa } from "@/components/banco-normativa";
import { BarraProgreso } from "@/components/ui/barra-progreso";
import { fechaLarga } from "@/nucleo/fechas";

type Hallazgo = {
  nombre: string;
  estado: "vigente" | "modificada" | "derogada" | "no_encontrada";
  resumen: string;
  enlace: string;
  temas: number[];
};

type NormaGuardada = {
  nombre: string;
  temas: number[];
  estado: string;
  resumen: string | null;
  enlace: string | null;
  comprobada_en: string | null;
};

const ESTADOS: Record<Hallazgo["estado"], { texto: string; tono: "neutra" | "hecha" | "aviso" }> = {
  vigente: { texto: "vigente", tono: "hecha" },
  modificada: { texto: "modificada", tono: "aviso" },
  derogada: { texto: "derogada", tono: "aviso" },
  no_encontrada: { texto: "sin confirmar", tono: "neutra" },
};

export default function PaginaNormativa() {
  const { temas } = useCuaderno();
  const { usuario, cliente } = useSesion();

  const [hallazgos, setHallazgos] = useState<Hallazgo[] | null>(null);
  const [comprobando, setComprobando] = useState(false);
  const [error, setError] = useState("");

  // Detectadas en local: no hace falta la nube para saber qué leyes citas.
  const detectadas = detectarNormas(
    temas.filter((t) => t.texto).map((t) => ({ numero: t.numero, texto: t.texto })),
  );

  // Recordado entre visitas (src/datos/cache.ts); tras comprobar se vuelve a pedir.
  const { datos: leidas, recargar } = useRecordado<NormaGuardada[]>(
    cliente && usuario ? `normas:${usuario.id}` : null,
    async () => {
      const { data, error: e } = await cliente!
        .from("normas")
        .select("nombre, temas, estado, resumen, enlace, comprobada_en")
        .order("comprobada_en", { ascending: false });
      if (e) throw new Error(e.message);
      return (data ?? []) as NormaGuardada[];
    },
  );
  const guardadas = leidas ?? [];

  async function comprobar() {
    if (detectadas.length === 0) {
      setError("Tus temas todavía no citan ninguna norma. Sube algún tema con normativa y vuelve a intentarlo.");
      return;
    }
    setComprobando(true);
    setError("");
    try {
      const respuesta = await fetch("/api/comprobar-normativa", { method: "POST" });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se ha podido comprobar.");
      setHallazgos(datos.hallazgos);
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido comprobar.");
    } finally {
      setComprobando(false);
    }
  }

  const aMostrar: Hallazgo[] =
    hallazgos ??
    guardadas.map((n) => ({
      nombre: n.nombre,
      estado: (n.estado as Hallazgo["estado"]) ?? "no_encontrada",
      resumen: n.resumen ?? "",
      enlace: n.enlace ?? "",
      temas: n.temas ?? [],
    }));

  const cambiadas = aMostrar.filter((h) => h.estado === "modificada" || h.estado === "derogada");
  const vigentes = aMostrar.filter((h) => h.estado === "vigente");
  const sinConfirmar = aMostrar.filter(
    (h) => h.estado !== "vigente" && h.estado !== "modificada" && h.estado !== "derogada",
  );

  const ultimaComprobacion = guardadas.find((n) => n.comprobada_en)?.comprobada_en;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-[2.1rem]">Normativa</h1>
        <p className="mt-1 max-w-[62ch] text-[0.98rem] leading-relaxed text-texto">
          Las leyes que citas en tus temas, reunidas en un solo documento, y si siguen vigentes.
          Se comprueba cuando tú lo pides: no hay nada mirando el BOE por su cuenta.
        </p>
      </header>

      <BancoNormativa />

      <h2 className="mt-2 text-xl">¿Siguen vigentes?</h2>

      <Ficha className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex-1">
          <p className="text-[0.95rem] text-tinta">
            <strong className="font-semibold" data-numerico>
              {detectadas.length}
            </strong>{" "}
            normas detectadas en tus temas.
          </p>
          {ultimaComprobacion ? (
            <p className="text-[0.85rem] text-apagado">
              Última comprobación: {fechaLarga(ultimaComprobacion.slice(0, 10))}
            </p>
          ) : (
            <p className="text-[0.85rem] text-apagado">Todavía no has comprobado ninguna.</p>
          )}
        </div>
        {usuario ? (
          <Boton onClick={() => void comprobar()} disabled={comprobando}>
            {comprobando ? "Buscando en el BOE…" : "Comprobar normativa"}
          </Boton>
        ) : (
          <Link href="/entrar" className="regla text-[0.95rem] font-semibold text-tinta">
            Entrar para comprobar
          </Link>
        )}
      </Ficha>

      {comprobando ? (
        <BarraProgreso
          pasos={["buscando cada norma en fuentes oficiales"]}
          actual={0}
          aviso="Suele tardar un par de minutos. Puedes ir a otra sección y volver."
        />
      ) : null}

      {error ? (
        <p role="alert" className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-2 text-[0.92rem]">
          {error}
        </p>
      ) : null}

      {aMostrar.length > 0 ? (
        <div className="flex flex-col gap-3">
          {/* Lo que ha cambiado, siempre a la vista: es lo único que pide hacer algo. */}
          {cambiadas.length > 0 ? (
            <ListaHallazgos hallazgos={cambiadas} />
          ) : (
            <p className="rounded-[14px] border-2 border-visto-vivo bg-visto-fondo px-4 py-3 text-[0.92rem] text-tinta">
              Ninguna de tus normas aparece como modificada o derogada.
            </p>
          )}
          {[
            { titulo: "Vigentes", lista: vigentes },
            { titulo: "Sin confirmar", lista: sinConfirmar },
          ]
            .filter((g) => g.lista.length > 0)
            .map((g) => (
              <details
                key={g.titulo}
                className="acordeon group rounded-[14px] border-2 border-linea bg-papel-alto open:border-sec-normativa-vivo"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2">
                  <span className="flex-1 font-display text-[1rem] font-semibold">{g.titulo}</span>
                  <span className="text-[0.8rem] font-bold text-apagado" data-numerico>
                    {g.lista.length}
                  </span>
                  <span aria-hidden="true" className="transition-transform duration-200 group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="border-t-2 border-linea-suave px-3 pb-3 pt-3">
                  <ListaHallazgos hallazgos={g.lista} />
                </div>
              </details>
            ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {detectadas.slice(0, 20).map((norma) => (
            <li key={norma.nombre} className="flex flex-wrap items-baseline gap-2 text-[0.93rem]">
              <span className="text-tinta">{norma.nombre}</span>
              <span className="text-apagado">
                · {norma.temas.length === 1 ? "tema" : "temas"} {norma.temas.join(", ")}
              </span>
            </li>
          ))}
          {detectadas.length > 20 ? (
            <li className="text-[0.88rem] text-apagado" data-numerico>
              y {detectadas.length - 20} más: están todas en tu banco de normativa, arriba.
            </li>
          ) : null}
        </ul>
      )}

      <p className="text-[0.85rem] leading-relaxed text-apagado">
        La comprobación consulta fuentes oficiales, pero no sustituye a mirar el BOE: si algo es
        importante para tu tema, confírmalo con el enlace antes de reescribirlo.
      </p>
    </div>
  );
}

function ListaHallazgos({ hallazgos }: { hallazgos: Hallazgo[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {hallazgos.map((hallazgo) => {
        const estado = ESTADOS[hallazgo.estado] ?? ESTADOS.no_encontrada;
        return (
          <li key={hallazgo.nombre}>
            <Ficha
              className={clsx(
                "flex flex-col gap-2 px-5 py-4",
                (hallazgo.estado === "modificada" || hallazgo.estado === "derogada") && "border-margen-hilo",
              )}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="flex-1 font-display text-[1.05rem]">{hallazgo.nombre}</h3>
                <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
              </div>
              {hallazgo.resumen ? (
                <p className="text-[0.93rem] leading-relaxed text-texto">{hallazgo.resumen}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 text-[0.83rem] text-apagado">
                {hallazgo.temas.length > 0 ? (
                  <span>
                    {hallazgo.temas.length === 1 ? "Tema" : "Temas"} {hallazgo.temas.join(", ")}
                  </span>
                ) : null}
                {hallazgo.enlace ? (
                  <a href={hallazgo.enlace} target="_blank" rel="noreferrer" className="regla text-texto">
                    Ver la norma ↗
                  </a>
                ) : null}
              </div>
            </Ficha>
          </li>
        );
      })}
    </ul>
  );
}
