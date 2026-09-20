import type { Metadata, Viewport } from "next";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--fuente-display",
  subsets: ["latin"],
  // Fuente variable: el peso se ajusta con font-weight y el eje óptico con opsz.
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const texto = Karla({
  variable: "--fuente-texto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Cuaderno · oposición de Pedagogía Terapéutica",
    template: "%s · Cuaderno",
  },
  description:
    "Registra lo que estudias, repasa cuando toca, practica con tus propios apuntes y haz simulacros con el reloj del examen real.",
  manifest: "/manifest.webmanifest",
  applicationName: "Cuaderno",
  appleWebApp: { capable: true, title: "Cuaderno", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f2e7" },
    { media: "(prefers-color-scheme: dark)", color: "#151c28" },
  ],
};

/**
 * Aplica el tema guardado antes del primer pintado. Sin esto, quien tenga el
 * cuaderno en oscuro vería un fogonazo claro en cada carga.
 */
const TEMA_SIN_FOGONAZO = `try{var t=localStorage.getItem("cuaderno:tema");if(t==="claro"||t==="oscuro"){document.documentElement.setAttribute("data-tema",t)}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${texto.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SIN_FOGONAZO }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only rounded-pliegue focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-tinta focus:px-4 focus:py-2 focus:text-papel"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
