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
 *   npm run temario -- --forzar          # sustituye también textos editados en la app
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMARIO_PT } from "../src/contenido/temario-pt.ts";
import {
  EXTENSIONES,
  clienteAdmin,
  correosDestino,
  huellaTexto,
  leerRegistro,
  resolverCuentas,
  textoDeArchivo,
  tipoMime,
  type Registro,
} from "./comun.mts";

// -------------------------------------------------------------- configuración

const CARPETA = process.env.CARPETA_TEMARIO ?? "temario-local";
const REGISTRO = join(CARPETA, ".procesado.json");
const CUBO = "apuntes";

const argumentos = process.argv.slice(2);
const seco = argumentos.includes("--seco");
const sinArchivo = argumentos.includes("--sin-archivo");
const rehacer = argumentos.includes("--rehacer");
const forzar = argumentos.includes("--forzar");
const soloCuenta = argumentos.find((a) => a.startsWith("--cuenta="))?.slice("--cuenta=".length);

const admin = clienteAdmin();

// ------------------------------------------------------------------- utilidades

/** El número de tema sale del nombre del archivo: "tema 3 oposiciones.pdf". */
function numeroDeTema(nombre: string): number | null {
  const m = nombre.match(/tema\s*[-_]?\s*(\d{1,2})/i);
  if (!m) return null;
  const n = Number(m[1]);
  return TEMARIO_PT.some((t) => t.numero === n) ? n : null;
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

/**
 * Nunca pisar un texto editado en la app. Si el tema de la cuenta tiene texto
 * y no es el que subió este comando la última vez, alguien lo ha cambiado a
 * mano: se deja como está, salvo con --forzar.
 */
async function textoEditadoEnLaApp(
  cuenta: { id: string; correo: string },
  doc: Documento,
  registro: Registro,
): Promise<boolean> {
  const { data } = await admin
    .from("temas")
    .select("texto")
    .eq("usuario_id", cuenta.id)
    .eq("numero", doc.numero)
    .maybeSingle();
  const remoto = (data?.texto as string | undefined) ?? "";
  if (!remoto.trim()) return false;
  const actual = huellaTexto(remoto);
  if (actual === huellaTexto(doc.texto)) return false;
  return registro[`texto:${cuenta.correo}:${doc.numero}`] !== actual;
}

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

const correos = correosDestino(soloCuenta);

if (!existsSync(CARPETA)) {
  console.error(`No existe la carpeta ${CARPETA}/. Créala y deja ahí los temas.`);
  process.exit(1);
}

const archivos = readdirSync(CARPETA)
  .filter((a) => EXTENSIONES.includes(extname(a).toLowerCase()))
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

  const { texto, datos } = await textoDeArchivo(join(CARPETA, archivo));
  const oficial = TEMARIO_PT.find((t) => t.numero === numero)!;

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
const cuentas = await resolverCuentas(admin, correos, { seco });

// 3. Subir lo que haya cambiado, cuenta por cuenta.
const registro = leerRegistro(REGISTRO, rehacer);
let subidos = 0;
let saltados = 0;
const fallos: string[] = [];

for (const cuenta of cuentas) {
  console.log(`\n→ ${cuenta.correo}`);
  for (const doc of documentos) {
    const llave = `${doc.huella}:${cuenta.correo}`;

    // El registro local dice lo que se subió, pero manda lo que hay en la
    // cuenta: si allí el tema está vacío, se vuelve a subir aunque conste.
    const { data: remoto } = await admin
      .from("temas")
      .select("texto")
      .eq("usuario_id", cuenta.id)
      .eq("numero", doc.numero)
      .maybeSingle();
    const vacioEnLaCuenta = !((remoto?.texto as string | undefined) ?? "").trim();

    if (registro[llave] && !vacioEnLaCuenta) {
      console.log(`  = tema ${doc.numero} sin cambios`);
      saltados++;
      continue;
    }
    if (!forzar && (await textoEditadoEnLaApp(cuenta, doc, registro))) {
      console.log(
        `  ! tema ${doc.numero}: en la cuenta tiene un texto editado en la app. No se toca (usa --forzar para sustituirlo por el del archivo).`,
      );
      saltados++;
      continue;
    }
    if (seco) {
      console.log(`  + tema ${doc.numero} se subiría${vacioEnLaCuenta ? " (en la cuenta está vacío)" : ""}`);
      continue;
    }
    try {
      await subir(cuenta, doc);
      registro[llave] = new Date().toISOString();
      registro[`texto:${cuenta.correo}:${doc.numero}`] = huellaTexto(doc.texto);
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
