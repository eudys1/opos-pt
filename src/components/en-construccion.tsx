import Link from "next/link";
import { Ficha } from "@/components/ui/ficha";

/**
 * Pantalla honesta para lo que todavía no existe: dice qué hará, qué falta para
 * que funcione y a dónde ir mientras tanto. Nada de "próximamente" a secas.
 */
export function EnConstruccion({
  titulo,
  resumen,
  hara,
  necesita,
}: {
  titulo: string;
  resumen: string;
  hara: string[];
  necesita: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-margen">
          En construcción
        </p>
        <h1 className="mt-2 text-[2.1rem]">{titulo}</h1>
        <p className="mt-2 text-[1.02rem] leading-relaxed text-texto">{resumen}</p>
      </header>

      <Ficha className="px-6 py-5">
        <h2 className="text-lg">Qué hará esta pantalla</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {hara.map((linea) => (
            <li key={linea} className="flex gap-3 text-[0.96rem] leading-relaxed text-texto">
              <span aria-hidden="true" className="text-margen">
                ·
              </span>
              {linea}
            </li>
          ))}
        </ul>
      </Ficha>

      <Ficha className="border-dashed px-6 py-5">
        <h2 className="text-lg">Qué falta para poder usarla</h2>
        <p className="mt-2 text-[0.96rem] leading-relaxed text-texto">{necesita}</p>
      </Ficha>

      <p className="text-[0.95rem] text-texto">
        Mientras tanto puedes{" "}
        <Link href="/temario" className="regla font-semibold text-tinta">
          ir subiendo temas
        </Link>{" "}
        o{" "}
        <Link href="/registro" className="regla font-semibold text-tinta">
          llevar el registro de estudio
        </Link>
        .
      </p>
    </div>
  );
}
