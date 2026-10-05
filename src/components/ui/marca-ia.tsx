import clsx from "clsx";

/**
 * Marca de "esto lo hace la IA", la misma en toda la web: junto a cada botón
 * que llama a la IA (crear preguntas, corregir, leer fotos, comprobar la
 * normativa…), para que siempre se sepa qué hace una persona y qué hace la IA.
 * Toma el color del texto que la rodea, así vale sobre cualquier botón y en los
 * dos temas.
 */
export function MarcaIA({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border-[1.5px] border-current px-1.5 text-[0.66rem] font-extrabold leading-[1.35] tracking-wide",
        className,
      )}
    >
      <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true" fill="currentColor">
        <path d="M6 0.5 7.3 4.7 11.5 6 7.3 7.3 6 11.5 4.7 7.3 0.5 6 4.7 4.7Z" />
      </svg>
      IA<span className="sr-only"> (lo hace la inteligencia artificial)</span>
    </span>
  );
}
