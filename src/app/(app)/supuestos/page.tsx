"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { CorreccionDetallada } from "@/components/correccion-detallada";
import { useSesion } from "@/datos/sesion";
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
  origen: "propio" | "ia" | "compartido";
  visibilidad: "privado" | "especialidad";
  creado_en: string;
};

export default function PaginaSupuestos() {
  const { usuario, cliente } = useSesion();
  const [supuestos, setSupuestos] = useState<Supuesto[]>([]);
  const [version, setVersion] = useState(0);
  const [pedidos, setPedidos] = useState(false);
  const [abierto, setAbierto] = useState<Supuesto | null>(null);
  const [vista, setVista] = useState<"lista" | "nuevo">("lista");
  const [error, setError] = useState("");
  const [generando, setGenerando] = useState(false);

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

  if (!usuario) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-[2.1rem]">Supuestos prácticos</h1>
        <Ficha className="px-6 py-5">
          <p className="text-[0.98rem] leading-relaxed text-texto">
            Los supuestos se guardan en tu cuenta.{" "}
            <Link href="/entrar" className="regla font-semibold text-tinta">
              Entrar
            </Link>
          </p>
        </Ficha>
      </div>
    );
  }

  if (abierto) {
    return (
      <PracticaSupuesto
        supuesto={abierto}
        onVolver={() => {
          setAbierto(null);
          setVersion((v) => v + 1);
        }}
      />
    );
  }

  if (vista === "nuevo") {
    return <FormularioSupuesto onHecho={() => { setVista("lista"); setVersion((v) => v + 1); }} onCancelar={() => setVista("lista")} />;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-[2.1rem]">Supuestos prácticos</h1>
          <p className="mt-1 max-w-[62ch] text-[0.98rem] leading-relaxed text-texto">
            Practícalos sueltos y sin reloj. En los simulacros saldrán sin etiquetas y variados entre
            sí, como en el examen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton tono="secundario" onClick={() => setVista("nuevo")}>
            Añadir el mío
          </Boton>
          <Boton onClick={() => void generar()} disabled={generando}>
            {generando ? "Escribiendo…" : "Crear uno con la IA"}
          </Boton>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-2 text-[0.92rem]">
          {error}
        </p>
      ) : null}

      {!pedidos ? <p className="text-apagado">Buscando tus supuestos…</p> : null}

      {pedidos && supuestos.length === 0 ? (
        <Ficha className="px-6 py-6">
          <h2 className="text-xl">Todavía no hay ninguno</h2>
          <p className="mt-2 max-w-[58ch] text-[0.97rem] leading-relaxed text-texto">
            Puedes añadir uno de academia copiando su enunciado, o pedir uno a la IA: lo escribirá a
            partir de los temas que ya tienes subidos, con sus cuestiones y su rúbrica de corrección.
          </p>
        </Ficha>
      ) : null}

      <ul className="flex flex-col gap-3">
        {supuestos.map((supuesto) => (
          <li key={supuesto.id}>
            <Ficha className="flex flex-col gap-2 px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="flex-1 font-display text-[1.15rem]">{supuesto.titulo}</h2>
                <Etiqueta>
                  {supuesto.origen === "ia"
                    ? "creado con IA"
                    : supuesto.usuario_id === usuario.id
                      ? "mío"
                      : "compartido"}
                </Etiqueta>
                {supuesto.visibilidad === "especialidad" ? <Etiqueta tono="hecha">compartido</Etiqueta> : null}
              </div>
              <p className="line-clamp-2 text-[0.93rem] leading-relaxed text-texto">
                {supuesto.enunciado}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[0.83rem] text-apagado">
                {supuesto.necesidad ? <span>{supuesto.necesidad}</span> : null}
                {supuesto.curso ? <span>· {supuesto.curso}</span> : null}
                <span>· {supuesto.cuestiones.length} cuestiones</span>
                <Boton tono="fantasma" className="ml-auto" onClick={() => setAbierto(supuesto)}>
                  Practicar
                </Boton>
              </div>
            </Ficha>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PracticaSupuesto({ supuesto, onVolver }: { supuesto: Supuesto; onVolver: () => void }) {
  const [texto, setTexto] = useState("");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [correccion, setCorreccion] = useState<CorreccionSupuesto | null>(null);
  const [error, setError] = useState("");

  async function corregir() {
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
          Volver a la lista
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
            </p>
            <textarea
              id="respuesta"
              aria-describedby="ayuda-respuesta"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={16}
              className="w-full rounded-pliegue border border-linea bg-papel-alto px-4 py-3 text-[0.97rem] leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Boton onClick={() => void corregir()} disabled={corrigiendo || texto.trim().length < 100}>
              {corrigiendo ? "Corrigiendo…" : "Corregir"}
            </Boton>
            <span className="text-[0.85rem] text-apagado" data-numerico>
              {texto.trim() ? texto.trim().split(/\s+/).length : 0} palabras
            </span>
            {supuesto.solucion ? (
              <details className="text-[0.88rem]">
                <summary className="regla cursor-pointer text-texto">
                  Ver la solución orientativa antes de responder
                </summary>
                <p className="mt-2 max-w-[70ch] leading-relaxed text-apagado">{supuesto.solucion}</p>
              </details>
            ) : null}
          </div>

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
              <summary className="regla cursor-pointer text-tinta">Solución orientativa</summary>
              <p className="mt-2 max-w-[70ch] leading-relaxed text-texto">{supuesto.solucion}</p>
            </details>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Boton onClick={onVolver}>Volver a la lista</Boton>
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
    </div>
  );
}

function FormularioSupuesto({
  onHecho,
  onCancelar,
}: {
  onHecho: () => void;
  onCancelar: () => void;
}) {
  const { usuario, cliente } = useSesion();
  const [titulo, setTitulo] = useState("");
  const [enunciado, setEnunciado] = useState("");
  const [cuestiones, setCuestiones] = useState("");
  const [necesidad, setNecesidad] = useState("");
  const [curso, setCurso] = useState("");
  const [compartir, setCompartir] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardar() {
    if (!cliente || !usuario) return;
    setGuardando(true);
    setError("");
    const lista = cuestiones
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);

    const { error: e } = await cliente.from("supuestos").insert({
      usuario_id: usuario.id,
      titulo: titulo.trim() || "Supuesto sin título",
      enunciado: enunciado.trim(),
      cuestiones: lista,
      necesidad: necesidad.trim() || null,
      curso: curso.trim() || null,
      // Rúbrica por defecto, editable más adelante desde la propia ficha.
      rubrica: [
        { criterio: "Fundamentación normativa", peso: 25, queSeEspera: "Normativa aplicable y bien citada." },
        { criterio: "Valoración del caso", peso: 20, queSeEspera: "Análisis de las necesidades del alumno." },
        { criterio: "Medidas y recursos", peso: 30, queSeEspera: "Medidas concretas, realistas y justificadas." },
        { criterio: "Evaluación y seguimiento", peso: 15, queSeEspera: "Cómo se evalúa y se revisa lo propuesto." },
        { criterio: "Expresión y estructura", peso: 10, queSeEspera: "Orden, claridad y corrección al escribir." },
      ],
      origen: "propio",
      visibilidad: compartir ? "especialidad" : "privado",
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
        <h1 className="flex-1 text-[1.9rem]">Añadir un supuesto</h1>
        <button type="button" onClick={onCancelar} className="regla text-[0.9rem] text-texto">
          Cancelar
        </button>
      </div>

      <p className="max-w-[64ch] text-[0.95rem] leading-relaxed text-texto">
        Copia aquí uno de academia o de una convocatoria anterior. Se corregirá con una rúbrica de
        cinco criterios que podrás ajustar después.
      </p>

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="necesidad" etiqueta="Necesidad principal" ayuda="TEA, TDAH, discapacidad intelectual… Opcional.">
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

      <label htmlFor="compartir" className="flex min-h-11 cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          id="compartir"
          checked={compartir}
          onChange={(e) => setCompartir(e.target.checked)}
          className="h-4 w-4 accent-[color:var(--color-tinta)]"
        />
        <span className="text-[0.95rem]">
          Compartirlo con quien prepare la misma especialidad{" "}
          <span className="text-apagado">· podrán leerlo, no editarlo</span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-[0.92rem] text-margen">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Boton
          onClick={() => void guardar()}
          disabled={guardando || enunciado.trim().length < 80}
        >
          {guardando ? "Guardando…" : "Guardar el supuesto"}
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
    <div className={clsx("flex flex-col")}>
      <label htmlFor={id} className="text-[0.95rem] font-semibold text-tinta">
        {etiqueta}
      </label>
      <p className="mb-1.5 text-[0.85rem] text-apagado">{ayuda}</p>
      {children}
    </div>
  );
}
