import type { Metadata } from "next";
import Link from "next/link";
import { BotonEnlace } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Marca, Visto } from "@/components/marcas";
import { SelectorTema } from "@/components/selector-tema";

export const metadata: Metadata = {
  title: "Cuaderno · tu oposición, ordenada",
  description:
    "Sube tu temario en fotos o PDF y Cuaderno lleva el registro de lo que estudias, te avisa de cada repaso, te pregunta, guarda tus fallos y te pone simulacros con el reloj del examen real.",
};

const pasos = [
  {
    n: "01",
    titulo: "Subes lo que tengas",
    texto:
      "Fotos de tus folios, el PDF del temario o texto escrito en la app. Vale con dos temas: Cuaderno sabe qué tiene y qué le falta, y lo dice.",
  },
  {
    n: "02",
    titulo: "Estudias y repasas a tiempo",
    texto:
      "Marcas un tema como estudiado y quedan fijados el repaso 1, el 2 y el 3. Cada mañana ves lo que toca hoy y lo que llevas con retraso.",
  },
  {
    n: "03",
    titulo: "Te pones a prueba",
    texto:
      "Tests, preguntas cortas y flashcards salidas de tus propios apuntes, incluidas las de legislación: te sale la norma y la completas tú.",
  },
  {
    n: "04",
    titulo: "Escribes contra el reloj",
    texto:
      "Dos temas a elegir uno, tres supuestos a elegir uno, o el examen completo de 4 h 30 min. En pantalla o en papel con una foto.",
  },
];

const apartados = [
  {
    titulo: "Registro de estudio",
    texto:
      "La tabla de siempre, pero viva: temas en filas, repasos en columnas y la fecha de cada marca. Con contador de vueltas al temario.",
  },
  {
    titulo: "Repaso de fallos",
    texto:
      "Lo que fallas se guarda solo y vuelve días después, y otra vez más tarde. Se da por superado tras tres aciertos seguidos.",
  },
  {
    titulo: "Supuestos prácticos",
    texto:
      "Los tuyos, los que genera la app desde tu temario y los que compartan otras personas. Con corrección y respuesta modelo.",
  },
  {
    titulo: "Planificador",
    texto:
      "Calendario semanal y mensual donde apuntas los objetivos del día y marcas al acabar lo cumplido y lo que se queda para mañana.",
  },
  {
    titulo: "Mi progreso",
    texto:
      "Cuenta atrás hasta el examen, racha de días, mapa de colores del temario y gráficas de repasos, aciertos y notas de simulacro.",
  },
  {
    titulo: "Escuchar los temas",
    texto:
      "Tus temas en audio para el coche o el paseo, con la voz del móvil o una voz natural generada para los que más escuches.",
  },
];

const preguntas = [
  {
    p: "¿Necesito tener el temario entero para empezar?",
    r: "No. Puedes subir dos temas, o media parte de uno. Cada tema lleva su estado —completo, parcial, borrador o sin contenido— y la app solo trabaja con lo que existe. Si pides algo de un tema que no has subido, te lo dice en vez de inventárselo.",
  },
  {
    p: "¿Puedo escribir los simulacros en papel?",
    r: "Sí, y es lo recomendable si en el examen vas a escribir a mano. Redactas en papel con el cronómetro en marcha, haces fotos al terminar y la app pasa tu letra a texto. Revisas la transcripción y solo entonces se corrige.",
  },
  {
    p: "¿El cronómetro avisa de cuánto queda?",
    r: "No, a propósito. Ni alertas, ni sonidos, ni mensajes de ánimo. Puedes ver el tiempo restante, el transcurrido, solo la hora o esconderlo del todo, pero nadie te va a interrumpir: en el examen tampoco lo harán.",
  },
  {
    p: "¿De dónde salen las preguntas?",
    r: "De tu temario, no de uno genérico. Cada pregunta guarda de qué parte de tus apuntes salió, para que puedas comprobarla. Los títulos de los 25 temas sí son los oficiales del Cuerpo de Maestros.",
  },
];

export default function Portada() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-linea bg-papel/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="rounded-pliegue">
            <Marca />
            <span className="sr-only">Inicio</span>
          </Link>
          <nav aria-label="Principal" className="ml-4 hidden flex-1 gap-7 md:flex">
            <a href="#como-funciona" className="regla text-[0.95rem] text-texto">
              Cómo funciona
            </a>
            <a href="#apartados" className="regla text-[0.95rem] text-texto">
              Qué incluye
            </a>
            <a href="#simulacros" className="regla text-[0.95rem] text-texto">
              Simulacros
            </a>
            <a href="#preguntas" className="regla text-[0.95rem] text-texto">
              Dudas
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-3 md:ml-0">
            <Link href="/entrar" className="regla hidden text-[0.95rem] text-texto sm:inline">
              Entrar
            </Link>
            <BotonEnlace href="/temario">Abrir mi cuaderno</BotonEnlace>
          </div>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        {/* Hoja con margen: el hilo rojo recorre la portada en pantallas anchas. */}
        <section className="relative overflow-hidden border-b border-linea">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-[72px] hidden w-px bg-margen-hilo lg:block"
          />
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 lg:py-20 lg:pl-28">
            <div className="entra flex flex-col gap-6">
              <p className="text-[0.78rem] font-bold uppercase tracking-[0.16em] text-margen">
                Cuerpo de Maestros · Pedagogía Terapéutica
              </p>
              <h1 className="max-w-[18ch] text-[2.6rem] leading-[1.03] tracking-[-0.02em] sm:text-[3.4rem] lg:text-titulo">
                Tus apuntes, ordenados como se estudia de verdad.
              </h1>
              <p className="max-w-[52ch] text-lg leading-relaxed text-tinta-suave">
                Subes tu temario en fotos o en PDF. A partir de ahí, Cuaderno lleva la cuenta de lo
                que has estudiado, te avisa de cuándo toca cada repaso, te pregunta, guarda tus
                fallos y te pone exámenes con el reloj del día real.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <BotonEnlace href="/temario" tamano="grande">
                  Empezar con mis temas
                </BotonEnlace>
                <a href="#como-funciona" className="regla text-[1.02rem] text-tinta">
                  Ver cómo funciona
                </a>
              </div>
              <p className="max-w-[54ch] text-sm leading-relaxed text-apagado">
                No hace falta tener el temario entero. Con dos temas ya se puede empezar: el cuaderno
                sabe qué tiene y qué no, y nunca se inventa lo que le falta.
              </p>
            </div>

            <div className="entra flex flex-col gap-4 [animation-delay:120ms]">
              <Ficha rayada className="px-6 py-6">
                <div className="mb-4 flex items-baseline gap-3">
                  <h2 className="font-display text-xl">Esta semana</h2>
                  <span className="text-sm text-apagado">3 repasos pendientes</span>
                </div>
                <table className="w-full border-collapse text-sm">
                  <caption className="pb-2 text-left text-[0.8rem] text-apagado">
                    Registro de estudio, temas 1 a 4
                  </caption>
                  <thead>
                    <tr className="text-[0.7rem] uppercase tracking-[0.06em] text-apagado">
                      <th scope="col" className="py-1.5 text-left font-semibold">
                        Tema
                      </th>
                      <th scope="col" className="w-14 py-1.5 font-semibold">
                        Est.
                      </th>
                      <th scope="col" className="w-14 py-1.5 font-semibold">
                        R1
                      </th>
                      <th scope="col" className="w-14 py-1.5 font-semibold">
                        R2
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <FilaDemo tema="1. Necesidades específicas de apoyo educativo" est r1 r2="hoy" />
                    <FilaDemo tema="2. La evaluación psicopedagógica" est r1="hoy" />
                    <FilaDemo tema="3. Discapacidad intelectual: respuesta educativa" est />
                    <FilaDemo tema="4. Trastorno del espectro autista" pendiente />
                  </tbody>
                </table>
              </Ficha>

              <div className="grid grid-cols-2 gap-4">
                <Ficha className="px-5 py-4">
                  <p className="font-display text-[2rem] leading-none" data-numerico>
                    25
                  </p>
                  <p className="mt-1 text-sm text-apagado">temas del temario oficial de PT</p>
                </Ficha>
                <Ficha className="px-5 py-4">
                  <p className="font-display text-[2rem] leading-none" data-numerico>
                    4 h 30
                  </p>
                  <p className="mt-1 text-sm text-apagado">el simulacro completo, sin descanso</p>
                </Ficha>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 border-b border-linea">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <div className="max-w-[46ch]">
              <h2 className="text-[2rem] sm:text-[2.4rem]">Cómo funciona</h2>
              <p className="mt-3 text-lg leading-relaxed text-tinta-suave">
                Cuatro pasos, y los tres últimos se repiten hasta el día del examen.
              </p>
            </div>
            <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {pasos.map((paso) => (
                <li key={paso.n} className="border-t border-linea pt-5">
                  <span className="font-display text-sm font-semibold text-margen">{paso.n}</span>
                  <h3 className="mt-2 text-xl">{paso.titulo}</h3>
                  <p className="mt-2 text-[0.97rem] leading-relaxed text-texto">{paso.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="apartados" className="scroll-mt-20 border-b border-linea bg-papel-franja">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <div className="max-w-[48ch]">
              <h2 className="text-[2rem] sm:text-[2.4rem]">Qué hay dentro</h2>
              <p className="mt-3 text-lg leading-relaxed text-tinta-suave">
                Seis apartados que se alimentan del mismo sitio: tu temario. Lo que haces en uno se
                nota en los demás.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {apartados.map((a) => (
                <Ficha key={a.titulo} className="flex flex-col gap-2 px-6 py-6">
                  <h3 className="text-xl">{a.titulo}</h3>
                  <p className="text-[0.97rem] leading-relaxed text-texto">{a.texto}</p>
                </Ficha>
              ))}
            </div>
          </div>
        </section>

        <section id="simulacros" className="scroll-mt-20 border-b border-linea">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
            <div>
              <h2 className="text-[2rem] sm:text-[2.4rem]">El día del examen, ensayado</h2>
              <p className="mt-3 max-w-[54ch] text-lg leading-relaxed text-tinta-suave">
                En Andalucía la parte práctica y el tema se hacen seguidos, en cuatro horas y media
                sin descanso, y eres tú quien reparte el tiempo. Cuaderno lo reproduce tal cual.
              </p>
              <div className="mt-8 overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-left text-[0.97rem]">
                  <caption className="sr-only">Modalidades de simulacro y su duración</caption>
                  <thead>
                    <tr className="border-y border-linea text-[0.72rem] uppercase tracking-[0.07em] text-apagado">
                      <th scope="col" className="py-3 pr-4 font-semibold">
                        Modalidad
                      </th>
                      <th scope="col" className="py-3 pr-4 font-semibold">
                        Qué te sale
                      </th>
                      <th scope="col" className="py-3 font-semibold">
                        Tiempo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-linea-suave">
                      <th scope="row" className="py-3 pr-4 font-semibold">
                        Solo tema
                      </th>
                      <td className="py-3 pr-4 text-texto">2 temas al azar, eliges 1</td>
                      <td className="py-3" data-numerico>
                        2 h 15 min
                      </td>
                    </tr>
                    <tr className="border-b border-linea-suave">
                      <th scope="row" className="py-3 pr-4 font-semibold">
                        Solo supuesto
                      </th>
                      <td className="py-3 pr-4 text-texto">3 supuestos variados, eliges 1</td>
                      <td className="py-3" data-numerico>
                        2 h 15 min
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="py-3 pr-4 font-semibold">
                        Examen completo
                      </th>
                      <td className="py-3 pr-4 text-texto">
                        2 temas y 3 supuestos, eliges uno de cada
                      </td>
                      <td className="py-3" data-numerico>
                        4 h 30 min
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <Ficha className="flex flex-col gap-4 self-start px-6 py-6">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-apagado">
                Tiempo restante
              </p>
              <p
                className="font-display text-[3.2rem] leading-none tracking-[-0.03em]"
                data-numerico
              >
                2:18:42
              </p>
              <p className="text-[0.95rem] leading-relaxed text-texto">
                No habrá ningún aviso antes de que acabe, igual que en el examen. Si cierras la
                página o se apaga el móvil, el reloj sigue corriendo.
              </p>
              <div className="flex flex-wrap gap-2 border-t border-linea-suave pt-4">
                <Etiqueta>Restante</Etiqueta>
                <Etiqueta>Transcurrido</Etiqueta>
                <Etiqueta>Solo la hora</Etiqueta>
                <Etiqueta>Oculto</Etiqueta>
              </div>
            </Ficha>
          </div>
        </section>

        <section id="preguntas" className="scroll-mt-20 border-b border-linea">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
            <h2 className="text-[2rem] sm:text-[2.4rem]">Dudas razonables</h2>
            <dl className="mt-8 divide-y divide-linea border-y border-linea">
              {preguntas.map((q) => (
                <div key={q.p} className="py-5">
                  <dt className="font-display text-xl">{q.p}</dt>
                  <dd className="mt-2 text-[0.99rem] leading-relaxed text-texto">{q.r}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-b border-linea bg-papel-franja">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-16 sm:px-8 lg:flex-row lg:items-center">
            <div className="flex-1">
              <h2 className="text-[1.9rem] sm:text-[2.2rem]">
                Empieza por el tema que tengas más a mano
              </h2>
              <p className="mt-3 max-w-[56ch] text-lg leading-relaxed text-tinta-suave">
                Se tarda menos en subir un tema que en decidir por dónde empezar.
              </p>
            </div>
            <BotonEnlace href="/temario" tamano="grande">
              Abrir mi cuaderno
            </BotonEnlace>
          </div>
        </section>
      </main>

      <footer className="border-t border-linea">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-apagado sm:px-8 md:flex-row md:items-center">
          <Marca className="text-base" />
          <p className="flex-1 md:ml-4">Hecho para una opositora concreta y su temario concreto.</p>
          <SelectorTema />
          <p className="max-w-[46ch]">
            Títulos de los temas: Orden de 9 de septiembre de 1993 (BOE 21/09/1993), restablecida por
            la Orden ECD/191/2012.
          </p>
        </div>
      </footer>
    </>
  );
}

function FilaDemo({
  tema,
  est,
  r1,
  r2,
  pendiente,
}: {
  tema: string;
  est?: boolean;
  r1?: boolean | string;
  r2?: boolean | string;
  pendiente?: boolean;
}) {
  return (
    <tr>
      <td className={pendiente ? "border-t border-linea-suave py-2.5 text-tenue" : "border-t border-linea-suave py-2.5"}>
        {tema}
        {pendiente ? <Etiqueta className="ml-2 align-middle">sin subir</Etiqueta> : null}
      </td>
      <Celda valor={est} />
      <Celda valor={r1} />
      <Celda valor={r2} />
    </tr>
  );
}

function Celda({ valor }: { valor?: boolean | string }) {
  return (
    <td className="border-t border-linea-suave text-center">
      {valor === true ? (
        <span className="inline-flex justify-center">
          <Visto />
          <span className="sr-only">hecho</span>
        </span>
      ) : typeof valor === "string" ? (
        <span className="font-semibold text-margen">{valor}</span>
      ) : (
        <span className="text-linea" aria-label="aún no toca">
          —
        </span>
      )}
    </td>
  );
}
