"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { parseDate, type CalendarDate } from "@internationalized/date";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Checkbox,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  I18nProvider,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField,
  Popover,
  Radio,
  RadioGroup,
  Select,
  SelectValue,
  Text,
  TextArea,
  TextField,
} from "react-aria-components";

/**
 * Los campos de formulario de la app, sobre React Aria Components (Adobe):
 * accesibles de serie (teclado, lector de pantalla, foco), en español y con
 * el aspecto de la dirección B. Antes cada pantalla pintaba sus <input> a su
 * manera; ahora todas usan estos, y un cambio de estilo se hace aquí.
 *
 * Todos llevan etiqueta visible, ayuda opcional debajo y el error junto al
 * campo, enlazados para que el lector de pantalla los lea con él.
 */

// Lo común a todos: la caja con borde, el foco con el acento y el error en rojo.
// El borde usa el token "campo", que da 3:1 con el fondo en los dos temas.
const caja =
  "rounded-pliegue border-2 border-campo bg-papel-alto text-tinta transition-colors " +
  "hover:border-campo-foco data-[focus-within]:border-campo-foco data-[focused]:border-campo-foco " +
  "data-[focus-visible]:border-campo-foco data-[invalid]:border-margen";

function Etiqueta({ children }: { children: ReactNode }) {
  return <Label className="text-[0.9rem] font-extrabold text-tinta">{children}</Label>;
}

function Ayuda({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <Text slot="description" className="text-[0.82rem] leading-snug text-apagado">
      {children}
    </Text>
  );
}

function ErrorCampo({ children }: { children?: string }) {
  return <FieldError className="text-[0.85rem] font-bold text-margen">{children}</FieldError>;
}

// ------------------------------------------------------------------ texto

export function CampoTexto({
  etiqueta,
  ayuda,
  error,
  valor,
  onCambio,
  tipo = "text",
  autoComplete,
  placeholder,
  requerido,
  className,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string;
  valor: string;
  onCambio: (v: string) => void;
  tipo?: "text" | "email" | "search" | "number";
  autoComplete?: string;
  placeholder?: string;
  requerido?: boolean;
  className?: string;
}) {
  return (
    <TextField
      value={valor}
      onChange={onCambio}
      type={tipo}
      autoComplete={autoComplete}
      isRequired={requerido}
      isInvalid={Boolean(error)}
      className={clsx("flex flex-col gap-1.5", className)}
    >
      <Etiqueta>{etiqueta}</Etiqueta>
      <Input placeholder={placeholder} className={clsx(caja, "min-h-11 w-full px-4 py-2.5 text-[0.98rem] outline-none")} />
      <Ayuda>{ayuda}</Ayuda>
      <ErrorCampo>{error}</ErrorCampo>
    </TextField>
  );
}

export function AreaTexto({
  etiqueta,
  ayuda,
  error,
  valor,
  onCambio,
  filas = 6,
  placeholder,
  className,
  claseCaja,
  etiquetaOculta,
  corrector = true,
  deshabilitada,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string;
  valor: string;
  onCambio: (v: string) => void;
  filas?: number;
  placeholder?: string;
  className?: string;
  /** Clases extra para la caja de texto (tamaño de letra, interlineado…). */
  claseCaja?: string;
  /** Para cuando el título de la pantalla ya hace de etiqueta: se lee, no se ve. */
  etiquetaOculta?: boolean;
  /** Corrector ortográfico del navegador. En simulacros va apagado, como en el papel. */
  corrector?: boolean;
  deshabilitada?: boolean;
}) {
  return (
    <TextField
      value={valor}
      onChange={onCambio}
      isInvalid={Boolean(error)}
      isDisabled={deshabilitada}
      className={clsx("flex flex-col gap-1.5", className)}
    >
      {etiquetaOculta ? (
        <Label className="sr-only">{etiqueta}</Label>
      ) : (
        <Etiqueta>{etiqueta}</Etiqueta>
      )}
      <TextArea
        rows={filas}
        placeholder={placeholder}
        spellCheck={corrector}
        className={clsx(caja, "w-full resize-y px-4 py-3 text-[0.97rem] leading-relaxed outline-none", claseCaja)}
      />
      <Ayuda>{ayuda}</Ayuda>
      <ErrorCampo>{error}</ErrorCampo>
    </TextField>
  );
}

// ------------------------------------------------------------------ número

/** Un número con − y + a los lados, que no deja salirse de los límites. */
export function CampoNumero({
  etiqueta,
  ayuda,
  valor,
  onCambio,
  minimo,
  maximo,
  className,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  valor: number;
  onCambio: (n: number) => void;
  minimo?: number;
  maximo?: number;
  className?: string;
}) {
  const boton =
    "inline-flex h-9 w-9 items-center justify-center rounded-[9px] text-[1.15rem] font-extrabold text-tinta outline-none hover:bg-papel-franja data-[disabled]:text-tenue data-[focus-visible]:ring-2 data-[focus-visible]:ring-acento";
  return (
    <I18nProvider locale="es-ES">
      <NumberField
        value={valor}
        onChange={(n) => {
          if (!Number.isNaN(n)) onCambio(n);
        }}
        minValue={minimo}
        maxValue={maximo}
        className={clsx("flex flex-col gap-1.5", className)}
      >
        <Etiqueta>{etiqueta}</Etiqueta>
        <Group className={clsx(caja, "flex min-h-11 w-fit items-center gap-1 px-1")}>
          <Button slot="decrement" className={boton}>
            −
          </Button>
          <Input className="w-14 bg-transparent text-center text-[1rem] font-extrabold tabular-nums outline-none" />
          <Button slot="increment" className={boton}>
            +
          </Button>
        </Group>
        <Ayuda>{ayuda}</Ayuda>
      </NumberField>
    </I18nProvider>
  );
}

// ------------------------------------------------------------------- fecha

/**
 * Fecha con calendario desplegable, en español y empezando en lunes. Se
 * puede escribir día, mes y año a mano o elegir en el calendario. Trabaja con
 * fechas "AAAA-MM-DD", como el resto de la app; "" es sin fecha.
 */
export function CampoFecha({
  etiqueta,
  ayuda,
  error,
  valor,
  onCambio,
  minimo,
  maximo,
  className,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string;
  valor: string;
  onCambio: (fecha: string) => void;
  /** Fecha más temprana que se deja elegir, "AAAA-MM-DD". */
  minimo?: string;
  /** Fecha más tardía que se deja elegir, "AAAA-MM-DD". */
  maximo?: string;
  className?: string;
}) {
  const fecha = aFecha(valor);
  return (
    <I18nProvider locale="es-ES">
      <DatePicker
        value={fecha}
        onChange={(f: CalendarDate | null) => onCambio(f ? f.toString() : "")}
        minValue={aFecha(minimo ?? "") ?? undefined}
        maxValue={aFecha(maximo ?? "") ?? undefined}
        isInvalid={Boolean(error)}
        className={clsx("flex flex-col gap-1.5", className)}
      >
        <Etiqueta>{etiqueta}</Etiqueta>
        <Group className={clsx(caja, "flex min-h-11 w-full max-w-[17rem] items-center gap-1 pl-4 pr-1")}>
          <DateInput className="flex flex-1 text-[0.98rem]" data-numerico>
            {(segmento) => (
              <DateSegment
                segment={segmento}
                className="rounded-[5px] px-0.5 tabular-nums outline-none data-[focused]:bg-acento-vivo data-[focused]:text-sobre-boton data-[placeholder]:text-tenue"
              />
            )}
          </DateInput>
          <Button
            aria-label="Abrir el calendario"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] text-apagado outline-none hover:bg-papel-franja hover:text-tinta data-[focus-visible]:ring-2 data-[focus-visible]:ring-acento"
          >
            <IconoCalendario />
          </Button>
        </Group>
        <Ayuda>{ayuda}</Ayuda>
        <ErrorCampo>{error}</ErrorCampo>
        <Popover className="desplegable rounded-ficha border-2 border-borde bg-papel-alto p-3 shadow-ficha">
          <Dialog className="outline-none">
            <Calendario />
          </Dialog>
        </Popover>
      </DatePicker>
    </I18nProvider>
  );
}

function Calendario() {
  return (
    <Calendar className="w-[17.5rem]">
      <header className="mb-2 flex items-center gap-1">
        <Button
          slot="previous"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-tinta outline-none hover:bg-papel-franja data-[focus-visible]:ring-2 data-[focus-visible]:ring-acento"
        >
          <span aria-hidden="true">‹</span>
        </Button>
        <Heading className="flex-1 text-center font-display text-[1.05rem] font-semibold first-letter:uppercase" />
        <Button
          slot="next"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-tinta outline-none hover:bg-papel-franja data-[focus-visible]:ring-2 data-[focus-visible]:ring-acento"
        >
          <span aria-hidden="true">›</span>
        </Button>
      </header>
      <CalendarGrid className="w-full border-separate border-spacing-0.5">
        <CalendarGridHeader>
          {(dia) => (
            <CalendarHeaderCell className="pb-1 text-[0.72rem] font-extrabold uppercase text-tenue">
              {dia}
            </CalendarHeaderCell>
          )}
        </CalendarGridHeader>
        <CalendarGridBody>
          {(fecha) => (
            <CalendarCell
              date={fecha}
              className={clsx(
                "flex aspect-square items-center justify-center rounded-[10px] text-[0.88rem] tabular-nums outline-none",
                "hover:bg-papel-franja data-[outside-month]:invisible",
                "data-[today]:font-extrabold data-[today]:text-acento",
                "data-[selected]:bg-acento-vivo data-[selected]:text-sobre-boton",
                "data-[disabled]:text-tenue data-[disabled]:line-through",
                "data-[focus-visible]:ring-2 data-[focus-visible]:ring-borde",
              )}
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </Calendar>
  );
}

function aFecha(iso: string): CalendarDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
}

function IconoCalendario() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
      <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
    </svg>
  );
}

// -------------------------------------------------------------- desplegable

export type Opcion = { valor: string; texto: string; detalle?: string };

/**
 * Desplegable con la lista en una ventanita, en vez del <select> del
 * navegador: con su flecha dibujada (sin ella nadie sabe que se despliega),
 * teclado completo y escribir para saltar a una opción.
 */
export function Selector({
  etiqueta,
  ayuda,
  error,
  opciones,
  valor,
  onCambio,
  className,
  etiquetaOculta,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string;
  opciones: Opcion[];
  valor: string;
  onCambio: (valor: string) => void;
  className?: string;
  etiquetaOculta?: boolean;
}) {
  return (
    <Select
      selectedKey={valor}
      onSelectionChange={(clave) => onCambio(String(clave ?? ""))}
      isInvalid={Boolean(error)}
      className={clsx("flex flex-col gap-1.5", className)}
    >
      {etiquetaOculta ? <Label className="sr-only">{etiqueta}</Label> : <Etiqueta>{etiqueta}</Etiqueta>}
      <Button className={clsx(caja, "flex min-h-11 w-full items-center gap-2 px-4 text-left text-[0.97rem] outline-none")}>
        {/* Cerrado se ve solo el texto de la opción, sin su detalle. */}
        <SelectValue className="flex-1 truncate data-[placeholder]:text-tenue">
          {({ selectedText, isPlaceholder }) => (isPlaceholder ? "Elige…" : selectedText)}
        </SelectValue>
        <span aria-hidden="true" className="text-apagado">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </span>
      </Button>
      <Ayuda>{ayuda}</Ayuda>
      <ErrorCampo>{error}</ErrorCampo>
      <Popover className="desplegable w-(--trigger-width) min-w-[12rem] overflow-auto rounded-pliegue border-2 border-borde bg-papel-alto p-1 shadow-ficha">
        <ListBox className="max-h-72 outline-none">
          {opciones.map((o) => (
            <ListBoxItem
              key={o.valor}
              id={o.valor}
              textValue={o.texto}
              className="flex cursor-pointer flex-col rounded-[9px] px-3 py-2 text-[0.95rem] outline-none data-[focused]:bg-papel-franja data-[selected]:font-extrabold data-[selected]:text-acento"
            >
              <span>{o.texto}</span>
              {o.detalle ? <span className="text-[0.8rem] font-normal text-apagado">{o.detalle}</span> : null}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

// ------------------------------------------------------------ casilla y opciones

export function Casilla({
  marcada,
  onCambio,
  children,
  deshabilitada,
  className,
}: {
  marcada: boolean;
  onCambio: (v: boolean) => void;
  children: ReactNode;
  deshabilitada?: boolean;
  className?: string;
}) {
  return (
    <Checkbox
      isSelected={marcada}
      onChange={onCambio}
      isDisabled={deshabilitada}
      className={clsx(
        "group flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.95rem] text-tinta data-[disabled]:cursor-not-allowed data-[disabled]:text-apagado",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-campo bg-papel-alto transition-colors group-data-[selected]:border-acento-vivo group-data-[selected]:bg-acento-vivo group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-acento group-data-[focus-visible]:ring-offset-2"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" className="text-sobre-boton opacity-0 group-data-[selected]:opacity-100" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.5 8.5 3 3 6-6.5" />
        </svg>
      </span>
      <span>{children}</span>
    </Checkbox>
  );
}

export function Opciones({
  etiqueta,
  opciones,
  valor,
  onCambio,
  enFila,
  etiquetaOculta,
}: {
  etiqueta: string;
  opciones: Opcion[];
  valor: string;
  onCambio: (valor: string) => void;
  enFila?: boolean;
  etiquetaOculta?: boolean;
}) {
  return (
    <RadioGroup value={valor} onChange={onCambio} className="flex flex-col gap-1.5">
      <Label className={etiquetaOculta ? "sr-only" : "text-[0.9rem] font-extrabold text-tinta"}>{etiqueta}</Label>
      <div className={clsx("flex gap-x-5 gap-y-1", enFila ? "flex-wrap items-center" : "flex-col")}>
        {opciones.map((o) => (
          <Radio
            key={o.valor}
            value={o.valor}
            className="group flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.95rem] text-tinta"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-campo bg-papel-alto group-data-[selected]:border-acento-vivo group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-acento group-data-[focus-visible]:ring-offset-2"
            >
              <span className="h-2.5 w-2.5 scale-0 rounded-full bg-acento-vivo transition-transform group-data-[selected]:scale-100" />
            </span>
            <span className="flex flex-col">
              <span>{o.texto}</span>
              {o.detalle ? <span className="text-[0.82rem] text-apagado">{o.detalle}</span> : null}
            </span>
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
