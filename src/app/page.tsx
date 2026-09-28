import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { BotonEnlace } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Marca } from "@/components/marcas";
import { SelectorTema } from "@/components/selector-tema";
import { SECCIONES } from "@/components/ui/secciones";
import type { TipoActividad } from "@/nucleo/tipos";
import { RelojMuestra } from "@/components/reloj-muestra";
import { Cifra } from "@/components/ui/cifra";

export const metadata: Metadata = {
  title: "Cuaderno · tu oposición, ordenada",
  description:
    "Sube tu temario en fotos o PDF y Cuaderno lleva el registro de lo que estudias, te avisa de cada repaso, te pregunta, guarda tus fallos y te pone simulacros con el reloj del examen real.",
};

/*
  Portada con la estructura de la dirección B: título grande a la izquierda con
  sus dos botones, y a la derecha lo más característico de la app (lo que toca
  hoy y el camino de los 25 temas). Debajo, los pasos en tarjetas de color.
  Los datos del ejemplo son de muestra: la portada es pública.
*/

const pasos: { color: TipoActividad; titulo: string; texto: string }[] = [
  {
    color: "temario",
    titulo: "Subes lo que tengas",
    texto:
      "Fotos de tus folios, el PDF del temario o texto escrito en la app. Vale con dos temas: sabe qué tiene y qué le falta, y lo dice.",
  },
  {
    color: "repaso",
    titulo: "Repasas a tiempo",
    texto:
      "Marcas un tema como estudiado y quedan fijados sus repasos. Cada día ves lo que toca y lo que llevas con retraso.",
  },
  {
    color: "practica",
    titulo: "Te pones a prueba",
    texto:
      "Preguntas de tus propios apuntes. La legislación, de memoria y tal cual: se coteja con tu tema palabra a palabra.",
  },
  {
    color: "simulacro",
    titulo: "Escribes contra el reloj",
    texto:
      "Dos temas a elegir uno, tres supuestos a elegir uno o el examen completo de 4 h 30 min, sin repetir hasta hacerlos todos.",
  },
];

const apartados: { color: TipoActividad; titulo: string; texto: string }[] = [
  {
    color: "repaso",
    titulo: "Registro de estudio",
    texto:
      "Temas en filas, repasos en columnas. Cada casilla se marca con su día, se cambia o se desmarca, y el planificador lo ve al momento.",
  },
  {
    color: "otro",
    titulo: "Planificador",
    texto:
      "Semana o mes, cada cosa del color de su tipo. Los repasos que tocan aparecen solos y los puedes mover a otro día.",
  },
  {
    color: "practica",
    titulo: "Repaso de fallos",
    texto:
      "Lo que fallas vuelve días después, preguntado de otra forma. Eliges qué repasar: todo, un tema o un tipo de pregunta.",
  },
  {
    color: "supuesto",
    titulo: "Supuestos prácticos",
    texto:
      "Los de tu academia, con su resolución, o los que escribe la app desde tus temas. Se corrige si pones lo que trae la resolución.",
  },
  {
    color: "temario",
    titulo: "Normativa",
    texto:
      "Todas las leyes de tus temas en un solo documento, cada una una vez y tal cual la tienes escrita.",
  },
  {
    color: "simulacro",
    titulo: "Escuchar los temas",
    texto:
      "Con voz natural para el coche o el paseo, o grabándote mientras lo cantas, que es la mejor forma de saber si te lo sabes.",
  },
];

const preguntas = [
  {
    p: "¿Necesito tener el temario entero para empezar?",
    r: "No. Puedes subir dos temas, o media parte de uno. Cada tema lleva su estado y la app solo trabaja con lo que existe. Si pides algo de un tema que no has subido, te lo dice en vez de inventárselo.",
  },
  {
    p: "¿Puedo escribir los simulacros en papel?",
    r: "Sí, y es lo recomendable si en el examen vas a escribir a mano. Redactas en papel con el reloj en marcha, haces fotos al terminar y la app pasa tu letra a texto antes de corregir.",
  },
  {
    p: "¿El reloj avisa de cuánto queda?",
    r: "No, a propósito. Ni alertas, ni sonidos. Puedes ver el tiempo restante, el transcurrido, solo la hora o esconderlo. El simulacro flexible se puede pausar; el real, no.",
  },
  {
    p: "¿De dónde salen las preguntas?",
    r: "De tu temario, no de uno genérico. Cada pregunta guarda de qué frase de tus apuntes salió, para que puedas comprobarla.",
  },
];

// Muestra para el ejemplo: estudiados en violeta, con la vuelta completa en verde.
const MUESTRA_DOMINADOS = [1, 2];
const MUESTRA_ESTUDIADOS = [3, 4, 5, 7, 10, 12];
const MUESTRA_SUBIDOS = [6, 8, 9, 15, 19];

const MUESTRA_HOY: { texto: string; color: TipoActividad; tarde?: boolean }[] = [
  { texto: "Repaso 2 · tema 3", color: "repaso", tarde: true },
  { texto: "Repaso 1 · tema 7", color: "repaso" },
  { texto: "Un supuesto de TEA", color: "supuesto" },
  { texto: "4 fallos", color: "practica" },
];

const TITULO = "Estudiar 25 temas sin perder el hilo.".split(" ");

/**
 * El hilo que se dibuja bajo «hilo»: un trazo a mano, algo irregular, en el
 * naranja del acento. pathLength=1 deja animarlo sin medir la curva.
 */
function Hilo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 14"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -bottom-[0.12em] left-0 h-[0.28em] w-full overflow-visible text-acento-vivo"
    >
      <path
        className="hilo-trazo"
        pathLength={1}
        d="M2 9 C 18 3, 30 12, 46 7 S 74 2, 88 8 S 110 11, 118 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function Portada() {
  return (
    <>
      <header className="cabecera-viva sticky top-0 z-40 border-b-[3px] border-borde bg-papel/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-8">
          <Link href="/" className="shrink-0 rounded-pliegue">
            <Marca className="text-[1.3rem] sm:text-[1.5rem]" />
            <span className="sr-only">Inicio</span>
          </Link>
          <nav aria-label="Principal" className="ml-3 hidden flex-1 gap-6 md:flex">
            {[
              ["#como-funciona", "Cómo va"],
              ["#apartados", "Secciones"],
              ["#preguntas", "Dudas"],
            ].map(([href, texto]) => (
              <a key={href} href={href} className="regla text-[0.95rem] font-bold text-apagado">
                {texto}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:ml-0">
            <SelectorTema />
            <Link href="/entrar" className="regla inline-flex min-h-11 items-center px-2 text-[0.95rem] font-bold text-tinta sm:text-apagado">
              Entrar
            </Link>
            {/* En móvil no cabe: crear cuenta es el botón grande del héroe, justo debajo. */}
            <span className="hidden sm:block">
              <BotonEnlace href="/crear-cuenta" className="whitespace-nowrap">
                Crear cuenta
              </BotonEnlace>
            </span>
          </div>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:py-16">
          <div className="escalona flex flex-col gap-5 lg:pt-4">
            <h1 className="text-[2.7rem] leading-[1.05] sm:text-[3.3rem] lg:text-titulo">
              {TITULO.map((palabra, i) => (
                <span key={i}>
                  <span className="palabra" style={{ "--i": i } as React.CSSProperties}>
                    <span className={palabra === "hilo." ? "relative" : undefined}>
                      {palabra}
                      {palabra === "hilo." ? <Hilo /> : null}
                    </span>
                  </span>{" "}
                </span>
              ))}
            </h1>
            <p className="max-w-[48ch] text-[1.12rem] leading-relaxed text-apagado">
              Cada día te dice qué toca, te lo pregunta con tus propios apuntes y te apunta lo que
              fallas. Y va guardando lo que llevas hecho, que en dos años de oposición se agradece.
            </p>
            <div className="flex flex-wrap gap-3">
              <BotonEnlace href="/crear-cuenta" tamano="grande">
                Subir mi primer tema
              </BotonEnlace>
              <a
                href="#como-funciona"
                className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-sec-temario-fondo px-6 text-[1rem] font-extrabold text-sec-temario transition-[filter] hover:brightness-95"
              >
                Ver cómo funciona
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-y-0.5">
                  ↓
                </span>
              </a>
            </div>
            <ul className="escalona mt-2 grid grid-cols-3 gap-2.5">
              {[
                ["25", "temas del temario oficial", "border-sec-temario-vivo"],
                ["4 h 30", "el examen completo", "border-sec-simulacro-vivo"],
                ["3", "formas de meter tus temas", "border-sec-practica-vivo"],
              ].map(([dato, texto, borde]) => (
                <li key={texto} className={clsx("flota rounded-[16px] border-2 bg-papel-alto px-3 py-3 text-center", borde)}>
                  <span className="block font-display text-[1.4rem] font-bold leading-none" data-numerico>
                    <Cifra valor={dato} />
                  </span>
                  <span className="mt-1 block text-[0.75rem] font-bold text-apagado">{texto}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="entra flex flex-col gap-4 [animation-delay:160ms]">
            <Ficha destacada className="paralaje-rapido flex flex-col gap-4 px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-acento-vivo font-display text-[1.4rem] font-bold text-sobre-boton">
                  <Cifra valor="18" duracion={1400} />
                </span>
                <div>
                  <p className="font-display text-[1.2rem] font-semibold">¡18 días seguidos!</p>
                  <p className="text-[0.85rem] text-apagado">Te quedan 2 días libres este mes</p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[0.85rem] font-extrabold text-tinta">Hoy toca</p>
                <ul className="escalona flex flex-wrap gap-1.5">
                  {MUESTRA_HOY.map((h) => (
                    <li
                      key={h.texto}
                      className={clsx(
                        "rounded-full border-2 px-3 py-1 text-[0.8rem] font-extrabold",
                        SECCIONES[h.color].fondo,
                        SECCIONES[h.color].texto,
                        h.tarde ? "border-margen" : "border-transparent",
                      )}
                    >
                      {h.texto}
                    </li>
                  ))}
                </ul>
              </div>
            </Ficha>

            <div className="paralaje-lento rounded-ficha border-[3px] border-borde bg-sec-temario-fondo px-5 py-4">
              <p className="font-display text-[1.1rem] font-semibold text-sec-temario">El camino del temario</p>
              <ol className="mt-3 flex flex-wrap gap-2" aria-label="Ejemplo: estado de cada tema">
                {Array.from({ length: 25 }, (_, i) => {
                  const n = i + 1;
                  const dominado = MUESTRA_DOMINADOS.includes(n);
                  const estudiado = MUESTRA_ESTUDIADOS.includes(n);
                  const subido = MUESTRA_SUBIDOS.includes(n);
                  return (
                    <li
                      key={n}
                      style={{ "--i": i } as React.CSSProperties}
                      className={clsx(
                        "punto flex h-9 w-9 items-center justify-center rounded-full border-2 text-[0.78rem] font-extrabold",
                        dominado
                          ? "border-borde bg-visto-vivo text-sobre-boton"
                          : estudiado
                            ? "border-borde bg-sec-temario-vivo text-white"
                            : subido
                              ? "border-sec-temario-vivo bg-papel-alto text-sec-temario"
                              : "border-linea bg-papel-alto text-tenue",
                      )}
                      data-numerico
                    >
                      {n}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-[0.8rem] font-bold text-sec-temario">
                8 estudiados · 2 con la vuelta completa · 5 subidos sin estudiar
              </p>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 pb-14 sm:px-8">
            <h2 className="revela text-[1.9rem] sm:text-[2.2rem]">Cómo va</h2>
            <div className="relative mt-5 lg:mt-10">
              <span
                aria-hidden="true"
                className="hilo-pasos pointer-events-none absolute -top-[22px] left-[12.5%] right-[12.5%] hidden h-[3px] rounded-full bg-borde lg:block"
              />
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {pasos.map((paso) => (
                  <li key={paso.titulo} className={clsx("revela relative rounded-[20px] px-5 py-4", SECCIONES[paso.color].fondo)}>
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "nudo absolute -top-[30px] left-1/2 hidden h-[19px] w-[19px] -translate-x-1/2 rounded-full border-[3px] border-borde lg:block",
                        SECCIONES[paso.color].lleno,
                      )}
                    />
                    <h3 className={clsx("text-[1.1rem]", SECCIONES[paso.color].texto)}>{paso.titulo}</h3>
                    <p className="mt-1.5 text-[0.93rem] leading-relaxed text-texto">{paso.texto}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="apartados" className="scroll-mt-20 border-y-[3px] border-borde bg-papel-franja">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <h2 className="revela text-[1.9rem] sm:text-[2.2rem]">Qué hay dentro</h2>
            <p className="mt-2 max-w-[56ch] text-[1.05rem] leading-relaxed text-apagado">
              Todo sale del mismo sitio, tu temario, y cada sección tiene su color en toda la app.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {apartados.map((a) => (
                <div key={a.titulo} className="revela">
                  <Ficha className="flota group flex h-full gap-3 px-5 py-5">
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "h-10 w-10 shrink-0 rounded-[12px] transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110",
                        SECCIONES[a.color].lleno,
                      )}
                    />
                    <div>
                      <h3 className="text-[1.15rem]">{a.titulo}</h3>
                      <p className="mt-1 text-[0.93rem] leading-relaxed text-texto">{a.texto}</p>
                    </div>
                  </Ficha>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12">
          <div>
            <h2 className="revela text-[1.9rem] sm:text-[2.2rem]">El día del examen, ensayado</h2>
            <p className="mt-3 max-w-[54ch] text-[1.05rem] leading-relaxed text-apagado">
              En Andalucía el supuesto y el tema se hacen seguidos, en cuatro horas y media sin
              descanso, y tú repartes el tiempo. Aquí igual, sin repetir temas hasta hacerlos todos.
            </p>
            <ul className="mt-6 flex flex-col gap-2.5">
              {[
                ["Solo tema", "2 temas al azar, eliges 1", "2 h 15 min"],
                ["Solo supuesto", "3 supuestos variados, eliges 1", "2 h 15 min"],
                ["Examen completo", "2 temas y 3 supuestos, uno de cada", "4 h 30 min"],
              ].map(([nombre, que, tiempo]) => (
                <li
                  key={nombre}
                  className="revela flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[16px] border-2 border-borde bg-papel-alto px-4 py-3"
                >
                  <span className="font-extrabold">{nombre}</span>
                  <span className="flex-1 text-[0.93rem] text-apagado">{que}</span>
                  <span className="font-display text-[1.1rem] font-semibold text-sec-simulacro" data-numerico>
                    {tiempo}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Ficha destacada className="revela flex flex-col gap-3 self-start bg-sec-simulacro-fondo px-6 py-6">
            <p className="text-[0.9rem] font-bold text-sec-simulacro">Tiempo restante</p>
            <p className="font-display text-[3.2rem] font-bold leading-none text-sec-simulacro" data-numerico>
              <RelojMuestra />
            </p>
            <p className="text-[0.95rem] leading-relaxed text-texto">
              Sin ningún aviso antes de que acabe, igual que en el examen. En el real, si cierras la
              página, el reloj sigue corriendo.
            </p>
          </Ficha>
        </section>

        <section id="preguntas" className="scroll-mt-20 border-t-[3px] border-borde">
          <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
            <h2 className="revela text-[1.9rem] sm:text-[2.2rem]">Dudas razonables</h2>
            <dl className="mt-6 flex flex-col gap-3">
              {preguntas.map((q) => (
                <div key={q.p} className="revela rounded-[18px] border-2 border-linea bg-papel-alto px-5 py-4">
                  <dt className="font-display text-[1.15rem] font-semibold">{q.p}</dt>
                  <dd className="mt-1.5 text-[0.97rem] leading-relaxed text-texto">{q.r}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t-[3px] border-borde bg-acento-fondo">
          <div className="revela mx-auto flex max-w-6xl flex-col items-start gap-5 px-5 py-12 sm:px-8 lg:flex-row lg:items-center">
            <div className="flex-1">
              <h2 className="text-[1.8rem] sm:text-[2.1rem]">Empieza por el tema que tengas más a mano</h2>
              <p className="mt-2 max-w-[56ch] text-[1.05rem] leading-relaxed text-apagado">
                Se tarda menos en subir un tema que en decidir por dónde empezar.
              </p>
            </div>
            <BotonEnlace href="/crear-cuenta" tamano="grande">
              Subir mi primer tema
            </BotonEnlace>
          </div>
        </section>
      </main>

      <footer className="border-t-[3px] border-borde">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-7 text-sm text-apagado sm:px-8 md:flex-row md:items-center">
          <Marca className="text-base" />
          <p className="flex-1 md:ml-4">Hecho para una opositora concreta y su temario concreto.</p>
          <p className="max-w-[46ch]">
            Títulos de los temas: Orden de 9 de septiembre de 1993 (BOE 21/09/1993), restablecida por
            la Orden ECD/191/2012.
          </p>
        </div>
      </footer>
    </>
  );
}
