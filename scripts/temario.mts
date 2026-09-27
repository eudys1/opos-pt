/**
 * Sube a la cuenta los temas que haya en la carpeta local.
 *
 * Es la cuarta vía de entrada del temario, además de las fotos, el PDF desde la
 * web y el texto pegado: dejas los archivos en `temario-local/` y con un
 * comando aparecen en el cuaderno, en el portátil y en el móvil.
 *
 * La carpeta NO va al repositorio (está en .gitignore) porque el repositorio es
 * público. Lo que viaja es el contenido, y viaja a un cubo privado de Supabase
 * con RLS: solo lo ve la cuenta a la que se sube.
 *
 * Los PDF exportados de un procesador de textos llevan capa de texto, así que
 * se extrae aquí mismo, exacto y sin gastar un céntimo de IA. Solo lo
 * escaneado o fotografiado necesita visión, y para eso está la pantalla de
 * "Mi temario" dentro de la app.
 *
 *   npm run temario                      # sube a todos los correos permitidos
 *   npm run temario -- --cuenta=a@b.com  # solo a esa cuenta
 *   npm run temario -- --seco            # dice qué haría, sin tocar nada
 *   npm run temario -- --sin-archivo     # sube el texto, no el PDF original
 *   npm run temario -- --rehacer         # ignora el registro y lo repite todo
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEMARIO_PT } from "../src/contenido/temario-pt.ts";

// -------------------------------------------------------------- configuración

const CARPETA = process.env.CARPETA_TEMARIO ?? "temario-local";
const REGISTRO = join(CARPETA, ".procesado.json");
const CUBO = "apuntes";

const argumentos = process.argv.slice(2);
const seco = argumentos.includes("--seco");
const sinArchivo = argumentos.includes("--sin-archivo");
const rehacer = argumentos.includes("--rehacer");
const soloCuenta = argumentos.find((a) => a.startsWith("--cuenta="))?.slice("--cuenta=".length);

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = linea.indexOf("=");
  if (i < 0 || linea.trim().startsWith("#")) continue;
  process.env[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secreta = process.env.SUPABASE_SECRET_KEY;
if (!url || !secreta) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local.");
  process.exit(1);
}

// La clave secreta salta la RLS: es la única forma de escribir en la cuenta de
// otra persona desde un script. Por eso este comando se ejecuta a mano y nunca
// desde el navegador ni desde una ruta de la web.
const admin = createClient(url, secreta, { auth: { persistSession: false } });

// ------------------------------------------------------------------- utilidades

type Registro = Record<string, string>;

function leerRegistro(): Registro {
  if (rehacer || !existsSync(REGISTRO)) return {};
  try {
    return JSON.parse(readFileSync(REGISTRO, "utf8")) as Registro;
  } catch {
    return {};
  }
}

/** El número de tema sale del nombre del archivo: "tema 3 oposiciones.pdf". */
function numeroDeTema(nombre: string): number | null {
  const m = nombre.match(/tema\s*[-_]?\s*(\d{1,2})/i);
  if (!m) return null;
  const n = Number(m[1]);
  return TEMARIO_PT.some((t) => t.numero === n) ? n : null;
}

/** Texto de un PDF con capa de texto, respetando los saltos de línea. */
async function textoDelPdf(datos: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(datos), useSystemFonts: true }).promise;

  let salida = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const contenido = await (await doc.getPage(p)).getTextContent();
    let linea = "";
    for (const pieza of contenido.items) {
      if (!("str" in pieza)) continue;
      linea += pieza.str;
      if (pieza.hasEOL) {
        salida += `${linea}\n`;
        linea = "";
      }
    }
    if (linea) salida += `${linea}\n`;
  }
  return salida.replace(/\n{3,}/g, "\n\n").trim();
}

function tipoMime(archivo: string): string {
  const ext = extname(archivo).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".txt" || ext === ".md") return "text/plain";
  return "application/octet-stream";
}

/** Busca la cuenta por correo. Devuelve null si todavía no ha entrado nunca. */
async function buscarCuenta(correo: string): Promise<{ id: string; correo: string } | null> {
  // listUsers pagina de 50 en 50; con dos cuentas sobra la primera página, pero
  // se recorre igual por si algún día son más.
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 50 });
    if (error) throw new Error(error.message);
    const encontrado = data.users.find((u) => u.email?.toLowerCase() === correo.toLowerCase());
    if (encontrado) return { id: encontrado.id, correo: encontrado.email! };
    if (data.users.length < 50) return null;
  }
  return null;
}

// ------------------------------------------------------------------------ subir

type Documento = {
  archivo: string;
  numero: number;
  titulo: string;
  texto: string;
  datos: Buffer;
  huella: string;
};

async function subir(cuenta: { id: string; correo: string }, doc: Documento) {
  const sb: SupabaseClient = admin;

  // 1. El tema. Se empareja por (usuario, número), que es único en la tabla.
  const { data: tema, error: errorTema } = await sb
    .from("temas")
    .upsert(
      {
        usuario_id: cuenta.id,
        numero: doc.numero,
        titulo: doc.titulo,
        texto: doc.texto,
        estado_contenido: "completo",
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "usuario_id,numero" },
    )
    .select("id")
    .single();

  if (errorTema) throw new Error(`tema ${doc.numero}: ${errorTema.message}`);

  if (sinArchivo) return;

  // 2. El archivo original, al cubo privado. Ruta: <usuario>/<tema>/<archivo>.
  const ruta = `${cuenta.id}/${tema.id}/${doc.archivo}`;
  const { error: errorCubo } = await sb.storage
    .from(CUBO)
    .upload(ruta, doc.datos, { contentType: tipoMime(doc.archivo), upsert: true });
  if (errorCubo) throw new Error(`cubo: ${errorCubo.message}`);

  // 3. Su ficha, ya con el texto leído: la app no tiene que volver a leerlo.
  const { error: errorFicha } = await sb.from("archivos_tema").upsert(
    {
      usuario_id: cuenta.id,
      tema_id: tema.id,
      ruta,
      nombre: doc.archivo,
      tipo_mime: tipoMime(doc.archivo),
      bytes: doc.datos.byteLength,
      orden: 0,
      estado: "leido",
      texto: doc.texto,
    },
    { onConflict: "ruta" },
  );
  if (errorFicha) throw new Error(`ficha: ${errorFicha.message}`);
}

// ------------------------------------------------------------------------ main

const correos = (soloCuenta ?? process.env.CORREOS_PERMITIDOS ?? "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

if (correos.length === 0) {
  console.error("No hay correos a los que subir. Pon CORREOS_PERMITIDOS en .env.local");
  console.error("o pasa --cuenta=tucorreo@ejemplo.com");
  process.exit(1);
}

if (!existsSync(CARPETA)) {
  console.error(`No existe la carpeta ${CARPETA}/. Créala y deja ahí los temas.`);
  process.exit(1);
}

const archivos = readdirSync(CARPETA)
  .filter((a) => [".pdf", ".txt", ".md"].includes(extname(a).toLowerCase()))
  .sort();

if (archivos.length === 0) {
  console.log(`La carpeta ${CARPETA}/ está vacía. Nada que hacer.`);
  process.exit(0);
}

console.log(`Carpeta: ${CARPETA}/  ·  ${archivos.length} archivo(s)`);
if (seco) console.log("Modo seco: no se escribe nada.\n");

// 1. Leer y reconocer todo antes de tocar la red.
const documentos: Documento[] = [];
const descartados: string[] = [];

for (const archivo of archivos) {
  const numero = numeroDeTema(archivo);
  if (numero === null) {
    descartados.push(`${archivo} — no se reconoce el número de tema en el nombre`);
    continue;
  }

  const datos = readFileSync(join(CARPETA, archivo));
  const oficial = TEMARIO_PT.find((t) => t.numero === numero)!;
  const texto =
    extname(archivo).toLowerCase() === ".pdf"
      ? await textoDelPdf(datos)
      : datos.toString("utf8").trim();

  if (texto.length < 200) {
    descartados.push(
      `${archivo} — solo ${texto.length} caracteres: ¿está escaneado? Súbelo desde la app, que lo lee con visión`,
    );
    continue;
  }

  documentos.push({
    archivo,
    numero,
    titulo: oficial.titulo,
    texto,
    datos,
    huella: createHash("sha256").update(datos).digest("hex").slice(0, 16),
  });

  console.log(`  tema ${String(numero).padStart(2)} · ${archivo} · ${texto.length} caracteres`);
}

for (const d of descartados) console.log(`  (fuera) ${d}`);
if (documentos.length === 0) {
  console.log("\nNo hay nada que subir.");
  process.exit(0);
}

// 2. Resolver las cuentas.
const cuentas: { id: string; correo: string }[] = [];
for (const correo of correos) {
  const cuenta = await buscarCuenta(correo);
  if (cuenta) cuentas.push(cuenta);
  else console.log(`\n(aviso) ${correo} todavía no ha entrado nunca: no tiene cuenta que rellenar.`);
}

if (cuentas.length === 0) {
  console.error("\nNinguno de esos correos tiene cuenta todavía. Que entren una vez y repite.");
  process.exit(1);
}

// 3. Subir lo que haya cambiado, cuenta por cuenta.
const registro = leerRegistro();
let subidos = 0;
let saltados = 0;
const fallos: string[] = [];

for (const cuenta of cuentas) {
  console.log(`\n→ ${cuenta.correo}`);
  for (const doc of documentos) {
    const llave = `${doc.huella}:${cuenta.correo}`;
    if (registro[llave]) {
      console.log(`  = tema ${doc.numero} sin cambios`);
      saltados++;
      continue;
    }
    if (seco) {
      console.log(`  + tema ${doc.numero} se subiría`);
      continue;
    }
    try {
      await subir(cuenta, doc);
      registro[llave] = new Date().toISOString();
      console.log(`  + tema ${doc.numero} subido`);
      subidos++;
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      console.log(`  ! tema ${doc.numero} ha fallado: ${motivo}`);
      fallos.push(`${cuenta.correo} · tema ${doc.numero}: ${motivo}`);
    }
  }
}

if (!seco) writeFileSync(REGISTRO, JSON.stringify(registro, null, 2));

console.log(
  `\nResumen: ${subidos} subido(s), ${saltados} sin cambios, ${fallos.length} con fallo(s).`,
);
if (fallos.length > 0) {
  for (const f of fallos) console.log(`  ${f}`);
  process.exit(1);
}
