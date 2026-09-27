/**
 * Voz natural para escuchar los temas.
 *
 * La voz del navegador suena a robot. Esto genera el audio de cada tema con
 * las voces neurales de Microsoft Edge (el CLI `edge-tts`, el mismo que usa
 * Dossicar), lo pasa a Opus mono a 24 kbps con ffmpeg para que ocupe poco, y
 * lo sube a la cuenta. En la app aparece en el reproductor del tema.
 *
 * Es gratis y sin clave, pero va desde el portátil: edge-tts y ffmpeg no
 * existen en Vercel. Solo regenera lo que ha cambiado.
 *
 *   npm run voz                        # todos los temas con texto, todas las cuentas
 *   npm run voz -- --tema=3            # solo ese tema
 *   npm run voz -- --cuenta=a@b.com    # solo esa cuenta
 *   npm run voz -- --seco              # dice qué haría
 *   VOZ=es-ES-AlvaroNeural npm run voz # otra voz (por defecto, Elvira)
 *
 * Instalación, una vez: `winget install Python.Python.3.13`, `pip install
 * edge-tts` y `winget install ffmpeg`.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { textoParaEscuchar } from "../src/nucleo/estructura.ts";

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = linea.indexOf("=");
  if (i < 0 || linea.trim().startsWith("#")) continue;
  process.env[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
}

const argumentos = process.argv.slice(2);
const seco = argumentos.includes("--seco");
const soloCuenta = argumentos.find((a) => a.startsWith("--cuenta="))?.slice(9);
const soloTema = Number(argumentos.find((a) => a.startsWith("--tema="))?.slice(7)) || null;
const VOZ = process.env.VOZ ?? "es-ES-ElviraNeural";
// Un pelín más lenta que la de fábrica: es para estudiar, no para un anuncio.
const RITMO = process.env.RITMO ?? "-6%";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secreta = process.env.SUPABASE_SECRET_KEY;
if (!url || !secreta) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local.");
  process.exit(1);
}
const admin = createClient(url, secreta, { auth: { persistSession: false } });

// ---------------------------------------------------------------- herramientas

function buscar(candidatos: string[], prueba: string[]): string | null {
  for (const ruta of candidatos) {
    try {
      if (ruta.includes("/") && !existsSync(ruta)) continue;
      execFileSync(ruta, prueba, { stdio: "ignore", timeout: 30_000 });
      return ruta;
    } catch {
      // siguiente
    }
  }
  return null;
}

const edgeTts = buscar(
  [
    "edge-tts",
    ...["Python313", "Python312", "Python311"].map(
      (v) => `${homedir()}/AppData/Local/Programs/Python/${v}/Scripts/edge-tts.exe`,
    ),
    `${homedir()}/AppData/Roaming/Python/Scripts/edge-tts.exe`,
  ],
  ["--version"],
);
const ffmpeg = buscar(["ffmpeg", `${homedir()}/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe`], ["-version"]);

if (!edgeTts) {
  console.error("Falta el CLI edge-tts. Se instala una vez con: pip install edge-tts");
  process.exit(1);
}

/** Duración en segundos, leída de la salida de ffmpeg. */
function duracion(ruta: string): number {
  if (!ffmpeg) return 0;
  try {
    execFileSync(ffmpeg, ["-i", ruta], { stdio: "pipe" });
  } catch (e) {
    // ffmpeg sin salida termina con error, pero imprime la duración en stderr.
    const salida = String((e as { stderr?: Buffer }).stderr ?? "");
    const m = salida.match(/Duration: (\d+):(\d+):(\d+)/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return 0;
}

function sintetizar(texto: string, carpeta: string): { ruta: string; tipo: string } {
  const entrada = join(carpeta, "texto.txt");
  const mp3 = join(carpeta, "voz.mp3");
  writeFileSync(entrada, texto, "utf8");
  // --file y no --text: un tema no cabe en la línea de órdenes de Windows.
  execFileSync(edgeTts!, [`--rate=${RITMO}`, "--voice", VOZ, "--file", entrada, "--write-media", mp3], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (!ffmpeg) return { ruta: mp3, tipo: "audio/mpeg" };

  const ogg = join(carpeta, "voz.ogg");
  execFileSync(
    ffmpeg,
    ["-y", "-i", mp3, "-ac", "1", "-c:a", "libopus", "-b:a", "24k", "-application", "voip", ogg],
    { stdio: "ignore" },
  );
  return { ruta: ogg, tipo: "audio/ogg" };
}

// ------------------------------------------------------------------------ main

const correos = (soloCuenta ?? process.env.CORREOS_PERMITIDOS ?? "")
  .split(",")
  .map((c) => c.trim().toLowerCase())
  .filter(Boolean);

const { data: usuarios } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const cuentas = (usuarios?.users ?? []).filter((u) => correos.includes((u.email ?? "").toLowerCase()));
for (const c of correos) {
  if (!cuentas.some((u) => u.email?.toLowerCase() === c)) {
    console.log(`(aviso) ${c} todavía no ha entrado nunca: no tiene temas.`);
  }
}

console.log(`Voz: ${VOZ} · ritmo ${RITMO} · ${ffmpeg ? "Opus 24 kbps" : "MP3 (sin ffmpeg)"}`);
if (seco) console.log("Modo seco: no se sube nada.");

let hechos = 0;
let iguales = 0;

for (const cuenta of cuentas) {
  console.log(`\n→ ${cuenta.email}`);
  let consulta = admin
    .from("temas")
    .select("id, numero, texto")
    .eq("usuario_id", cuenta.id)
    .neq("estado_contenido", "sin_contenido")
    .order("numero");
  if (soloTema) consulta = consulta.eq("numero", soloTema);
  const { data: temas, error } = await consulta;
  if (error) throw new Error(error.message);

  for (const tema of temas ?? []) {
    const texto = textoParaEscuchar(tema.texto ?? "");
    if (texto.length < 200) continue;

    // La huella entra en la ruta: si el texto o la voz no cambian, no se repite.
    const huella = createHash("sha256").update(`${texto}|${VOZ}|${RITMO}`).digest("hex").slice(0, 12);
    const prefijo = `${cuenta.id}/voz/${tema.id}/`;
    const { data: previas } = await admin
      .from("grabaciones")
      .select("id, ruta")
      .eq("tema_id", tema.id)
      .eq("origen", "sintetica");

    if ((previas ?? []).some((p) => p.ruta.startsWith(`${prefijo}${huella}`))) {
      console.log(`  = tema ${tema.numero} sin cambios`);
      iguales++;
      continue;
    }
    if (seco) {
      console.log(`  + tema ${tema.numero} se generaría (${texto.length} caracteres)`);
      continue;
    }

    const carpeta = mkdtempSync(join(tmpdir(), "voz-"));
    try {
      process.stdout.write(`  … tema ${tema.numero}: generando `);
      const { ruta, tipo } = sintetizar(texto, carpeta);
      const bytes = statSync(ruta).size;
      const segundos = duracion(ruta);
      const destino = `${prefijo}${huella}.${tipo === "audio/ogg" ? "ogg" : "mp3"}`;

      const { error: e1 } = await admin.storage
        .from("apuntes")
        .upload(destino, readFileSync(ruta), { contentType: tipo, upsert: true });
      if (e1) throw new Error(e1.message);

      const { error: e2 } = await admin.from("grabaciones").insert({
        usuario_id: cuenta.id,
        tema_id: tema.id,
        ruta: destino,
        tipo_mime: tipo,
        bytes,
        duracion_s: segundos,
        origen: "sintetica",
      });
      if (e2) throw new Error(e2.message);

      // La versión anterior sintética ya no sirve: fuera, fila y archivo.
      for (const p of previas ?? []) {
        await admin.storage.from("apuntes").remove([p.ruta]);
        await admin.from("grabaciones").delete().eq("id", p.id);
      }

      console.log(`→ ${Math.round(segundos / 60)} min, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
      hechos++;
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  }
}

console.log(`\nResumen: ${hechos} generado(s), ${iguales} sin cambios.`);
