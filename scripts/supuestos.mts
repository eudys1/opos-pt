/**
 * Sube a la cuenta los supuestos prácticos que haya en la carpeta local, igual
 * que `npm run temario` hace con los temas.
 *
 * La carpeta NO va al repositorio (está en .gitignore): el repositorio es
 * público y los supuestos de academia tienen dueño. Viajan solo a la cuenta,
 * siempre como privados; compartirlos se decide dentro de la app, uno a uno.
 *
 * Estructura (el nombre de la carpeta es el título del supuesto):
 *
 *   supuestos-local/
 *     Alumno con TEA en 2.º de Primaria/
 *       enunciado.pdf              el caso (obligatorio; .pdf, .txt o .md)
 *       resolucion.pdf             la resolución de la academia (opcional)
 *       cuestiones.txt             una pregunta por línea (opcional)
 *     Dislexia en 4.º.pdf          un archivo suelto = un supuesto sin resolución
 *
 * Si la resolución es tuya y no de la academia, llama al archivo
 * "resolucion propia.txt": entonces la corrección la usa como orientación y no
 * como la referencia principal.
 *
 * Nunca pisa lo editado en la app ni resucita lo que borraste allí.
 *
 *   npm run supuestos                      # sube a todos los correos permitidos
 *   npm run supuestos -- --cuenta=a@b.com  # solo a esa cuenta
 *   npm run supuestos -- --seco            # dice qué haría, sin tocar nada
 *   npm run supuestos -- --rehacer         # ignora el registro (vuelve a subir lo borrado)
 *   npm run supuestos -- --forzar          # sustituye también lo editado en la app
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { RUBRICA_POR_DEFECTO } from "../src/contenido/supuestos.ts";
import {
  EXTENSIONES,
  clienteAdmin,
  correosDestino,
  huellaTexto,
  leerRegistro,
  resolverCuentas,
  textoDeArchivo,
  type Cuenta,
} from "./comun.mts";

const CARPETA = process.env.CARPETA_SUPUESTOS ?? "supuestos-local";
const REGISTRO = join(CARPETA, ".procesado.json");

const argumentos = process.argv.slice(2);
const seco = argumentos.includes("--seco");
const rehacer = argumentos.includes("--rehacer");
const forzar = argumentos.includes("--forzar");
const soloCuenta = argumentos.find((a) => a.startsWith("--cuenta="))?.slice("--cuenta=".length);

const admin = clienteAdmin();

type Supuesto = {
  clave: string;
  titulo: string;
  enunciado: string;
  solucion: string | null;
  deAcademia: boolean;
  cuestiones: string[];
};

/** Qué es cada archivo de la carpeta de un supuesto, por su nombre. */
function papel(nombre: string): "enunciado" | "resolucion" | "resolucion-propia" | "cuestiones" | null {
  const n = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (/resol|soluc/.test(n)) return /propi|mia\b/.test(n) ? "resolucion-propia" : "resolucion";
  if (/cuestion|pregunt/.test(n)) return "cuestiones";
  if (/enunciad|caso|supuesto/.test(n)) return "enunciado";
  return null;
}

const esDocumento = (a: string) => EXTENSIONES.includes(extname(a).toLowerCase());

/** Lee un supuesto: una carpeta con sus archivos, o un archivo suelto. */
async function leerSupuesto(entrada: string): Promise<Supuesto | string> {
  const ruta = join(CARPETA, entrada);

  if (!statSync(ruta).isDirectory()) {
    const { texto } = await textoDeArchivo(ruta);
    const titulo = basename(entrada, extname(entrada));
    if (texto.length < 80) return `${entrada} — solo ${texto.length} caracteres: ¿está escaneado?`;
    return { clave: entrada, titulo, enunciado: texto, solucion: null, deAcademia: false, cuestiones: [] };
  }

  const archivos = readdirSync(ruta).filter(esDocumento).sort();
  let enunciado = "";
  let solucion: string | null = null;
  let deAcademia = false;
  let cuestiones: string[] = [];
  const sinPapel: string[] = [];

  for (const archivo of archivos) {
    const { texto } = await textoDeArchivo(join(ruta, archivo));
    const p = papel(archivo) ?? (archivos.length === 1 ? "enunciado" : null);
    if (p === "enunciado") enunciado = enunciado ? `${enunciado}\n\n${texto}` : texto;
    else if (p === "resolucion" || p === "resolucion-propia") {
      solucion = solucion ? `${solucion}\n\n${texto}` : texto;
      deAcademia = p === "resolucion";
    } else if (p === "cuestiones") {
      cuestiones = texto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    } else sinPapel.push(archivo);
  }

  if (sinPapel.length) {
    return `${entrada}/ — no sé qué es ${sinPapel.join(", ")}: llámalo enunciado, resolucion o cuestiones`;
  }
  if (enunciado.length < 80) {
    return enunciado
      ? `${entrada}/ — el enunciado tiene solo ${enunciado.length} caracteres: ¿está escaneado? Léelo desde la app`
      : `${entrada}/ — falta el enunciado (un archivo que se llame enunciado.pdf, .txt o .md)`;
  }
  return { clave: entrada, titulo: entrada, enunciado, solucion, deAcademia, cuestiones };
}

const huellaDe = (s: { enunciado: string; solucion: string | null }) =>
  huellaTexto(`${s.enunciado}\n---\n${s.solucion ?? ""}`);

// ------------------------------------------------------------------------ main

if (!existsSync(CARPETA)) {
  mkdirSync(CARPETA, { recursive: true });
  console.log(`He creado la carpeta ${CARPETA}/. Deja ahí tus supuestos y repite el comando.`);
  process.exit(0);
}

const correos = correosDestino(soloCuenta);
const entradas = readdirSync(CARPETA)
  // Lo que empieza por punto o guion bajo, y el LEEME, no son supuestos.
  .filter((e) => !/^[._]/.test(e) && !/^leeme/i.test(e))
  .filter((e) => statSync(join(CARPETA, e)).isDirectory() || esDocumento(e))
  .sort();

if (entradas.length === 0) {
  console.log(`La carpeta ${CARPETA}/ está vacía. Nada que hacer.`);
  process.exit(0);
}

console.log(`Carpeta: ${CARPETA}/  ·  ${entradas.length} supuesto(s)`);
if (seco) console.log("Modo seco: no se escribe nada.\n");

// 1. Leer todo antes de tocar la red.
const supuestos: Supuesto[] = [];
for (const entrada of entradas) {
  const leido = await leerSupuesto(entrada);
  if (typeof leido === "string") {
    console.log(`  (fuera) ${leido}`);
    continue;
  }
  supuestos.push(leido);
  const extra = leido.solucion
    ? ` + resolución ${leido.deAcademia ? "de academia" : "propia"}`
    : " (sin resolución)";
  console.log(`  · ${leido.titulo} · ${leido.enunciado.length} caracteres${extra}`);
}
if (supuestos.length === 0) {
  console.log("\nNo hay nada que subir.");
  process.exit(0);
}

// 2. Cuentas.
const cuentas = await resolverCuentas(admin, correos, { seco });

// 3. Subir, cuenta por cuenta, sin pisar lo que se haya tocado en la app.
const registro = leerRegistro(REGISTRO, rehacer);
let subidos = 0;
let saltados = 0;
const fallos: string[] = [];

async function subirUno(cuenta: Cuenta, s: Supuesto): Promise<string> {
  const llave = `supuesto:${cuenta.correo}:${s.clave}`;
  const [idGuardado, huellaSubida] = (registro[llave] ?? "").split("|");
  const huella = huellaDe(s);

  // ¿Qué hay en la cuenta? Por el id que se guardó al subirlo o, si no hay
  // registro, por el título entre los propios.
  let fila: { id: string; enunciado: string; solucion: string | null } | null = null;
  if (idGuardado) {
    const { data } = await admin
      .from("supuestos")
      .select("id, enunciado, solucion")
      .eq("id", idGuardado)
      .maybeSingle();
    if (!data) return `  - ${s.titulo}: lo borraste en la app, no se vuelve a subir (usa --rehacer si lo quieres de vuelta)`;
    fila = data;
  } else {
    const { data } = await admin
      .from("supuestos")
      .select("id, enunciado, solucion")
      .eq("usuario_id", cuenta.id)
      .eq("titulo", s.titulo)
      .eq("origen", "propio")
      .limit(1)
      .maybeSingle();
    fila = data;
  }

  if (fila) {
    const enLaCuenta = huellaDe(fila);
    if (enLaCuenta === huella) {
      registro[llave] = `${fila.id}|${huella}`;
      saltados++;
      return `  = ${s.titulo} sin cambios`;
    }
    // Distinto a lo que subió este comando la última vez: lo han editado en la app.
    if (!forzar && enLaCuenta !== huellaSubida) {
      saltados++;
      return `  ! ${s.titulo}: en la cuenta está editado en la app. No se toca (usa --forzar para sustituirlo)`;
    }
  }

  const datos = {
    titulo: s.titulo,
    enunciado: s.enunciado,
    cuestiones: s.cuestiones,
    solucion: s.solucion,
    solucion_de_academia: Boolean(s.solucion) && s.deAcademia,
  };

  if (seco) return `  + ${s.titulo} se ${fila ? "actualizaría" : "subiría"}`;

  if (fila) {
    const { error } = await admin.from("supuestos").update(datos).eq("id", fila.id);
    if (error) throw new Error(error.message);
    registro[llave] = `${fila.id}|${huella}`;
    subidos++;
    return `  + ${s.titulo} actualizado`;
  }

  const { data, error } = await admin
    .from("supuestos")
    .insert({
      ...datos,
      usuario_id: cuenta.id,
      rubrica: RUBRICA_POR_DEFECTO,
      origen: "propio",
      // Siempre privado: compartir material de academia no es cosa de un script.
      visibilidad: "privado",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  registro[llave] = `${data.id}|${huella}`;
  subidos++;
  return `  + ${s.titulo} subido`;
}

for (const cuenta of cuentas) {
  console.log(`\n→ ${cuenta.correo}`);
  for (const s of supuestos) {
    try {
      console.log(await subirUno(cuenta, s));
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      console.log(`  ! ${s.titulo} ha fallado: ${motivo}`);
      fallos.push(`${cuenta.correo} · ${s.titulo}: ${motivo}`);
    }
  }
}

if (!seco) writeFileSync(REGISTRO, JSON.stringify(registro, null, 2));

console.log(`\nResumen: ${subidos} subido(s), ${saltados} sin cambios, ${fallos.length} con fallo(s).`);
if (fallos.length > 0) {
  for (const f of fallos) console.log(`  ${f}`);
  process.exit(1);
}
