/**
 * Lo que comparten los comandos que suben cosas de una carpeta local a la
 * cuenta (`npm run temario`, `npm run supuestos`): leer .env.local, el cliente
 * con la clave secreta, sacar el texto de un PDF y encontrar la cuenta de un
 * correo. Está aquí una sola vez para que un arreglo valga para los dos.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Cuenta = { id: string; correo: string };
export type Registro = Record<string, string>;

/** Carga .env.local en process.env y devuelve el cliente con la clave secreta. */
export function clienteAdmin(): SupabaseClient {
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
  // La clave secreta salta la RLS: es la única forma de escribir en la cuenta
  // de otra persona desde un script. Por eso estos comandos se ejecutan a mano
  // y nunca desde el navegador ni desde una ruta de la web.
  return createClient(url, secreta, { auth: { persistSession: false } });
}

/** A qué correos se sube: --cuenta=… o, si no, CORREOS_PERMITIDOS. */
export function correosDestino(soloCuenta: string | undefined): string[] {
  const correos = (soloCuenta ?? process.env.CORREOS_PERMITIDOS ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (correos.length === 0) {
    console.error("No hay correos a los que subir. Pon CORREOS_PERMITIDOS en .env.local");
    console.error("o pasa --cuenta=tucorreo@ejemplo.com");
    process.exit(1);
  }
  return correos;
}

/** Busca la cuenta por correo. Devuelve null si todavía no ha entrado nunca. */
export async function buscarCuenta(admin: SupabaseClient, correo: string): Promise<Cuenta | null> {
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

/**
 * Las cuentas de esos correos. Si un correo de CORREOS_PERMITIDOS aún no ha
 * entrado nunca, se le crea la cuenta aquí, ya con el correo confirmado, para
 * que al entrar por primera vez se encuentre el material puesto.
 *
 * Confirmado es la clave: Supabase une un inicio de sesión con Google a la
 * cuenta que ya existe con ese correo solo si el correo está verificado
 * (documentación de Identity Linking, consultada el 27-09-2026). Así no hay
 * dos cuentas, y el enlace al correo también entra en esta. No lleva
 * contraseña: si la quiere, se la pone en Mi cuenta.
 *
 * Solo se crean cuentas de la lista de permitidos: un --cuenta con otro
 * correo no inventa usuarios.
 */
export async function resolverCuentas(
  admin: SupabaseClient,
  correos: string[],
  { seco = false }: { seco?: boolean } = {},
): Promise<Cuenta[]> {
  const permitidos = (process.env.CORREOS_PERMITIDOS ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const cuentas: Cuenta[] = [];

  for (const correo of correos) {
    const cuenta = await buscarCuenta(admin, correo);
    if (cuenta) {
      cuentas.push(cuenta);
      continue;
    }
    if (!permitidos.includes(correo.toLowerCase())) {
      console.log(`\n(aviso) ${correo} no tiene cuenta y no está en CORREOS_PERMITIDOS: no se le crea.`);
      continue;
    }
    if (seco) {
      console.log(`\n(seco) ${correo} todavía no tiene cuenta: se le crearía y se le subiría todo.`);
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({ email: correo, email_confirm: true });
    if (error || !data.user) {
      console.log(`\n(aviso) No se ha podido crear la cuenta de ${correo}: ${error?.message ?? "sin respuesta"}.`);
      continue;
    }
    console.log(`\n(nuevo) Creada la cuenta de ${correo}. Puede entrar con Google o con el enlace al correo.`);
    cuentas.push({ id: data.user.id, correo: data.user.email ?? correo });
  }

  if (cuentas.length === 0) {
    if (seco) process.exit(0);
    console.error("\nNo hay ninguna cuenta a la que subir.");
    process.exit(1);
  }
  return cuentas;
}

/** Texto de un PDF con capa de texto, respetando los saltos de línea. */
export async function textoDelPdf(datos: Buffer): Promise<string> {
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

/** El texto de un archivo de la carpeta: PDF por su capa de texto, .txt/.md tal cual. */
export async function textoDeArchivo(ruta: string): Promise<{ texto: string; datos: Buffer }> {
  const datos = readFileSync(ruta);
  const texto = extname(ruta).toLowerCase() === ".pdf" ? await textoDelPdf(datos) : datos.toString("utf8").trim();
  return { texto, datos };
}

export const EXTENSIONES = [".pdf", ".txt", ".md"];

export function tipoMime(archivo: string): string {
  const ext = extname(archivo).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".txt" || ext === ".md") return "text/plain";
  return "application/octet-stream";
}

/** Huella de un texto sin fijarse en espacios: para saber si alguien lo ha cambiado. */
export const huellaTexto = (t: string) =>
  createHash("sha256").update(t.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);

export function leerRegistro(ruta: string, rehacer: boolean): Registro {
  if (rehacer || !existsSync(ruta)) return {};
  try {
    return JSON.parse(readFileSync(ruta, "utf8")) as Registro;
  } catch {
    return {};
  }
}
