/**
 * Prueba de humo de la sincronización contra la base de datos real.
 *
 * Crea un usuario de prueba, fusiona un estado local con la cuenta, guarda un
 * cambio, comprueba que otro usuario no ve nada de lo suyo y borra el usuario
 * al terminar. No toca datos de nadie más.
 *
 *   npx tsx scripts/probar-sincronizacion.mts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { guardarEnLaNube, sincronizar } from "../src/datos/nube.ts";
import type { Estado } from "../src/datos/almacen.tsx";

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = linea.indexOf("=");
  if (i < 0 || linea.trim().startsWith("#")) continue;
  process.env[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secreta = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secreta, { auth: { persistSession: false } });

const fallos: string[] = [];
function comprobar(descripcion: string, condicion: boolean) {
  console.log(`${condicion ? "ok  " : "FALLA"} ${descripcion}`);
  if (!condicion) fallos.push(descripcion);
}

async function crearUsuario(etiqueta: string) {
  const email = `prueba-${etiqueta}-${Date.now()}@cuaderno.test`;
  const password = `Pr${Math.random().toString(36).slice(2)}!A9`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`No se pudo crear el usuario: ${error.message}`);
  const cliente = createClient(url, publica, { auth: { persistSession: false } });
  const { error: errorEntrada } = await cliente.auth.signInWithPassword({ email, password });
  if (errorEntrada) throw new Error(`No se pudo entrar: ${errorEntrada.message}`);
  return { id: data.user!.id, cliente };
}

function estadoDePrueba(): Estado {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    perfil: {
      id: "local",
      nombre: "",
      especialidad: "Educación Especial: Pedagogía Terapéutica",
      comunidad: "Andalucía",
      fechaExamen: "2027-06-19",
      intervalosRepaso: [1, 3, 7, 15, 30],
      diasLibresAlMes: 2,
      examen: {
        temasSorteados: 2,
        supuestosSorteados: 3,
        minutosSoloTema: 135,
        minutosSoloSupuesto: 135,
        minutosExamenCompleto: 270,
        minimoTemasParaSimulacro: 10,
      },
    },
    temas: [
      {
        id: "tema-1",
        numero: 1,
        titulo: "Tema uno de prueba",
        texto: "Apuntes del tema uno.",
        estadoContenido: "completo",
        estadoEstudio: "estudiado",
        vueltas: 0,
        actualizadoEn: hoy,
      },
      {
        id: "tema-2",
        numero: 2,
        titulo: "Tema dos de prueba",
        texto: "",
        estadoContenido: "sin_contenido",
        estadoEstudio: "por_estudiar",
        vueltas: 0,
        actualizadoEn: hoy,
      },
    ],
    eventos: [
      {
        id: crypto.randomUUID(),
        temaId: "tema-1",
        tipo: "estudiado",
        fecha: hoy,
      },
    ],
    objetivos: [
      { id: crypto.randomUUID(), fecha: hoy, texto: "Leer el tema 1", hecho: false },
    ],
  };
}

async function principal() {
  const ana = await crearUsuario("ana");
  const berta = await crearUsuario("berta");

  try {
    // 1. Primera fusión: sube lo que solo estaba en el navegador.
    const local = estadoDePrueba();
    const primera = await sincronizar(ana.cliente, ana.id, local);
    comprobar("sube los temas del navegador", primera.subidos.temas === 2);
    comprobar("sube el evento de estudio", primera.subidos.eventos === 1);
    comprobar("sube el objetivo", primera.subidos.objetivos === 1);
    comprobar(
      "los temas dejan de tener id inventado",
      primera.estado.temas.every((t) => !t.id.startsWith("tema-")),
    );
    comprobar(
      "el evento sigue apuntando a su tema",
      primera.estado.eventos[0].temaId === primera.estado.temas[0].id,
    );

    // 2. Segunda entrada desde otro dispositivo: no duplica nada.
    const segunda = await sincronizar(ana.cliente, ana.id, primera.estado);
    comprobar("una segunda sincronización no duplica eventos", segunda.estado.eventos.length === 1);
    comprobar("ni duplica temas", segunda.estado.temas.length === 2);
    comprobar("y no vuelve a subir lo mismo", segunda.subidos.eventos === 0);

    // 3. Un cambio local se guarda arriba.
    const cambiado: Estado = {
      ...segunda.estado,
      temas: segunda.estado.temas.map((t) =>
        t.numero === 2 ? { ...t, texto: "Apuntes nuevos", estadoContenido: "parcial" as const } : t,
      ),
    };
    await guardarEnLaNube(ana.cliente, ana.id, cambiado);
    const { data: comprobado } = await ana.cliente
      .from("temas")
      .select("texto, estado_contenido")
      .eq("usuario_id", ana.id)
      .eq("numero", 2)
      .single();
    comprobar("el cambio de texto llega a la base de datos", comprobado?.texto === "Apuntes nuevos");
    comprobar("y también su estado", comprobado?.estado_contenido === "parcial");

    // 4. La fecha de examen del navegador se conserva.
    const { data: perfil } = await ana.cliente
      .from("perfiles")
      .select("fecha_examen")
      .eq("id", ana.id)
      .single();
    comprobar("la fecha de examen se guarda en el perfil", perfil?.fecha_examen === "2027-06-19");

    // 5. Berta no ve nada de Ana.
    const { data: temasDeBerta } = await berta.cliente.from("temas").select("id");
    comprobar("otra cuenta no ve los temas ajenos", (temasDeBerta ?? []).length === 0);
    const { error: errorEscritura } = await berta.cliente
      .from("temas")
      .update({ titulo: "intrusión" })
      .eq("usuario_id", ana.id);
    const { data: sigueIgual } = await ana.cliente
      .from("temas")
      .select("titulo")
      .eq("usuario_id", ana.id)
      .eq("numero", 1)
      .single();
    comprobar(
      "ni puede modificarlos",
      Boolean(errorEscritura) || sigueIgual?.titulo === "Tema uno de prueba",
    );

    // 6. Berta empieza de cero con su propio temario.
    const deBerta = await sincronizar(berta.cliente, berta.id, estadoDePrueba());
    comprobar("cada cuenta arranca con sus propios temas", deBerta.estado.temas.length === 2);
  } finally {
    await admin.auth.admin.deleteUser(ana.id);
    await admin.auth.admin.deleteUser(berta.id);
    console.log("\nUsuarios de prueba borrados.");
  }

  if (fallos.length) {
    console.error(`\n${fallos.length} comprobaciones han fallado.`);
    process.exit(1);
  }
  console.log("\nTodo correcto.");
}

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
