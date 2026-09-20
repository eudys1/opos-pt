import clsx from "clsx";

/** Visto bueno dibujado a mano: el trazo se "escribe" al aparecer. */
export function Visto({ className, animado = true }: { className?: string; animado?: boolean }) {
  return (
    <svg
      viewBox="0 0 19 19"
      fill="none"
      aria-hidden="true"
      className={clsx("h-[19px] w-[19px] text-visto", className)}
    >
      <path
        d="M3 10.5c2.4 2 3.6 3.4 4.6 5C9.4 11 12 7 16 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={animado ? "trazo" : undefined}
      />
    </svg>
  );
}

/** Aspa del margen, para lo que se quedó sin hacer. */
export function Aspa({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 19 19" fill="none" aria-hidden="true" className={clsx("h-[19px] w-[19px] text-margen", className)}>
      <path d="M4.5 4.2c3.4 3.6 6.6 7 10 10.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14.6 4.4c-3.5 3.5-6.8 6.9-10.2 10.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Marca({ className }: { className?: string }) {
  return (
    <span className={clsx("font-display text-[1.45rem] font-semibold tracking-[-0.01em] text-tinta", className)}>
      Cuaderno
    </span>
  );
}
