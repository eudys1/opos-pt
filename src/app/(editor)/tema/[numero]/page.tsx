"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { TextoLargo } from "@/components/ui/texto-largo";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { estructuraDelTema, indiceDelTema, type Bloque } from "@/nucleo/estructura";
import type { EstadoContenido } from "@/nucleo/tipos";
import { Opciones } from "@/components/ui/campos";

/**
 * Un tema a pantalla completa, en su propia pestaña.
 *
 * Dos modos: leer, con el tema maquetado (títulos, epígrafes y párrafos ya
 * unidos) y un índice lateral para saltar; y editar, con una caja que crece
 * con el texto y se baja con la página, sin scroll propio. Siempre se puede
 * cancelar la edición sin tocar nada.
 */
export default function PaginaTema({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = use(params);
  const { temas, guardarTexto, cargado } = useCuaderno();
  // Hasta estar al día con la cuenta, el texto de aquí puede ser viejo o estar
  // vacío: no se deja editar, para no guardar encima de algo más nuevo.
  const { alDia } = useSesion();
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);
  const tema = temas.find((t) => t.numero === Number(numero));

  const [modo, setModo] = useState<"leer" | "editar">("leer");
  const [borrador, setBorrador] = useState("");
  const [estado, setEstado] = useState<EstadoContenido>("parcial");
  const [aviso, setAviso] = useState("");

  const texto = tema?.texto ?? "";
  const cambiado = modo === "editar" && borrador !== texto;

  const bloques = useMemo(() => estructuraDelTema(texto), [texto]);
  const indice = useMemo(() => indiceDelTema(bloques), [bloques]);

  // Al llegar desde una cita (/tema/N#párrafo) el texto aún no estaba pintado
  // cuando el navegador buscó el ancla: se busca otra vez cuando ya está.
  const hayBloques = bloques.length > 0 && modo === "leer";
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!hayBloques || !id) return;
    const destino = document.getElementById(id);
    if (!destino) return;
    destino.scrollIntoView({ block: "center" });
    destino.classList.add("destacado");
  }, [hayBloques]);

  // Salir con cambios sin guardar pide confirmación del navegador.
  useEffect(() => {
    if (!cambiado) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [cambiado]);

  if (!cargado) return <p className="p-8 text-apagado">Abriendo el tema…</p>;
  if (!tema) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <p className="text-texto">No existe el tema {numero}.</p>
        <Link href="/temario" className="regla text-tinta">
          ← Mi temario
        </Link>
      </div>
    );
  }

  const palabras = (modo === "editar" ? borrador : texto).trim().split(/\s+/).filter(Boolean).length;

  function empezarAEditar() {
    setBorrador(texto);
    setEstado(tema!.estadoContenido === "sin_contenido" ? "parcial" : tema!.estadoContenido);
    setAviso("");
    setModo("editar");
  }

  function guardar() {
    if (!borrador.trim() && texto.trim() && !confirmarVaciar) {
      setConfirmarVaciar(true);
      return;
    }
    setConfirmarVaciar(false);
    guardarTexto(tema!.id, borrador, borrador.trim() ? estado : "sin_contenido");
    setModo("leer");
    setAviso("Guardado en tu cuenta.");
  }

  return (
    <div className="min-h-screen">
      {/* Barra superior fija: salir, modo y guardar siempre a mano. */}
      <header className="sticky top-0 z-20 border-b border-linea bg-papel-alto/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3">
          <Link href="/temario" className="regla text-[0.9rem] text-texto">
            ← Mi temario
          </Link>
          <p className="flex-1 truncate font-display text-[1.1rem] font-bold text-tinta">
            Tema {tema.numero}
          </p>
          <span className="hidden text-[0.82rem] text-apagado sm:inline" data-numerico>
            {palabras} palabras
          </span>
          {modo === "leer" ? (
            <>
              <span aria-live="polite" className="text-[0.85rem] text-visto">
                {aviso}
              </span>
              <Boton onClick={empezarAEditar} disabled={!alDia}>
                {alDia ? "Editar" : "Cargando tu cuenta…"}
              </Boton>
            </>
          ) : (
            <>
              <span aria-live="polite" className="text-[0.82rem] text-aviso">
                {cambiado ? "Cambios sin guardar" : ""}
              </span>
              <Boton
                tono="secundario"
                onClick={() => {
                  setConfirmarVaciar(false);
                  setModo("leer");
                }}
              >
                Cancelar edición
              </Boton>
              <Boton onClick={guardar} disabled={!cambiado && estado === tema.estadoContenido}>
                {confirmarVaciar ? "Sí, dejarlo vacío" : "Guardar"}
              </Boton>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Índice lateral: solo leyendo, que es cuando se salta de epígrafe en epígrafe. */}
        <nav aria-label="Índice del tema" className="hidden lg:block">
          {modo === "leer" && indice.length > 0 ? (
            <div className="sticky top-20 flex max-h-[calc(100vh-7rem)] flex-col gap-1 overflow-y-auto pr-2">
              <p className="mb-1 text-[0.78rem] font-semibold text-tenue">Índice</p>
              {indice.map((b) => (
                <a
                  key={b.id}
                  href={`#${b.id}`}
                  className={clsx(
                    "rounded-[10px] px-2 py-1.5 text-[0.82rem] leading-snug hover:bg-papel-franja hover:text-tinta",
                    b.tipo === "subepigrafe" ? "pl-5 text-apagado" : "font-semibold text-texto",
                  )}
                >
                  {aTitulo(b.texto)}
                </a>
              ))}
            </div>
          ) : null}
        </nav>

        <main id="contenido" className="min-w-0">
          <p className="mb-6 max-w-[72ch] text-[0.9rem] leading-relaxed text-apagado">
            <span className="font-semibold text-texto">Enunciado oficial:</span> {tema.titulo}
          </p>

          {modo === "editar" ? (
            <div className="flex flex-col gap-4">
              {confirmarVaciar ? (
                <p role="alert" className="rounded-pliegue border-2 border-margen bg-margen-fondo px-4 py-3 font-bold text-margen">
                  Vas a dejar este tema sin texto. Pulsa «Sí, dejarlo vacío» para confirmarlo o
                  «Cancelar edición» para no tocar nada.
                </p>
              ) : null}
              <label htmlFor="texto-tema" className="sr-only">
                Texto del tema {tema.numero}
              </label>
              <TextoLargo
                id="texto-tema"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                spellCheck
                className="min-h-[60vh] max-w-[80ch] shadow-ficha"
              />
              <Opciones
                etiqueta="¿Está completo?"
                enFila
                valor={estado === "completo" ? "completo" : "parcial"}
                onCambio={(v) => setEstado(v as EstadoContenido)}
                opciones={[
                  { valor: "parcial", texto: "Parcial · falta una parte" },
                  { valor: "completo", texto: "Completo · el tema entero" },
                ]}
              />
            </div>
          ) : texto.trim() ? (
            <article className="max-w-[72ch]">
              {tema.estadoContenido === "borrador_ia" ? (
                <Etiqueta tono="borrador" className="mb-4">
                  borrador de IA, no son tus apuntes
                </Etiqueta>
              ) : null}
              {bloques.map((b) => (
                <BloqueTema key={b.id} bloque={b} />
              ))}
            </article>
          ) : (
            <div className="flex max-w-xl flex-col items-start gap-3 rounded-ficha border border-dashed border-linea px-6 py-6">
              <p className="text-[0.98rem] text-texto">Este tema todavía no tiene texto.</p>
              <Boton onClick={empezarAEditar} disabled={!alDia}>
                {alDia ? "Escribirlo o pegarlo aquí" : "Cargando tu cuenta…"}
              </Boton>
              <p className="text-[0.85rem] text-apagado">
                Para subir fotos o un PDF, usa Mi temario: el texto leído aparecerá aquí.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** "1.1 CONCEPTO Y ENFOQUE" → "1.1 Concepto y enfoque": el índice se lee mejor. */
function aTitulo(texto: string): string {
  const letras = texto.replace(/[^\p{L}]/gu, "");
  if (letras !== letras.toUpperCase()) return texto.replace(/\.$/, "");
  const minus = texto.toLowerCase().replace(/\.$/, "");
  return minus.replace(/\p{L}/u, (c) => c.toUpperCase());
}

function BloqueTema({ bloque }: { bloque: Bloque }) {
  if (bloque.tipo === "titulo") {
    return (
      <h1 id={bloque.id} className="mb-6 scroll-mt-24 text-[1.7rem] leading-tight">
        {bloque.texto}
      </h1>
    );
  }
  if (bloque.tipo === "epigrafe") {
    return (
      <h2 id={bloque.id} className="mb-3 mt-9 scroll-mt-24 text-[1.3rem] leading-snug text-sec-temario">
        {aTitulo(bloque.texto)}
      </h2>
    );
  }
  if (bloque.tipo === "subepigrafe") {
    return (
      <h3 id={bloque.id} className="mb-2 mt-6 scroll-mt-24 text-[1.08rem] leading-snug">
        {aTitulo(bloque.texto)}
      </h3>
    );
  }
  return (
    <p id={bloque.id} className="destino mb-4 scroll-mt-24 text-[1.02rem] leading-[1.8] text-tinta">
      {bloque.texto}
    </p>
  );
}
