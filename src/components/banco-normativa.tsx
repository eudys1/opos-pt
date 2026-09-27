"use client";

import { useEffect, useMemo, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { TextoLargo } from "@/components/ui/texto-largo";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { bancoDeNormativa, documentoDeNormativa, normasQueFaltan, seccionesDelDocumento } from "@/nucleo/normas";

/**
 * Banco de normativa: todas las normas de tus temas en un solo documento,
 * cada una una vez y tal cual la tienes escrita. Se guarda en tu cuenta y lo
 * puedes editar a mano; al añadir temas nuevos, se suman las normas que falten
 * sin pisar lo que hayas cambiado.
 */

const CLAVE = "normativa";

export function BancoNormativa() {
  const { temas } = useCuaderno();
  const { usuario, cliente } = useSesion();
  const [guardado, setGuardado] = useState<string | null>(null);
  const [pedido, setPedido] = useState(false);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [errorCarga, setErrorCarga] = useState("");

  const entradas = useMemo(
    () => bancoDeNormativa(temas.filter((t) => t.texto).map((t) => ({ numero: t.numero, texto: t.texto }))),
    [temas],
  );
  const faltan = useMemo(
    () => (guardado ? normasQueFaltan(guardado, entradas) : []),
    [guardado, entradas],
  );

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    void (async () => {
      const { data, error: fallo } = await cliente
        .from("documentos")
        .select("contenido")
        .eq("clave", CLAVE)
        .maybeSingle();
      if (!vivo) return;
      // Si no se ha podido leer, NO es lo mismo que "no hay documento": no se
      // ofrece guardar la versión automática, que pisaría lo editado a mano.
      if (fallo) {
        setErrorCarga(fallo.message);
        setPedido(true);
        return;
      }
      setGuardado((data?.contenido as string | undefined) ?? null);
      setPedido(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, usuario]);

  async function guardar(contenido: string) {
    if (!cliente || !usuario) return;
    setGuardando(true);
    setError("");
    const { error: e } = await cliente.from("documentos").upsert(
      {
        usuario_id: usuario.id,
        clave: CLAVE,
        contenido,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "usuario_id,clave" },
    );
    setGuardando(false);
    if (e) {
      setError(e.message);
      return;
    }
    setGuardado(contenido);
    setEditando(false);
  }

  function descargar(contenido: string) {
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "banco-de-normativa.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!pedido) return <p className="text-apagado">Abriendo tu banco de normativa…</p>;
  if (errorCarga) {
    return (
      <Ficha className="flex flex-col gap-2 px-6 py-5">
        <h2 className="text-xl">Banco de normativa</h2>
        <p role="alert" className="text-[0.92rem] text-margen">
          No se ha podido abrir tu banco de normativa ({errorCarga}). Recarga la página; hasta
          entonces no se puede editar, para no guardar encima de lo que tengas.
        </p>
      </Ficha>
    );
  }

  const propuesto = documentoDeNormativa(entradas);
  const texto = guardado ?? propuesto;

  return (
    <Ficha className="flex flex-col gap-4 px-6 py-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h2 className="text-xl">Banco de normativa</h2>
          <p className="mt-1 max-w-[62ch] text-[0.9rem] leading-relaxed text-texto">
            {entradas.length === 0
              ? "Cuando subas temas que citen leyes, decretos u órdenes, aparecerán aquí."
              : `${entradas.length} normas sacadas de tus temas, cada una una sola vez y tal cual la tienes escrita. Puedes editarlo a mano.`}
          </p>
        </div>
        {!editando && entradas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Boton tono="secundario" onClick={() => descargar(texto)}>
              Descargar
            </Boton>
            <Boton
              onClick={() => {
                setBorrador(texto);
                setEditando(true);
              }}
            >
              Editar
            </Boton>
          </div>
        ) : null}
      </div>

      {guardado === null && entradas.length > 0 && !editando ? (
        <div className="flex flex-wrap items-center gap-3 rounded-pliegue bg-acento-fondo px-4 py-3">
          <p className="flex-1 text-[0.9rem] text-tinta">
            Esto es lo que sale de tus temas. Guárdalo para tenerlo en tu cuenta y poder retocarlo.
          </p>
          <Boton onClick={() => void guardar(propuesto)} disabled={guardando}>
            Guardarlo
          </Boton>
        </div>
      ) : null}

      {faltan.length > 0 && !editando ? (
        <div className="flex flex-wrap items-center gap-3 rounded-pliegue bg-sec-temario-fondo px-4 py-3">
          <p className="flex-1 text-[0.9rem] text-tinta">
            Hay {faltan.length} {faltan.length === 1 ? "norma nueva" : "normas nuevas"} en tus temas
            que no están en tu banco: {faltan.map((f) => f.nombre).join(", ")}.
          </p>
          <Boton
            tono="secundario"
            onClick={() =>
              void guardar(
                `${guardado!.trimEnd()}\n\nAÑADIDAS DESDE MIS TEMAS\n${faltan
                  .map((f) => `- ${f.cita}  [tema${f.temas.length > 1 ? "s" : ""} ${f.temas.join(", ")}]`)
                  .join("\n")}\n`,
              )
            }
            disabled={guardando}
          >
            Añadirlas
          </Boton>
        </div>
      ) : null}

      {editando ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="banco-normativa" className="sr-only">
            Banco de normativa
          </label>
          <TextoLargo
            id="banco-normativa"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            spellCheck
            className="font-sans text-[0.95rem]"
          />
          <div className="sticky bottom-3 flex flex-wrap gap-2 rounded-pliegue border border-linea bg-papel-alto/95 p-2 shadow-flota backdrop-blur">
            <Boton onClick={() => void guardar(borrador)} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
            <Boton tono="secundario" onClick={() => setEditando(false)} disabled={guardando}>
              Cancelar edición
            </Boton>
          </div>
        </div>
      ) : entradas.length > 0 || guardado ? (
        <DocumentoPlegado texto={texto} />
      ) : null}

      {error ? (
        <p role="alert" className="text-[0.9rem] text-margen">
          {error}
        </p>
      ) : null}
    </Ficha>
  );
}

/**
 * El documento, por grupos plegables y con buscador. Con veinte normas cabe
 * en una pantalla; con doscientas, no: plegado se ve el índice de grupos con
 * cuántas hay en cada uno, y buscando "tema 3" o "147/2002" salen solo las
 * líneas que lo tienen, con su grupo abierto.
 */
function DocumentoPlegado({ texto }: { texto: string }) {
  const [buscar, setBuscar] = useState("");
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const secciones = useMemo(() => seccionesDelDocumento(texto), [texto]);

  const aguja = buscar.trim().toLowerCase();
  const coincide = (linea: string) => !aguja || linea.toLowerCase().includes(aguja);
  const visibles = secciones
    .map((s) => ({ ...s, lineas: s.titulo ? s.lineas.filter(coincide) : s.lineas }))
    .filter((s) => !s.titulo || !aguja || s.lineas.length > 0 || s.titulo.toLowerCase().includes(aguja));
  const conTitulo = secciones.filter((s) => s.titulo);
  const todasAbiertas = conTitulo.every((s) => abiertas.has(s.titulo));
  const encontradas = visibles.reduce((n, s) => n + (s.titulo ? s.lineas.length : 0), 0);

  function alternar(titulo: string, abrir: boolean) {
    setAbiertas((previas) => {
      const nuevas = new Set(previas);
      if (abrir) nuevas.add(titulo);
      else nuevas.delete(titulo);
      return nuevas;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <label htmlFor="buscar-norma" className="text-[0.85rem] font-bold text-tinta">
            Buscar en tu banco
          </label>
          <input
            id="buscar-norma"
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Una ley, un número (17/2007) o «tema 3»"
            className="min-h-11 rounded-full border-2 border-linea bg-papel-alto px-4 text-[0.92rem]"
          />
        </div>
        {!aguja && conTitulo.length > 1 ? (
          <Boton
            tono="secundario"
            onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(conTitulo.map((s) => s.titulo)))}
          >
            {todasAbiertas ? "Plegar todo" : "Abrir todo"}
          </Boton>
        ) : null}
      </div>
      {aguja ? (
        <p className="text-[0.85rem] text-apagado" aria-live="polite" data-numerico>
          {encontradas === 0
            ? "Nada con eso. Prueba solo con el número, por ejemplo 147/2002."
            : `${encontradas} ${encontradas === 1 ? "línea" : "líneas"} con «${buscar.trim()}».`}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {visibles.map((s) =>
          s.titulo ? (
            <details
              key={s.titulo}
              open={Boolean(aguja) || abiertas.has(s.titulo)}
              onToggle={(e) => {
                if (!aguja) alternar(s.titulo, e.currentTarget.open);
              }}
              className="acordeon group rounded-[14px] border-2 border-linea bg-papel open:border-sec-normativa-vivo"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2">
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[4px] bg-sec-normativa-vivo" />
                <span className="flex-1 font-display text-[1rem] font-semibold normal-case text-tinta first-letter:uppercase">
                  {s.titulo.charAt(0) + s.titulo.slice(1).toLowerCase()}
                </span>
                <span className="text-[0.8rem] font-bold text-apagado" data-numerico>
                  {s.lineas.length}
                </span>
                <span aria-hidden="true" className="text-sec-normativa transition-transform duration-200 group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <ul className="flex flex-col gap-2 border-t-2 border-linea-suave px-4 pb-4 pt-3">
                {s.lineas.map((l, i) => (
                  <li key={i} className="text-[0.93rem] leading-[1.7] text-tinta">
                    {l.replace(/^-\s*/, "")}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p key="entradilla" className="text-[0.85rem] text-apagado">
              {s.lineas.filter((l) => l !== "BANCO DE NORMATIVA").join(" ")}
            </p>
          ),
        )}
      </div>
    </div>
  );
}
