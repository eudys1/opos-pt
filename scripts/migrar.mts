/**
 * Aplica las migraciones pendientes a Supabase.
 *
 *   npm run migrar          # aplica lo que falte
 *   npm run migrar -- --ver # solo dice qué falta, sin tocar nada
 *
 * Lleva la cuenta en una tabla `migraciones`, así que se puede ejecutar tantas
 * veces como haga falta: solo aplica los archivos nuevos.
 *
 * Necesita un token personal de Supabase en .env.local:
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 * Se saca en https://supabase.com/dashboard/account/tokens. Es una llave
 * maestra de tu cuenta de Supabase: va en .env.local, que no se sube a git.
 */
import { readFileSync, readdirSync } from "node:fs";

// En local se leen de .env.local; en CI vienen ya en el entorno.
try {
  for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = linea.indexOf("=");
    if (i < 0 || linea.trim().startsWith("#")) continue;
    process.env[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
} catch {
  // Sin .env.local: se usan las variables del entorno tal cual.
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const referencia = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const soloVer = process.argv.includes("--ver");

if (!token) {
  console.error(
    [
      "Falta SUPABASE_ACCESS_TOKEN en .env.local.",
      "",
      "  1. Entra en https://supabase.com/dashboard/account/tokens",
      "  2. Generate new token, ponle un nombre (por ejemplo: cuaderno-migraciones)",
      "  3. Copia el token (empieza por sbp_) y pégalo en .env.local:",
      "     SUPABASE_ACCESS_TOKEN=sbp_...",
      "",
      "Mientras tanto, la alternativa manual sigue siendo pegar",
      "supabase/migrations/PENDIENTES.sql en el SQL Editor de Supabase.",
    ].join("\n"),
  );
  process.exit(1);
}

if (!referencia) {
  console.error("No he podido sacar la referencia del proyecto de NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

async function ejecutar(sql: string): Promise<unknown> {
  const respuesta = await fetch(
    `https://api.supabase.com/v1/projects/${referencia}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    },
  );

  const cuerpo = await respuesta.text();
  if (!respuesta.ok) {
    throw new Error(`${respuesta.status} ${respuesta.statusText}: ${cuerpo.slice(0, 500)}`);
  }
  try {
    return JSON.parse(cuerpo);
  } catch {
    return cuerpo;
  }
}

// Registro de lo aplicado. Se crea sola la primera vez.
await ejecutar(`
  create table if not exists public.migraciones (
    archivo text primary key,
    aplicada_en timestamptz not null default now()
  );
  alter table public.migraciones enable row level security;
`);

const aplicadas = new Set(
  ((await ejecutar("select archivo from public.migraciones;")) as { archivo: string }[]).map(
    (fila) => fila.archivo,
  ),
);

const archivos = readdirSync("supabase/migrations")
  .filter((nombre) => /^\d{4}_.+\.sql$/.test(nombre))
  .sort();

const pendientes = archivos.filter((archivo) => !aplicadas.has(archivo));

if (pendientes.length === 0) {
  console.log(`Todo al día: ${archivos.length} migraciones aplicadas.`);
  process.exit(0);
}

console.log(`Pendientes (${pendientes.length}): ${pendientes.join(", ")}`);

if (soloVer) process.exit(0);

for (const archivo of pendientes) {
  const sql = readFileSync(`supabase/migrations/${archivo}`, "utf8");
  process.stdout.write(`  ${archivo} … `);
  try {
    await ejecutar(sql);
    await ejecutar(
      `insert into public.migraciones (archivo) values ('${archivo}') on conflict do nothing;`,
    );
    console.log("hecha");
  } catch (error) {
    console.log("FALLA");
    console.error(`\n${error instanceof Error ? error.message : error}\n`);
    console.error(
      "Las migraciones se pueden volver a ejecutar, así que arregla el problema y vuelve a lanzar el comando.",
    );
    process.exit(1);
  }
}

console.log("\nBase de datos al día.");
