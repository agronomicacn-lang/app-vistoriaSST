// Integridade, zip e PDF: mesmas regras do PC; arquivos válidos sem bibliotecas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashLista, reciboDe } from "../js/integridade.js";
import { montarPdf, quebrar, winAnsi } from "../js/pdf.js";
import { crc32, montarZip } from "../js/zip.js";

const latin1 = (b) => Array.from(b, (x) => String.fromCharCode(x)).join("");

test("hash da lista e recibo iguais aos do PC", async () => {
  // valores calculados por laudo.vistoria_importar.hash_lista / recibo_de
  assert.equal(await hashLista({ "b.jpg": "2".repeat(64), "a.json": "1".repeat(64) }),
    "ca4e090a4ab70d76d6ae595607222510e0e6e236f696365fcfd479cd5b1fc6bc");
  assert.equal(await reciboDe("id-1", "a".repeat(64)), "25EB2D47");
});

test("zip: CRC-32 padrão e estrutura", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const z = montarZip([{ nome: "a.txt", dados: new TextEncoder().encode("oi") }], new Date(2025, 7, 5, 14, 30));
  assert.deepEqual([...z.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const fim = new DataView(z.buffer, z.length - 22);
  assert.equal(fim.getUint32(0, true), 0x06054b50);
  assert.equal(fim.getUint16(10, true), 1);
});

test("PDF: acentos em WinAnsi e quebra de linha", () => {
  assert.deepEqual(winAnsi("ção—≠"), [0xe7, 0xe3, 0x6f, 0x97, 0x3f]);
  const linhas = quebrar("palavra ".repeat(60), 10, 300);
  assert.ok(linhas.length > 3 && linhas.every((l) => l.length <= 70));
});

test("PDF: estrutura e xref", () => {
  const pdf = montarPdf([{ tipo: "titulo", texto: "Ata de diligência" },
    { tipo: "texto", texto: "Ação – teste (parênteses) \\ barra" },
    { tipo: "assinatura", nome: "Pedro", qualidade: "Reclamante", tracos: [[[0, 0], [10, 10]]], largura: 100, altura: 50, recusa: null }],
  { rodape: "código ABCD1234" });
  const s = latin1(pdf);
  assert.ok(s.startsWith("%PDF-1.4") && s.trimEnd().endsWith("%%EOF"));
  assert.ok(s.includes("(Ata de dilig\\352ncia)") && s.includes("\\(par\\352nteses\\) \\\\ barra"));
  const inicioXref = s.indexOf("\nxref\n") + 1; // a tabela, não o "xref" dentro de "startxref"
  const offsets = [...s.slice(inicioXref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  assert.ok(offsets.length >= 6);
  offsets.forEach((o, i) => assert.ok(s.startsWith(`${i + 1} 0 obj`, o), `objeto ${i + 1}`));
  assert.equal(Number(s.match(/startxref\n(\d+)/)[1]), inicioXref);
});

test("PDF: traços fora da área de assinatura ficam dentro da caixa", () => {
  const s = latin1(montarPdf([{ tipo: "assinatura", nome: "X", qualidade: "Y", tracos: [[[0, 0], [500, 300]]],
    largura: 100, altura: 50, recusa: null }]));
  const traco = s.split("\n").find((l) => / [ml] .* S$/.test(l) && !l.startsWith("0.5 w"));
  const xs = [...traco.matchAll(/(-?[\d.]+) (-?[\d.]+) [ml]/g)].map((m) => Number(m[1]));
  assert.ok(xs.every((x) => x >= 50 && x <= 290.01), traco);
});

test("PDF: linhas em maiúsculas quebram antes (letras largas não passam da margem)", async () => {
  const { larguraTexto } = await import("../js/pdf.js");
  const linhas = quebrar("JOÃO DA SILVA PEREIRA SOBRINHO ".repeat(6), 10, 495);
  assert.ok(linhas.every((l) => larguraTexto(l, 10) <= 495), linhas.join(" | "));
  assert.ok(larguraTexto("MMMM", 10) > larguraTexto("iiii", 10));
});
