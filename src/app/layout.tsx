import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { RegistroSW } from "@/components/registro-sw";

// Las de la dirección B: Fredoka, redondeada, para titulares y cifras; Nunito
// para leer, también de terminaciones suaves. Juntas dan el tono cercano de B.
const display = Fredoka({
  variable: "--fuente-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const texto = Nunito({
  variable: "--fuente-texto",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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
    { media: "(prefers-color-scheme: light)", color: "#fff8f0" },
    { media: "(prefers-color-scheme: dark)", color: "#fff8f0" },
  ],
};

/**
 * Aplica el tema antes del primer pintado. Por defecto es el claro; el oscuro
 * solo si se ha elegido a mano. Sin esto habría un fogonazo al cargar.
 */
const TEMA_SIN_FOGONAZO = `try{if(localStorage.getItem("cuaderno:tema")==="oscuro"){document.documentElement.setAttribute("data-tema","oscuro")}}catch(e){}`;

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
          className="sr-only rounded-pliegue focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-boton focus:px-4 focus:py-2 focus:text-sobre-boton"
        >
          Saltar al contenido
        </a>
        {children}
        <RegistroSW />
      </body>
    </html>
  );
}
