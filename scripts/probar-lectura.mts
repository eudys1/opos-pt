/**
 * Prueba de humo de la lectura de apuntes contra la API de Claude.
 *
 * Fabrica un PDF con texto de apuntes, lo manda a leer y comprueba que vuelve
 * transcrito, con la estructura conservada y sin invenciones. Gasta unos pocos
 * céntimos.
 *
 *   npx tsx scripts/probar-lectura.mts
 */
import { readFileSync } from "node:fs";
import { clienteIA } from "../src/ia/cliente.ts";
import { leerApuntes } from "../src/ia/leer-apuntes.ts";

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = linea.indexOf("=");
  if (i < 0 || linea.trim().startsWith("#")) continue;
  process.env[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
}

/** PDF mínimo de una página con el texto dado, sin dependencias. */
function pdfConTexto(lineas: string[]): string {
  const contenido = [
    "BT",
    "/F1 13 Tf",
    "60 760 Td",
    "18 TL",
    ...lineas.map((l) => `(${l.replace(/([()\\])/g, "\\$1")}) Tj T*`),
    "ET",
  ].join("\n");

  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const posiciones: number[] = [];
  objetos.forEach((obj, i) => {
    posiciones.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const inicioTabla = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const pos of posiciones) pdf += `${String(pos).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioTabla}\n%%EOF`;

  return Buffer.from(pdf, "latin1").toString("base64");
}

const LINEAS = [
  "TEMA 2. LA EDUCACION ESPECIAL EN EL MARCO DE LA LOGSE",
  "",
  "1. INTRODUCCION",
  "La Ley Organica 1/1990, de 3 de octubre, de Ordenacion General",
  "del Sistema Educativo (LOGSE) supone un cambio de modelo.",
  "",
  "2. DESARROLLO NORMATIVO",
  "- Real Decreto 696/1995, de 28 de abril, de ordenacion de la",
  "  educacion de los alumnos con necesidades especiales.",
  "- Orden de 14 de febrero de 1996, sobre evaluacion",
  "  psicopedagogica.",
  "",
  "3. CONCEPTO DE NEE",
  "Un alumno tiene necesidades educativas especiales cuando precisa",
  "ayudas o recursos que no son los habituales.",
];

const fallos: string[] = [];
function comprobar(descripcion: string, condicion: boolean) {
  console.log(`${condicion ? "ok  " : "FALLA"} ${descripcion}`);
  if (!condicion) fallos.push(descripcion);
}

const ia = clienteIA();
const { texto, uso } = await leerApuntes(ia, {
  tipoMime: "application/pdf",
  datos: pdfConTexto(LINEAS),
  nombre: "tema-2-prueba.pdf",
});

console.log("\n--- transcripción ---\n" + texto + "\n---------------------\n");

comprobar("devuelve texto", texto.length > 100);
comprobar("conserva el nombre de la ley", /LOGSE/i.test(texto));
comprobar("conserva la referencia normativa", /1\/1990/.test(texto));
comprobar("conserva el real decreto", /696\/1995/.test(texto));
comprobar("mantiene los epígrafes", /(^|\n)#{1,3}\s|INTRODUCCI/i.test(texto));
comprobar("mantiene la lista", /(^|\n)\s*[-*]\s/.test(texto));
comprobar(
  "no se inventa normativa que no estaba",
  !/LOMLOE|LOE\b|2\/2006|3\/2020/.test(texto),
);
comprobar("no añade comentarios propios", !/como (puedes|se) (ver|observa)|resumen:/i.test(texto));

console.log(
  `\nTokens: ${uso.tokensEntrada} de entrada, ${uso.tokensSalida} de salida. Coste estimado: ${uso.costeEstimado} $`,
);

if (fallos.length) {
  console.error(`\n${fallos.length} comprobaciones han fallado.`);
  process.exit(1);
}
console.log("\nLa lectura funciona.");
