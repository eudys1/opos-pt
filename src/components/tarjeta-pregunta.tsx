"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { BarraProgreso } from "@/components/ui/barra-progreso";
import type { CorreccionCorta } from "@/ia/corregir-corta";
import { cotejarLiteral, type Cotejo } from "@/nucleo/cotejo";
import { estructuraDelTema, ubicarCita } from "@/nucleo/estructura";
import { useCuaderno } from "@/datos/almacen";

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
  /** Qué pide la tarjeta: "Definición", "Quién la realiza", "Cita literal"… */
  pide?: string | null;
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
  tema,
  onResuelto,
  onSiguiente,
}: {
  item: Item;
  numero: number;
  total: number;
  /** Número del tema del que sale, para tenerlo a la vista. */
  tema?: number;
  onResuelto: (veredicto: Veredicto) => void;
  onSiguiente: () => void;
}) {
  return (
    <Ficha destacada className="flex flex-col gap-5 px-6 py-6 sm:px-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-sec-repaso-fondo px-3 py-1 text-[0.8rem] font-extrabold text-sec-repaso">
          {tema ? `Tema ${tema} · ` : ""}
          {NOMBRES[item.tipo]}
        </span>
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
      ) : item.tipo === "ley" ? (
        <LeyLiteral item={item} onResuelto={onResuelto} onSiguiente={onSiguiente} />
      ) : (
        <Tarjeta item={item} onResuelto={onResuelto} onSiguiente={onSiguiente} />
      )}
    </Ficha>
  );
}

/**
 * La frase de tus apuntes de la que sale la pregunta, siempre a la vista. Se
 * despliega para ver el párrafo entero en su epígrafe, sin salir de la
 * pregunta, y lleva al sitio exacto del tema en otra pestaña.
 */
function Cita({ item }: { item: Item }) {
  const { temas } = useCuaderno();
  const tema = temas.find((t) => t.id === item.tema_id);
  const textoTema = tema?.texto ?? "";
  const sitio = useMemo(
    () => (item.cita && textoTema ? ubicarCita(estructuraDelTema(textoTema), item.cita) : null),
    [item.cita, textoTema],
  );
  if (!item.cita) return null;

  const frase = (
    <>
      <span className="font-semibold text-tinta">Tus apuntes: </span>«{item.cita}»
    </>
  );
  if (!sitio || !tema) {
    return (
      <p className="rounded-[16px] border-2 border-linea bg-papel-franja px-4 py-3 text-[0.9rem] leading-relaxed text-texto">
        {frase}
      </p>
    );
  }

  return (
    <details className="acordeon group rounded-[16px] border-2 border-linea bg-papel-franja text-[0.9rem] leading-relaxed text-texto open:border-sec-temario-vivo">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3">
        <span className="flex-1">{frase}</span>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[0.8rem] font-extrabold text-sec-temario">
          <span className="group-open:hidden">Ver dónde está</span>
          <span className="hidden group-open:inline">Plegar</span>
          <span aria-hidden="true" className="inline-block transition-transform duration-200 group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t-2 border-linea px-4 pb-4 pt-3">
        <p className="text-[0.78rem] font-extrabold uppercase tracking-wide text-sec-temario">
          Tema {tema.numero}
          {sitio.epigrafe ? ` · ${sitio.epigrafe.texto}` : ""}
        </p>
        <p className="max-h-48 overflow-y-auto text-[0.92rem] text-tinta">{sitio.bloque.texto}</p>
        <a
          href={`/tema/${tema.numero}#${sitio.bloque.id}`}
          target="_blank"
          rel="noopener"
          className="regla self-start text-[0.86rem] font-extrabold text-sec-temario"
        >
          Abrir el tema en este punto ↗
        </a>
      </div>
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
      <h2 className="font-display text-[1.55rem] leading-snug">{item.enunciado}</h2>

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
                  "flex w-full items-center gap-3 rounded-[16px] border-[3px] px-4 py-3 text-left text-[0.98rem] font-bold transition-colors",
                  !respondida && "border-linea bg-papel-alto hover:border-borde",
                  respondida && esCorrecta && "border-visto-vivo bg-visto-fondo text-visto",
                  respondida && !esCorrecta && elegida === i && "border-margen bg-margen-fondo text-margen",
                  respondida && !esCorrecta && elegida !== i && "border-linea opacity-60",
                )}
              >
                <span
                  className={clsx(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[0.8rem] font-extrabold",
                    respondida && esCorrecta
                      ? "bg-visto-vivo text-sobre-boton"
                      : respondida && elegida === i
                        ? "bg-margen text-papel-alto"
                        : "bg-linea-suave text-apagado",
                  )}
                >
                  {"abcd"[i]}
                </span>
                <span className="flex-1">{opcion}</span>
                {respondida && esCorrecta ? (
                  <span className="shrink-0 text-[0.78rem] font-semibold text-visto">correcta</span>
                ) : null}
                {respondida && !esCorrecta && elegida === i ? (
                  <span className="shrink-0 text-[0.78rem] font-semibold text-margen">tu respuesta</span>
                ) : null}
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

  return (
    <>
      <PidePrueba item={item} />
      <h2 className="font-display text-[1.55rem] leading-snug">{item.enunciado}</h2>

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

/**
 * Qué se pide contestar. Las flashcards antiguas no lo traen: para esas se
 * dice lo general, que es mejor que dejar un concepto suelto sin pregunta.
 */
function PidePrueba({ item }: { item: Item }) {
  const pide = item.pide?.trim() || "Lo que dicen tus apuntes sobre esto";
  return (
    <p className="text-[0.88rem] text-apagado">
      Te pide: <strong className="font-semibold text-tinta">{pide}</strong>
    </p>
  );
}

/**
 * Legislación: se escribe la norma de memoria, tal cual, y se coteja palabra a
 * palabra con el texto literal del tema. Sin IA: es instantáneo, gratis y no se
 * equivoca con una cifra, que es lo que más cuenta al citar una norma.
 */
function LeyLiteral({
  item,
  onResuelto,
  onSiguiente,
}: {
  item: Item;
  onResuelto: (v: Veredicto) => void;
  onSiguiente: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [cotejo, setCotejo] = useState<Cotejo | null>(null);
  const [falta, setFalta] = useState("");
  // Las nuevas guardan la cita literal en la respuesta. Las anteriores tenían
  // ahí un resumen, así que para esas se coteja contra su cita, que sí es
  // literal de los apuntes por construcción.
  const original =
    (item.pide === "Cita literal" ? item.respuesta : (item.cita ?? item.respuesta)) ?? "";

  function cotejar(sinRespuesta = false) {
    if (!sinRespuesta && texto.trim().length < 5) {
      setFalta("Escribe la cita, aunque sea a medias. Si no te la sabes, pulsa «No me la sé».");
      return;
    }
    setFalta("");
    const resultado = cotejarLiteral(texto, original);
    setCotejo(resultado);
    onResuelto({ acierto: resultado.acierto, respuesta: texto });
  }

  const titular = cotejo
    ? cotejo.veredicto === "literal"
      ? "Tal cual está en tu tema."
      : cotejo.veredicto === "casi"
        ? "Casi: te faltan algunas palabras."
        : "Te falta buena parte de la cita."
    : "";

  return (
    <>
      <p className="text-[0.88rem] text-apagado">
        Te pide: <strong className="font-semibold text-tinta">la cita literal, como en el examen</strong>
      </p>
      <h2 className="font-display text-[1.55rem] leading-snug">{item.enunciado}</h2>

      <div>
        <label htmlFor={`ley-${item.id}`} className="block text-[0.9rem] font-semibold text-tinta">
          Escribe lo que dice tu tema sobre esta norma
        </label>
        <p id={`ley-${item.id}-ayuda`} className="mb-1.5 text-[0.82rem] text-apagado">
          Nombre completo, fecha y lo que regula. Da igual la puntuación y las mayúsculas; los
          números y las fechas tienen que estar bien.
        </p>
        <textarea
          id={`ley-${item.id}`}
          aria-describedby={`ley-${item.id}-ayuda`}
          value={texto}
          disabled={Boolean(cotejo)}
          aria-invalid={falta ? true : undefined}
          onChange={(e) => {
            setTexto(e.target.value);
            setFalta("");
          }}
          rows={4}
          className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.97rem] leading-relaxed"
        />
      </div>

      {!cotejo ? (
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={() => cotejar()}>Cotejar con mi tema</Boton>
          <Boton tono="fantasma" onClick={() => cotejar(true)}>
            No me la sé
          </Boton>
          {falta ? (
            <p role="alert" className="w-full text-[0.88rem] font-bold text-margen">
              {falta}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t border-linea-suave pt-4" aria-live="polite">
          <p
            className={clsx(
              "font-semibold",
              cotejo.veredicto === "literal" ? "text-visto" : "text-margen",
            )}
          >
            {titular}{" "}
            <span className="font-normal text-apagado" data-numerico>
              {cotejo.porcentaje}% del texto
            </span>
          </p>

          {cotejo.datosQueFaltan.length > 0 ? (
            <p className="text-[0.92rem] text-texto">
              Datos que faltan o están mal:{" "}
              <strong className="font-semibold text-margen">
                {cotejo.datosQueFaltan.join(" · ")}
              </strong>
            </p>
          ) : null}

          <div>
            <p className="text-[0.85rem] font-semibold text-tinta">
              Lo que dice tu tema{" "}
              <span className="font-normal text-apagado">(subrayado: lo que te ha faltado)</span>
            </p>
            <p className="mt-1.5 rounded-pliegue border border-linea bg-papel-franja px-4 py-3 text-[0.97rem] leading-relaxed">
              {cotejo.palabras.map((p, i) => (
                <span key={i}>
                  {p.recordada ? (
                    <span className="text-tinta">{p.texto}</span>
                  ) : (
                    <mark
                      className={clsx(
                        "rounded-[2px] bg-margen-fondo px-0.5 text-margen underline decoration-margen-hilo underline-offset-4",
                        p.clave && "font-semibold",
                      )}
                    >
                      {p.texto}
                    </mark>
                  )}{" "}
                </span>
              ))}
            </p>
          </div>

          <Boton onClick={onSiguiente} className="self-start">
            Siguiente
          </Boton>
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
    if (texto.trim().length < 10) {
      setError("Escribe al menos una frase para poder corregirla.");
      return;
    }
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
      <h2 className="font-display text-[1.55rem] leading-snug">{item.enunciado}</h2>

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
          <Boton onClick={corregir} disabled={corrigiendo}>
            {corrigiendo ? "Corrigiendo…" : "Corregir"}
          </Boton>
          <span className="text-[0.85rem] text-apagado">
            Se corrige contra la respuesta que salió de tus apuntes.
          </span>
        </div>
      ) : null}

      {corrigiendo ? (
        <BarraProgreso pasos={["corrigiendo tu respuesta"]} actual={0} aviso="Unos segundos." />
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
