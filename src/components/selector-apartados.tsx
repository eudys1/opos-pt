"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Casilla } from "@/components/ui/campos";
import { useCuaderno } from "@/datos/almacen";
import { apartadosDelTema, nombreDeApartado, type Apartado } from "@/nucleo/estructura";

/**
 * Elegir apartados de un tema: el mismo en Practicar, Fallos, al marcar un
 * repaso y en los objetivos del planificador.
 *
 * Cerrado ocupa una línea ("Todo el tema", "1.1 y 2.3", "4 apartados"). Al
 * pulsarlo se abre en su propia ventana (en el móvil, una hoja desde abajo),
 * nunca en un desplegable: la lista es larga y con títulos largos, y colgando
 * de un botón se salía de la pantalla.
 *
 * Dentro, solo los apartados principales, cada uno con ▸ para ver sus
 * subapartados: unas pocas filas en vez de veinte. Los títulos van en una
 * línea, cortados con «…», con el título entero al pasar por encima. Marcar un
 * apartado incluye sus subapartados. Sin nada marcado es el tema entero.
 */
export function SelectorApartados({
  temaId,
  valor,
  onCambio,
  etiqueta = "Apartados",
  ayuda,
  /** Cuántas preguntas tiene cada apartado, para enseñarlo en la lista (Practicar, Fallos). */
  cuantas,
  /** Solo el botón, sin etiqueta visible: para meterlo en una fila. */
  compacto,
}: {
  temaId: string;
  valor: string[];
  onCambio: (ids: string[]) => void;
  etiqueta?: string;
  ayuda?: string;
  cuantas?: Record<string, number>;
  compacto?: boolean;
}) {
  const { temas } = useCuaderno();
  const tema = temas.find((t) => t.id === temaId);
  const texto = tema?.texto ?? "";
  const apartados = useMemo(() => apartadosDelTema(texto), [texto]);
  const [abierto, setAbierto] = useState(false);

  if (!tema) return null;
  if (!texto.trim() || apartados.length === 0) {
    if (compacto) return null;
    return (
      <p className="text-[0.84rem] text-apagado">
        {texto.trim()
          ? "Este tema no tiene apartados reconocibles (numerados o en mayúsculas): cuenta entero."
          : "Sube el texto del tema para poder elegir apartados."}
      </p>
    );
  }

  const resumen =
    valor.length === 0
      ? "Todo el tema"
      : valor.length <= 2
        ? valor.map((id) => apartados.find((a) => a.id === id)?.numero ?? nombreDeApartado(apartados, id)).join(" y ")
        : `${valor.length} apartados`;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {compacto ? null : <span className="text-[0.9rem] font-extrabold text-tinta">{etiqueta}</span>}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={compacto ? `${etiqueta} del tema ${tema.numero}: ${resumen}. Cambiar` : undefined}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-pliegue border-2 border-campo bg-papel-alto px-4 text-left text-[0.97rem] text-tinta hover:border-campo-foco"
      >
        <span className={clsx("min-w-0 flex-1 truncate", valor.length === 0 && "text-apagado")}>{resumen}</span>
        <span aria-hidden="true" className="text-[0.85rem] font-extrabold text-apagado">
          Cambiar
        </span>
      </button>

      <Dialogo
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo={`${etiqueta} · tema ${tema.numero}`}
        subtitulo={ayuda ?? "Marcar un apartado incluye sus subapartados. Nada marcado es el tema entero."}
      >
        <ListaApartados apartados={apartados} valor={valor} onCambio={onCambio} cuantas={cuantas} />
        <div className="sticky bottom-0 -mx-6 -mb-5 flex items-center gap-2 border-t-2 border-linea-suave bg-papel-alto px-6 py-3">
          <span className="min-w-0 flex-1 truncate text-[0.85rem] text-apagado">
            {valor.length === 0 ? "Todo el tema" : `${valor.length} elegidos`}
          </span>
          {valor.length > 0 ? (
            <Boton tono="fantasma" onClick={() => onCambio([])}>
              Todo el tema
            </Boton>
          ) : null}
          <Boton onClick={() => setAbierto(false)}>Listo</Boton>
        </div>
      </Dialogo>
    </div>
  );
}

/** Los apartados principales, plegados; cada uno despliega sus subapartados. */
function ListaApartados({
  apartados,
  valor,
  onCambio,
  cuantas,
}: {
  apartados: Apartado[];
  valor: string[];
  onCambio: (ids: string[]) => void;
  cuantas?: Record<string, number>;
}) {
  // Un grupo por apartado principal, con sus subapartados debajo.
  const grupos: { padre: Apartado; hijos: Apartado[] }[] = [];
  for (const a of apartados) {
    if (a.nivel === 1 || grupos.length === 0) grupos.push({ padre: a, hijos: [] });
    else grupos[grupos.length - 1].hijos.push(a);
  }
  // Abiertos de entrada: los que tienen algún subapartado marcado.
  const [abiertos, setAbiertos] = useState<Set<string>>(
    () => new Set(grupos.filter((g) => g.hijos.some((h) => valor.includes(h.id))).map((g) => g.padre.id)),
  );

  const incluido = (a: Apartado) => valor.includes(a.id) || valor.some((id) => a.numero?.startsWith(`${id}.`));
  function alternar(a: Apartado, marcar: boolean) {
    const sinHijos = valor.filter((id) => !id.startsWith(`${a.id}.`));
    onCambio(marcar ? [...sinHijos, a.id] : sinHijos.filter((id) => id !== a.id));
  }

  const fila = (a: Apartado, sub: boolean) => {
    const porPadre = !valor.includes(a.id) && incluido(a);
    const nombre = `${a.numero ? `${a.numero} ` : ""}${aFrase(a.titulo)}`;
    return (
      <Casilla marcada={incluido(a)} onCambio={(v) => alternar(a, v)} deshabilitada={porPadre} className="min-w-0 flex-1">
        <span title={nombre} className={clsx("block truncate", sub ? "text-[0.92rem]" : "font-bold")}>
          {a.numero ? <span className="mr-1.5 tabular-nums text-apagado">{a.numero}</span> : null}
          {aFrase(a.titulo)}
        </span>
      </Casilla>
    );
  };

  return (
    <ul className="flex flex-col divide-y-2 divide-linea-suave">
      {grupos.map(({ padre, hijos }) => {
        const desplegado = abiertos.has(padre.id);
        const marcadosDentro = hijos.filter((h) => valor.includes(h.id)).length;
        return (
          <li key={padre.id} className="py-0.5">
            <div className="flex min-w-0 items-center gap-2">
              {fila(padre, false)}
              {cuantas ? <Cuenta n={cuantas[padre.id] ?? 0} /> : null}
              {hijos.length ? (
                <button
                  type="button"
                  onClick={() =>
                    setAbiertos((previos) => {
                      const siguientes = new Set(previos);
                      if (desplegado) siguientes.delete(padre.id);
                      else siguientes.add(padre.id);
                      return siguientes;
                    })
                  }
                  aria-expanded={desplegado}
                  title={desplegado ? "Ocultar subapartados" : `Ver sus ${hijos.length} subapartados`}
                  className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[0.95rem] text-apagado hover:bg-papel-franja hover:text-tinta"
                >
                  <span aria-hidden="true" className={clsx("transition-transform duration-200", desplegado && "rotate-90")}>
                    ▸
                  </span>
                  {/* Un punto si hay subapartados marcados dentro, aunque esté plegado. */}
                  {marcadosDentro ? (
                    <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-acento-vivo" />
                  ) : null}
                  <span className="sr-only">
                    {desplegado ? "Ocultar" : "Ver"} los subapartados de {padre.numero ?? padre.titulo}
                  </span>
                </button>
              ) : (
                <span aria-hidden="true" className="w-11 shrink-0" />
              )}
            </div>
            {desplegado && hijos.length ? (
              <ul className="entra mb-1 ml-7 flex flex-col">
                {hijos.map((h) => (
                  <li key={h.id} className="flex min-w-0 items-center gap-2">
                    {fila(h, true)}
                    {cuantas ? <Cuenta n={cuantas[h.id] ?? 0} /> : null}
                    {/* Hueco del ▸ de los principales, para que las cifras queden en columna. */}
                    <span aria-hidden="true" className="w-11 shrink-0" />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** "CONCEPTO Y ENFOQUE" → "Concepto y enfoque"; lo que ya viene en minúsculas, igual. */
export function aFrase(titulo: string): string {
  const letras = titulo.replace(/[^\p{L}]/gu, "");
  if (letras !== letras.toUpperCase()) return titulo;
  const minus = titulo.toLowerCase();
  return minus.charAt(0).toUpperCase() + minus.slice(1);
}

/** Cómo se lee una lista de apartados guardada, para etiquetas: "1.1, 2". */
export function resumenDeApartados(texto: string, ids: string[] | undefined): string {
  if (!ids?.length) return "";
  const apartados = apartadosDelTema(texto);
  return ids.map((id) => apartados.find((a) => a.id === id)?.numero ?? nombreDeApartado(apartados, id)).join(", ");
}

/** Cuántas preguntas o fallos tiene un apartado, en una pastilla que lo dice. */
function Cuenta({ n }: { n: number }) {
  return (
    <span
      title={`${n} en este apartado`}
      className={clsx(
        "shrink-0 rounded-full px-2 text-[0.75rem] font-extrabold tabular-nums",
        n ? "bg-papel-franja text-texto" : "text-tenue",
      )}
    >
      {n}
      <span className="sr-only"> en este apartado</span>
    </span>
  );
}
