"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { BarraProgreso } from "@/components/ui/barra-progreso";
import { CorreccionDetallada } from "@/components/correccion-detallada";
import { LeerArchivo } from "@/components/leer-archivo";
import { useSesion } from "@/datos/sesion";
import { RUBRICA_POR_DEFECTO } from "@/contenido/supuestos";
import type { CorreccionSupuesto } from "@/ia/supuestos";

type Supuesto = {
  id: string;
  usuario_id: string;
  titulo: string;
  enunciado: string;
  cuestiones: string[];
  necesidad: string | null;
  curso: string | null;
  rubrica: { criterio: string; peso: number; queSeEspera: string }[];
  solucion: string | null;
  solucion_de_academia?: boolean;
  origen: "propio" | "ia" | "compartido";
  visibilidad: "privado" | "especialidad";
  creado_en: string;
};

type Vista =
  | { tipo: "lista" }
  | { tipo: "nuevo" }
  | { tipo: "editar"; supuesto: Supuesto }
  | { tipo: "practicar"; supuesto: Supuesto };

export default function PaginaSupuestos() {
  const { usuario, cliente } = useSesion();
  const [supuestos, setSupuestos] = useState<Supuesto[]>([]);
  const [version, setVersion] = useState(0);
  const [pedidos, setPedidos] = useState(false);
  const [vista, setVista] = useState<Vista>({ tipo: "lista" });
  const [error, setError] = useState("");
  const [generando, setGenerando] = useState(false);
  const [aBorrar, setABorrar] = useState<Supuesto | null>(null);

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    void (async () => {
      const { data, error: e } = await cliente
        .from("supuestos")
        .select("*")
        .order("creado_en", { ascending: false });
      if (!vivo) return;
      if (e) setError(e.message);
      setSupuestos((data ?? []) as Supuesto[]);
      setPedidos(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, usuario, version]);

  async function generar() {
    setGenerando(true);
    setError("");
    try {
      const respuesta = await fetch("/api/generar-supuesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se ha podido crear el supuesto.");
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido crear el supuesto.");
    } finally {
      setGenerando(false);
    }
  }

  async function borrar(supuesto: Supuesto) {
    if (!cliente) return;
    const { error: e } = await cliente.from("supuestos").delete().eq("id", supuesto.id);
    setABorrar(null);
    if (e) setError(e.message);
    setVersion((v) => v + 1);
  }

  if (!usuario) return null;

  const volver = () => {
    setVista({ tipo: "lista" });
    setVersion((v) => v + 1);
  };

  if (vista.tipo === "practicar") return <PracticaSupuesto supuesto={vista.supuesto} onVolver={volver} />;
  if (vista.tipo === "nuevo") return <FormularioSupuesto onHecho={volver} onCancelar={volver} />;
  if (vista.tipo === "editar") {
    return <FormularioSupuesto inicial={vista.supuesto} onHecho={volver} onCancelar={volver} />;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-[2.1rem]">Supuestos prácticos</h1>
          <p className="mt-1 max-w-[62ch] text-[0.98rem] leading-relaxed text-texto">
            Practícalos sueltos y sin reloj. En los simulacros saldrán sin etiquetas y variados entre
            sí, como en el examen. Si les añades la resolución de tu academia, se corrigen contra
            ella. Todos los tuyos, también los creados con la IA, se pueden editar y borrar; los
            que comparten otras personas solo se leen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton tono="secundario" onClick={() => setVista({ tipo: "nuevo" })}>
            Añadir el mío
          </Boton>
          <Boton onClick={() => void generar()} disabled={generando}>
            Crear uno con la IA
          </Boton>
        </div>
      </header>

      {generando ? (
        <BarraProgreso
          pasos={["escribiendo el caso, sus cuestiones y la rúbrica"]}
          actual={0}
          aviso="Suele tardar entre uno y dos minutos. Sale de tus temas subidos."
        />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-2 text-[0.92rem]"
        >
          {error}
        </p>
      ) : null}

      {!pedidos ? <p className="text-apagado">Buscando tus supuestos…</p> : null}

      {pedidos && supuestos.length === 0 ? (
        <Ficha className="px-6 py-6">
          <h2 className="text-xl">Todavía no hay ninguno</h2>
          <p className="mt-2 max-w-[58ch] text-[0.97rem] leading-relaxed text-texto">
            Puedes añadir uno de academia, con su enunciado y su resolución, o pedir uno a la IA:
            lo escribirá a partir de los temas que ya tienes subidos.
          </p>
        </Ficha>
      ) : null}

      <ul className="flex flex-col gap-3">
        {supuestos.map((supuesto) => {
          const esMio = supuesto.usuario_id === usuario.id;
          return (
            <li key={supuesto.id}>
              <Ficha className="flex flex-col gap-2 px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="flex-1 font-display text-[1.15rem]">{supuesto.titulo}</h2>
                  <Etiqueta>
                    {supuesto.origen === "ia" ? "creado con IA" : esMio ? "mío" : "compartido"}
                  </Etiqueta>
                  {supuesto.solucion_de_academia ? (
                    <Etiqueta tono="hecha">con resolución de la academia</Etiqueta>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-[0.93rem] leading-relaxed text-texto">
                  {supuesto.enunciado}
                </p>

                {aBorrar?.id === supuesto.id ? (
                  <div
                    role="alertdialog"
                    aria-label={`Borrar ${supuesto.titulo}`}
                    className="flex flex-wrap items-center gap-3 rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-3"
                  >
                    <p className="flex-1 text-[0.92rem] text-tinta">
                      ¿Borrar este supuesto? También se borran tus respuestas y correcciones de él.
                    </p>
                    <Boton onClick={() => void borrar(supuesto)}>Sí, borrarlo</Boton>
                    <Boton tono="secundario" onClick={() => setABorrar(null)}>
                      Cancelar
                    </Boton>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-[0.83rem] text-apagado">
                    {supuesto.necesidad ? <span>{supuesto.necesidad}</span> : null}
                    {supuesto.curso ? <span>· {supuesto.curso}</span> : null}
                    <span>· {supuesto.cuestiones.length} cuestiones</span>
                    <span className="ml-auto flex flex-wrap gap-1">
                      {esMio ? (
                        <>
                          <Boton tono="fantasma" onClick={() => setABorrar(supuesto)}>
                            Borrar
                          </Boton>
                          <Boton
                            tono="fantasma"
                            onClick={() => setVista({ tipo: "editar", supuesto })}
                          >
                            Editar
                          </Boton>
                        </>
                      ) : null}
                      <Boton
                        tono="secundario"
                        onClick={() => setVista({ tipo: "practicar", supuesto })}
                      >
                        Practicar
                      </Boton>
                    </span>
                  </div>
                )}
              </Ficha>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PracticaSupuesto({ supuesto, onVolver }: { supuesto: Supuesto; onVolver: () => void }) {
  const [texto, setTexto] = useState("");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [correccion, setCorreccion] = useState<CorreccionSupuesto | null>(null);
  const [error, setError] = useState("");

  const nombreSolucion = supuesto.solucion_de_academia
    ? "la resolución de la academia"
    : "la solución orientativa";

  async function corregir() {
    const n = texto.trim().length;
    if (n < 100) {
      setError(`Tu respuesta es muy corta para corregirla: escribe al menos 100 caracteres (llevas ${n}).`);
      return;
    }
    setCorrigiendo(true);
    setError("");
    try {
      const respuesta = await fetch("/api/corregir-supuesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supuestoId: supuesto.id, texto }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se ha podido corregir.");
      setCorreccion(datos.correccion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido corregir.");
    } finally {
      setCorrigiendo(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-[1.7rem]">{supuesto.titulo}</h1>
        <button type="button" onClick={onVolver} className="regla text-[0.9rem] text-texto">
          ← Todos los supuestos
        </button>
      </div>

      <Ficha className="flex flex-col gap-4 px-6 py-5">
        <p className="whitespace-pre-line text-[1rem] leading-relaxed text-tinta">
          {supuesto.enunciado}
        </p>
        <ol className="flex flex-col gap-2 border-t border-linea-suave pt-4">
          {supuesto.cuestiones.map((cuestion, i) => (
            <li key={cuestion} className="flex gap-3 text-[0.97rem] leading-relaxed text-texto">
              <span className="font-semibold text-margen">{i + 1}.</span>
              {cuestion}
            </li>
          ))}
        </ol>
      </Ficha>

      {!correccion ? (
        <>
          <div>
            <label htmlFor="respuesta" className="block text-[0.95rem] font-semibold text-tinta">
              Tu respuesta
            </label>
            <p id="ayuda-respuesta" className="mb-2 text-[0.85rem] text-apagado">
              Sin reloj: esto es para practicar el contenido. El tiempo se pone en los simulacros.
              {supuesto.solucion ? ` Se corrige frente a ${nombreSolucion}.` : ""}
            </p>
            <textarea
              id="respuesta"
              aria-describedby="ayuda-respuesta"
              value={texto}
              disabled={corrigiendo}
              onChange={(e) => setTexto(e.target.value)}
              rows={16}
              className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.97rem] leading-relaxed"
            />
          </div>

          {corrigiendo ? (
            <BarraProgreso
              pasos={["corrigiendo tu respuesta"]}
              actual={0}
              aviso="Entre uno y dos minutos. No cierres la página."
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Boton onClick={() => void corregir()}>
                Corregir
              </Boton>
              <span className="text-[0.85rem] text-apagado" data-numerico>
                {texto.trim() ? texto.trim().split(/\s+/).length : 0} palabras
              </span>
            </div>
          )}

          {supuesto.solucion && !corrigiendo ? (
            <details className="text-[0.88rem]">
              <summary className="regla w-fit cursor-pointer text-texto">
                Ver {nombreSolucion} antes de responder
              </summary>
              <p className="mt-2 max-w-[70ch] whitespace-pre-line leading-relaxed text-apagado">
                {supuesto.solucion}
              </p>
            </details>
          ) : null}

          {error ? (
            <p role="alert" className="text-[0.92rem] text-margen">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <CorreccionDetallada correccion={correccion} rubrica={supuesto.rubrica} />
          {supuesto.solucion ? (
            <details className="text-[0.92rem]">
              <summary className="regla w-fit cursor-pointer text-tinta">
                {supuesto.solucion_de_academia ? "Resolución de la academia" : "Solución orientativa"}
              </summary>
              <p className="mt-2 max-w-[70ch] whitespace-pre-line leading-relaxed text-texto">
                {supuesto.solucion}
              </p>
            </details>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Boton
              tono="secundario"
              onClick={() => {
                setCorreccion(null);
                setTexto("");
              }}
            >
              Volver a intentarlo
            </Boton>
          </div>
        </>
      )}

      {/* Abajo también: tras leer una corrección larga no hay que subir para salir. */}
      <div className="border-t border-linea pt-4">
        <Boton tono="secundario" onClick={onVolver}>
          ← Todos los supuestos
        </Boton>
      </div>
    </div>
  );
}

function FormularioSupuesto({
  inicial,
  onHecho,
  onCancelar,
}: {
  inicial?: Supuesto;
  onHecho: () => void;
  onCancelar: () => void;
}) {
  const { usuario, cliente } = useSesion();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [enunciado, setEnunciado] = useState(inicial?.enunciado ?? "");
  const [cuestiones, setCuestiones] = useState((inicial?.cuestiones ?? []).join("\n"));
  const [solucion, setSolucion] = useState(inicial?.solucion ?? "");
  const [deAcademia, setDeAcademia] = useState(inicial ? Boolean(inicial.solucion_de_academia) : true);
  const [necesidad, setNecesidad] = useState(inicial?.necesidad ?? "");
  const [curso, setCurso] = useState(inicial?.curso ?? "");
  const [compartir, setCompartir] = useState(inicial?.visibilidad === "especialidad");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // Con la resolución de una academia dentro, el supuesto no se comparte: ese
  // texto tiene dueño y pasárselo a otras personas es distribuirlo sin permiso.
  const deLaAcademia = Boolean(solucion.trim()) && deAcademia;

  async function guardar() {
    if (!cliente || !usuario) return;
    const n = enunciado.trim().length;
    if (n < 80) {
      setError(
        n === 0
          ? "Falta el enunciado: pega el caso completo o léelo de una foto."
          : `El enunciado es muy corto: pega el caso completo, al menos 80 caracteres (llevas ${n}).`,
      );
      return;
    }
    setGuardando(true);
    setError("");
    const datos = {
      titulo: titulo.trim() || "Supuesto sin título",
      enunciado: enunciado.trim(),
      cuestiones: cuestiones
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean),
      solucion: solucion.trim() || null,
      solucion_de_academia: Boolean(solucion.trim()) && deAcademia,
      necesidad: necesidad.trim() || null,
      curso: curso.trim() || null,
      visibilidad: compartir && !deLaAcademia ? ("especialidad" as const) : ("privado" as const),
    };

    const { error: e } = inicial
      ? await cliente.from("supuestos").update(datos).eq("id", inicial.id)
      : await cliente.from("supuestos").insert({
          ...datos,
          usuario_id: usuario.id,
          rubrica: RUBRICA_POR_DEFECTO,
          origen: "propio",
        });

    setGuardando(false);
    if (e) {
      setError(e.message);
      return;
    }
    onHecho();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-[1.9rem]">{inicial ? "Editar el supuesto" : "Añadir un supuesto"}</h1>
        <button type="button" onClick={onCancelar} className="regla text-[0.9rem] text-texto">
          Cancelar
        </button>
      </div>

      {!inicial ? (
        <p className="max-w-[64ch] text-[0.95rem] leading-relaxed text-texto">
          Copia aquí uno de academia o de una convocatoria anterior, o léelo de una foto. Si tienes
          la resolución de la academia, añádela: al corregir se comprobará si has puesto lo que
          ella trae.
        </p>
      ) : null}

      <Campo id="titulo" etiqueta="Título" ayuda="Para reconocerlo en la lista.">
        <input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-2.5"
        />
      </Campo>

      <Campo id="enunciado" etiqueta="Enunciado" ayuda="El caso completo, tal y como viene.">
        <textarea
          id="enunciado"
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
          rows={8}
          className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 leading-relaxed"
        />
        <LeerArchivo
          carpeta="supuestos"
          onTexto={(t) => setEnunciado((previo) => (previo.trim() ? `${previo}\n\n${t}` : t))}
          texto="Leer el enunciado de una foto o un PDF"
        />
      </Campo>

      <Campo id="cuestiones" etiqueta="Cuestiones" ayuda="Una por línea.">
        <textarea
          id="cuestiones"
          value={cuestiones}
          onChange={(e) => setCuestiones(e.target.value)}
          rows={5}
          className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 leading-relaxed"
        />
      </Campo>

      <Campo
        id="solucion"
        etiqueta="Resolución"
        ayuda="La que te ha dado la academia, tal cual. Opcional, pero es lo que hace que la corrección se parezca a la del tribunal."
      >
        <textarea
          id="solucion"
          value={solucion}
          onChange={(e) => setSolucion(e.target.value)}
          rows={8}
          className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 leading-relaxed"
        />
        <LeerArchivo
          carpeta="supuestos"
          onTexto={(t) => setSolucion((previo) => (previo.trim() ? `${previo}\n\n${t}` : t))}
          texto="Leer la resolución de una foto o un PDF"
        />
        <label htmlFor="de-academia" className="mt-1 flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            id="de-academia"
            checked={deAcademia}
            onChange={(e) => setDeAcademia(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--color-tinta)]"
          />
          <span className="text-[0.93rem]">
            Es la resolución de la academia{" "}
            <span className="text-apagado">· se corregirá comprobando si recoges sus puntos clave</span>
          </span>
        </label>
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="necesidad"
          etiqueta="Necesidad principal"
          ayuda="TEA, TDAH, discapacidad intelectual… Opcional. No se enseña en los sorteos."
        >
          <input
            id="necesidad"
            value={necesidad}
            onChange={(e) => setNecesidad(e.target.value)}
            className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-2.5"
          />
        </Campo>
        <Campo id="curso" etiqueta="Curso" ayuda="Por ejemplo, 3.º de Primaria. Opcional.">
          <input
            id="curso"
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
            className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-2.5"
          />
        </Campo>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="compartir"
          className={clsx("flex min-h-11 items-center gap-2.5", deLaAcademia ? "text-apagado" : "cursor-pointer")}
        >
          <input
            type="checkbox"
            id="compartir"
            checked={compartir && !deLaAcademia}
            disabled={deLaAcademia}
            aria-describedby="compartir-ayuda"
            onChange={(e) => setCompartir(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--color-tinta)]"
          />
          <span className="text-[0.95rem]">
            Compartirlo con quien prepare la misma especialidad{" "}
            <span className="text-apagado">· podrán leerlo, no editarlo</span>
          </span>
        </label>
        <p id="compartir-ayuda" className="max-w-[62ch] pl-7 text-[0.84rem] leading-relaxed text-apagado">
          {deLaAcademia
            ? "No se puede compartir: lleva la resolución de tu academia, y ese texto es suyo. Para ti sí sirve, en privado. Si quieres compartir el caso, guarda una copia sin esa resolución o con una escrita por ti."
            : "Comparte solo lo que hayas escrito tú o lo que sea público, como los supuestos de convocatorias oficiales."}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-[0.92rem] text-margen">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3 border-t border-linea pt-4">
        <Boton onClick={() => void guardar()} disabled={guardando}>
          {guardando ? "Guardando…" : inicial ? "Guardar los cambios" : "Guardar el supuesto"}
        </Boton>
        <Boton tono="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.95rem] font-semibold text-tinta">
        {etiqueta}
      </label>
      <p className="text-[0.85rem] text-apagado">{ayuda}</p>
      {children}
    </div>
  );
}
