"use client";

import { useState } from "react";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import type { CorreccionCorta } from "@/ia/corregir-corta";

/**
 * Una pregunta y su corrección. La usan Practicar y el repaso de fallos, para
 * que responder se sienta igual en los dos sitios.
 */

export type Item = {
  id: string;
  tema_id: string;
  tipo: "test" | "corta" | "flashcard" | "ley" | "cloze";
  enunciado: string;
  opciones: string[] | null;
  correcta: number | null;
  respuesta: string | null;
  explicacion: string | null;
  cita: string | null;
  desde_borrador: boolean;
};

export type Veredicto = {
  acierto: boolean;
  respuesta?: string;
  valoracion?: "sabia" | "dude" | "fallo";
  feedback?: CorreccionCorta;
};

const NOMBRES: Record<Item["tipo"], string> = {
  test: "Test",
  corta: "Pregunta corta",
  flashcard: "Flashcard",
  ley: "Legislación",
  cloze: "Completar",
};

export function TarjetaPregunta({
  item,
  numero,
  total,
  onResuelto,
  onSiguiente,
}: {
  item: Item;
  numero: number;
  total: number;
  onResuelto: (veredicto: Veredicto) => void;
  onSiguiente: () => void;
}) {
  return (
    <Ficha className="flex flex-col gap-5 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Etiqueta>{NOMBRES[item.tipo]}</Etiqueta>
        {item.desde_borrador ? (
          <Etiqueta tono="borrador">sale de un borrador, no de tus apuntes</Etiqueta>
        ) : null}
        <span className="ml-auto text-[0.85rem] text-apagado" data-numerico>
          {numero} de {total}
        </span>
      </div>

      {item.tipo === "test" ? (
        <Test item={item} onResuelto={onResuelto} onSiguiente={onSiguiente} />
      ) : item.tipo === "corta" ? (
        <Corta item={item} onResuelto={onResuelto} onSiguiente={onSiguiente} />
      ) : (
        <Tarjeta item={item} onResuelto={onResuelto} onSiguiente={onSiguiente} />
      )}
    </Ficha>
  );
}

function Cita({ item }: { item: Item }) {
  if (!item.cita) return null;
  return (
    <details className="text-[0.88rem]">
      <summary className="regla cursor-pointer text-texto">De dónde sale esto</summary>
      <blockquote className="mt-2 border-l-2 border-margen-hilo pl-3 text-apagado">
        «{item.cita}»
      </blockquote>
    </details>
  );
}

function Test({
  item,
  onResuelto,
  onSiguiente,
}: {
  item: Item;
  onResuelto: (v: Veredicto) => void;
  onSiguiente: () => void;
}) {
  const [elegida, setElegida] = useState<number | null>(null);
  const opciones = item.opciones ?? [];
  const respondida = elegida !== null;
  const acertada = elegida === item.correcta;

  return (
    <>
      <h2 className="font-display text-[1.35rem] leading-snug">{item.enunciado}</h2>

      <ol className="flex flex-col gap-2">
        {opciones.map((opcion, i) => {
          const esCorrecta = i === item.correcta;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={respondida}
                onClick={() => {
                  setElegida(i);
                  onResuelto({ acierto: i === item.correcta, respuesta: opcion });
                }}
                className={clsx(
                  "flex w-full items-start gap-3 rounded-pliegue border px-4 py-3 text-left text-[0.97rem] transition-colors",
                  !respondida && "border-linea bg-papel-alto hover:border-tinta",
                  respondida && esCorrecta && "border-visto bg-visto-fondo",
                  respondida && !esCorrecta && elegida === i && "border-margen bg-margen-fondo",
                  respondida && !esCorrecta && elegida !== i && "border-linea opacity-60",
                )}
              >
                <span className="font-semibold text-apagado">{"abcd"[i]})</span>
                <span className="flex-1">{opcion}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {respondida ? (
        <div className="flex flex-col gap-3 border-t border-linea-suave pt-4">
          <p
            aria-live="polite"
            className={clsx("font-semibold", acertada ? "text-visto" : "text-margen")}
          >
            {acertada ? "Correcto." : `No. La buena era la ${"abcd"[item.correcta ?? 0]}.`}
          </p>
          {item.explicacion ? (
            <p className="text-[0.95rem] leading-relaxed text-texto">{item.explicacion}</p>
          ) : null}
          <Cita item={item} />
          <Boton onClick={onSiguiente} className="self-start">
            Siguiente
          </Boton>
        </div>
      ) : null}
    </>
  );
}

function Tarjeta({
  item,
  onResuelto,
  onSiguiente,
}: {
  item: Item;
  onResuelto: (v: Veredicto) => void;
  onSiguiente: () => void;
}) {
  const [vuelta, setVuelta] = useState(false);
  const [valorada, setValorada] = useState(false);

  const esLey = item.tipo === "ley";

  return (
    <>
      {esLey ? (
        <p className="text-[0.85rem] text-apagado">
          Di de qué va esta norma y qué regula, tal y como lo tienes en el tema.
        </p>
      ) : null}
      <h2 className="font-display text-[1.35rem] leading-snug">{item.enunciado}</h2>

      {!vuelta ? (
        <Boton tono="secundario" onClick={() => setVuelta(true)} className="self-start">
          Ver la respuesta
        </Boton>
      ) : (
        <div className="flex flex-col gap-4 border-t border-linea-suave pt-4">
          <p className="text-[1rem] leading-relaxed text-tinta">{item.respuesta}</p>
          <Cita item={item} />

          {!valorada ? (
            <fieldset>
              <legend className="mb-2 text-[0.9rem] font-semibold text-tinta">
                ¿Cómo lo llevabas?
              </legend>
              <div className="flex flex-wrap gap-2">
                <Boton
                  tono="secundario"
                  onClick={() => {
                    setValorada(true);
                    onResuelto({ acierto: true, valoracion: "sabia" });
                  }}
                >
                  Lo sabía
                </Boton>
                <Boton
                  tono="secundario"
                  onClick={() => {
                    setValorada(true);
                    onResuelto({ acierto: false, valoracion: "dude" });
                  }}
                >
                  Dudé
                </Boton>
                <Boton
                  tono="secundario"
                  onClick={() => {
                    setValorada(true);
                    onResuelto({ acierto: false, valoracion: "fallo" });
                  }}
                >
                  No lo sabía
                </Boton>
              </div>
            </fieldset>
          ) : (
            <Boton onClick={onSiguiente} className="self-start">
              Siguiente
            </Boton>
          )}
        </div>
      )}
    </>
  );
}

function Corta({
  item,
  onResuelto,
  onSiguiente,
}: {
  item: Item;
  onResuelto: (v: Veredicto) => void;
  onSiguiente: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [correccion, setCorreccion] = useState<CorreccionCorta | null>(null);
  const [error, setError] = useState("");

  async function corregir() {
    setCorrigiendo(true);
    setError("");
    try {
      const respuesta = await fetch("/api/corregir-corta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, respuesta: texto }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se ha podido corregir.");
      setCorreccion(datos.correccion);
      onResuelto({
        acierto: datos.correccion.acierto,
        respuesta: texto,
        feedback: datos.correccion,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido corregir.");
    } finally {
      setCorrigiendo(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-[1.35rem] leading-snug">{item.enunciado}</h2>

      <div>
        <label htmlFor={`resp-${item.id}`} className="block text-[0.9rem] font-semibold text-tinta">
          Tu respuesta
        </label>
        <textarea
          id={`resp-${item.id}`}
          value={texto}
          disabled={Boolean(correccion)}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          className="mt-1.5 w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.97rem] leading-relaxed"
        />
      </div>

      {!correccion ? (
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={corregir} disabled={corrigiendo || texto.trim().length < 10}>
            {corrigiendo ? "Corrigiendo…" : "Corregir"}
          </Boton>
          <span className="text-[0.85rem] text-apagado">
            Se corrige contra la respuesta que salió de tus apuntes.
          </span>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[0.9rem] text-margen">
          {error}
        </p>
      ) : null}

      {correccion ? (
        <div className="flex flex-col gap-3 border-t border-linea-suave pt-4" aria-live="polite">
          <p className={clsx("font-semibold", correccion.acierto ? "text-visto" : "text-margen")}>
            {correccion.acierto ? "Bien." : "Te falta lo esencial."}{" "}
            <span className="font-normal text-apagado" data-numerico>
              {correccion.nota}/10
            </span>
          </p>
          <Bloque titulo="Has acertado" lineas={correccion.bien} tono="visto" />
          <Bloque titulo="Te falta" lineas={correccion.falta} tono="margen" />
          <Bloque titulo="Errores" lineas={correccion.errores} tono="margen" />
          <p className="text-[0.95rem] leading-relaxed text-texto">{correccion.consejo}</p>
          <details className="text-[0.9rem]">
            <summary className="regla cursor-pointer text-texto">Ver la respuesta modelo</summary>
            <p className="mt-2 leading-relaxed text-apagado">{item.respuesta}</p>
          </details>
          <Cita item={item} />
          <Boton onClick={onSiguiente} className="self-start">
            Siguiente
          </Boton>
        </div>
      ) : null}
    </>
  );
}

function Bloque({
  titulo,
  lineas,
  tono,
}: {
  titulo: string;
  lineas: string[];
  tono: "visto" | "margen";
}) {
  if (lineas.length === 0) return null;
  return (
    <div>
      <p className={clsx("text-[0.85rem] font-semibold", tono === "visto" ? "text-visto" : "text-margen")}>
        {titulo}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {lineas.map((linea) => (
          <li key={linea} className="text-[0.95rem] leading-relaxed text-texto">
            · {linea}
          </li>
        ))}
      </ul>
    </div>
  );
}
