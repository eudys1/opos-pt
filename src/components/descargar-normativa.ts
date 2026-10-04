"use client";

import { seccionesDelDocumento } from "@/nucleo/normas";

/**
 * Descargar el banco de normativa en Word, PDF o texto. Los tres salen de la
 * misma lectura del documento (seccionesDelDocumento): los grupos en
 * mayúsculas son títulos y cada "- …" una norma, así que también funciona con
 * lo que la persona haya editado a mano.
 */

const NOMBRE = "banco-de-normativa";

function bajar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** "LEYES ORGÁNICAS" → "Leyes orgánicas". */
function titulo(t: string): string {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

export function descargarTexto(texto: string) {
  bajar(new Blob([texto], { type: "text/plain;charset=utf-8" }), `${NOMBRE}.txt`);
}

/** Word editable: título, un apartado por grupo y cada norma como viñeta. */
export async function descargarWord(texto: string) {
  // Se carga solo al pedirlo: es grande y casi nunca hace falta.
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const secciones = seccionesDelDocumento(texto);
  const hijos = [new Paragraph({ text: "Banco de normativa", heading: HeadingLevel.TITLE })];
  for (const s of secciones) {
    if (!s.titulo) {
      const entradilla = s.lineas.filter((l) => l !== "BANCO DE NORMATIVA").join(" ");
      if (entradilla) hijos.push(new Paragraph({ children: [new TextRun({ text: entradilla, italics: true })] }));
      continue;
    }
    hijos.push(new Paragraph({ text: titulo(s.titulo), heading: HeadingLevel.HEADING_1 }));
    for (const linea of s.lineas) {
      const esNorma = linea.startsWith("-");
      hijos.push(
        new Paragraph({
          text: linea.replace(/^-\s*/, ""),
          bullet: esNorma ? { level: 0 } : undefined,
        }),
      );
    }
  }
  const documento = new Document({
    creator: "Cuaderno",
    title: "Banco de normativa",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children: hijos }],
  });
  bajar(await Packer.toBlob(documento), `${NOMBRE}.docx`);
}

/**
 * PDF: se abre el documento maquetado para papel y la ventana de imprimir del
 * navegador, donde se elige «Guardar como PDF». Así no hace falta ninguna
 * librería de PDF, y sale con letra real (se puede buscar y copiar).
 */
export function descargarPdf(texto: string): boolean {
  const ventana = window.open("", "_blank");
  if (!ventana) return false;
  const html = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const cuerpo = seccionesDelDocumento(texto)
    .map((s) => {
      if (!s.titulo) {
        const entradilla = s.lineas.filter((l) => l !== "BANCO DE NORMATIVA").join(" ");
        return entradilla ? `<p class="entradilla">${html(entradilla)}</p>` : "";
      }
      const normas = s.lineas
        .map((l) => (l.startsWith("-") ? `<li>${html(l.replace(/^-\s*/, ""))}</li>` : `<p>${html(l)}</p>`))
        .join("");
      return `<section><h2>${html(titulo(s.titulo))}</h2><ul>${normas}</ul></section>`;
    })
    .join("");
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Banco de normativa</title>
<style>
  @page { margin: 2cm; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; }
  h1 { font-size: 20pt; margin: 0 0 4pt; }
  .entradilla { color: #555; font-style: italic; margin: 0 0 16pt; }
  h2 { font-size: 13pt; margin: 18pt 0 6pt; border-bottom: 1px solid #999; padding-bottom: 2pt; break-after: avoid; }
  ul { margin: 0; padding-left: 16pt; }
  li { margin: 0 0 5pt; break-inside: avoid; }
</style></head><body><h1>Banco de normativa</h1>${cuerpo}</body></html>`);
  ventana.document.close();
  ventana.focus();
  ventana.print();
  return true;
}
