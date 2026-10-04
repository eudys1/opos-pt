import type { TipoActividad } from "@/nucleo/tipos";

/**
 * Los colores de la app, en un solo sitio (DRY: una única fuente de verdad).
 *
 * Los valores están en `src/app/globals.css` (tokens `--color-sec-*`). Aquí se
 * dice qué token usa cada cosa. Nada en la app escribe un color de sección a
 * mano: lo coge de estos mapas, así que cambiar el color de una sección es
 * cambiar una línea en globals.css.
 *
 * Las clases van escritas enteras porque Tailwind solo genera las que ve.
 * Nunca se usa el color solo: siempre va con su nombre o su texto al lado.
 */
export type EstiloSeccion = {
  nombre: string;
  /** Letras y bordes del color de la sección. */
  texto: string;
  borde: string;
  /** Fondo suave para tarjetas y píldoras. */
  fondo: string;
  /** Relleno vivo: cuadraditos del menú, barras, marcas del calendario. */
  lleno: string;
  /** Borde vivo, para tarjetas con contorno de color. */
  bordeVivo: string;
};

function estilo(nombre: string, token: string): EstiloSeccion {
  return {
    nombre,
    texto: `text-sec-${token}`,
    borde: `border-sec-${token}`,
    fondo: `bg-sec-${token}-fondo`,
    lleno: `bg-sec-${token}-vivo`,
    bordeVivo: `border-sec-${token}-vivo`,
  };
}

// Tailwind necesita ver las clases escritas enteras en algún sitio del código.
// Esta lista existe solo para eso: son las que genera `estilo()`.
export const CLASES_DE_SECCIONES = `
  text-sec-temario border-sec-temario bg-sec-temario-fondo bg-sec-temario-vivo border-sec-temario-vivo
  text-sec-repaso border-sec-repaso bg-sec-repaso-fondo bg-sec-repaso-vivo border-sec-repaso-vivo
  text-sec-otro border-sec-otro bg-sec-otro-fondo bg-sec-otro-vivo border-sec-otro-vivo
  text-sec-practica border-sec-practica bg-sec-practica-fondo bg-sec-practica-vivo border-sec-practica-vivo
  text-sec-fallos border-sec-fallos bg-sec-fallos-fondo bg-sec-fallos-vivo border-sec-fallos-vivo
  text-sec-supuesto border-sec-supuesto bg-sec-supuesto-fondo bg-sec-supuesto-vivo border-sec-supuesto-vivo
  text-sec-simulacro border-sec-simulacro bg-sec-simulacro-fondo bg-sec-simulacro-vivo border-sec-simulacro-vivo
  text-sec-progreso border-sec-progreso bg-sec-progreso-fondo bg-sec-progreso-vivo border-sec-progreso-vivo
  text-sec-normativa border-sec-normativa bg-sec-normativa-fondo bg-sec-normativa-vivo border-sec-normativa-vivo
  text-sec-apoyo border-sec-apoyo bg-sec-apoyo-fondo bg-sec-apoyo-vivo border-sec-apoyo-vivo
  text-sec-ud border-sec-ud bg-sec-ud-fondo bg-sec-ud-vivo border-sec-ud-vivo
`;

/** Las secciones de la app, en el orden del menú, con su color. */
export const SECCIONES_APP = {
  examen: {
    href: "/inicio",
    nombre: "Mi examen",
    texto: "text-acento",
    borde: "border-acento",
    fondo: "bg-acento-fondo",
    lleno: "bg-acento-vivo",
    bordeVivo: "border-acento-vivo",
  },
  temario: { href: "/temario", ...estilo("Mi temario", "temario") },
  registro: { href: "/registro", ...estilo("Registro", "repaso") },
  planificador: { href: "/planificador", ...estilo("Planificador", "otro") },
  practicar: { href: "/practicar", ...estilo("Practicar", "practica") },
  fallos: { href: "/fallos", ...estilo("Fallos", "fallos") },
  supuestos: { href: "/supuestos", ...estilo("Supuestos", "supuesto") },
  simulacros: { href: "/simulacros", ...estilo("Simulacros", "simulacro") },
  progreso: { href: "/progreso", ...estilo("Progreso", "progreso") },
  normativa: { href: "/normativa", ...estilo("Normativa", "normativa") },
} satisfies Record<string, EstiloSeccion & { href: string }>;

export type ClaveSeccion = keyof typeof SECCIONES_APP;

/**
 * Los tipos de actividad del planificador y el registro toman el color de la
 * sección a la que pertenecen: un repaso es azul porque el Registro es azul.
 */
export const SECCIONES: Record<TipoActividad, EstiloSeccion> = {
  temario: { ...SECCIONES_APP.temario, nombre: "Temario" },
  repaso: { ...SECCIONES_APP.registro, nombre: "Repaso" },
  practica: { ...SECCIONES_APP.practicar, nombre: "Práctica" },
  supuesto: { ...SECCIONES_APP.supuestos, nombre: "Supuesto" },
  simulacro: { ...SECCIONES_APP.simulacros, nombre: "Simulacro" },
  // Sin sección propia: tienen su color solo en el planificador.
  apoyo: estilo("Plan de apoyo", "apoyo"),
  ud: estilo("UD (unidad didáctica)", "ud"),
  otro: { ...SECCIONES_APP.planificador, nombre: "Otro" },
};

export const TIPOS_ACTIVIDAD: TipoActividad[] = [
  "temario",
  "repaso",
  "practica",
  "supuesto",
  "simulacro",
  "apoyo",
  "ud",
  "otro",
];
