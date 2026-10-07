// Ponte com o aplicativo Android (Capacitor): envio em pedaços, recebidos e fora do aplicativo.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as n from "../js/nativo.js";

function aplicativoFalso(respostas = {}) {
  const chamadas = [];
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    nativePromise: async (plugin, metodo, opcoes) => {
      chamadas.push({ plugin, metodo, opcoes });
      return respostas[metodo];
    },
  };
  return chamadas;
}

test("fora do aplicativo: nada muda", () => {
  delete globalThis.Capacitor;
  assert.equal(n.ehNativo(), false);
});

test("arquivo grande vai em pedaços de 3 MB e chega inteiro", async () => {
  const chamadas = aplicativoFalso();
  const bytes = new Uint8Array(7 * 1024 * 1024).map((_, i) => i % 251);
  await n.compartilharNativo("Vistoria.zip", new Blob([bytes]), "application/zip");
  const partes = chamadas.filter((c) => c.metodo === "gravarParte");
  assert.deepEqual(partes.map((c) => c.opcoes.anexar), [false, true, true]);
  const junto = Uint8Array.from(partes.flatMap((c) => [...n.deBase64(c.opcoes.base64)]));
  assert.deepEqual(junto, bytes);
  const lote = partes[0].opcoes.lote;
  assert.ok(lote && partes.every((c) => c.opcoes.lote === lote));
  assert.deepEqual(chamadas.at(-1), { plugin: "Vistoria", metodo: "compartilhar",
    opcoes: { nome: "Vistoria.zip", tipo: "application/zip", lote } });
  delete globalThis.Capacitor;
});

test("arquivo vazio ainda é gravado (uma parte)", async () => {
  const chamadas = aplicativoFalso();
  await n.gravarNoAparelho("vazio.json", new Blob([]));
  assert.equal(chamadas.length, 1);
  delete globalThis.Capacitor;
});

test("recebidos pelo Abrir com: bytes, descrição e erro de leitura", async () => {
  aplicativoFalso({ pegarRecebidos: { arquivos: [
    { nome: "Pacote_1.vistoria", tipo: "application/octet-stream", base64: n.paraBase64(new TextEncoder().encode("{}")) },
    { nome: "x", erro: "sem permissão" }] } });
  const r = await n.recebidosNativos();
  assert.deepEqual(r.lista, [new TextEncoder().encode("{}")]);
  assert.match(r.recebido, /Pacote_1\.vistoria.*2 bytes.*x: erro sem permissão/);
  delete globalThis.Capacitor;
});

test("modo entrega não é interrompido por arquivo recebido", () => {
  assert.equal(n.deveAbrirRecebidos({ entrega: "#/assinar/P1" }), false);
  assert.equal(n.deveAbrirRecebidos({ entrega: null }), true);
});

test("duas gravações seguidas do mesmo arquivo não se misturam (fila e pasta própria)", async () => {
  const chamadas = [];
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    nativePromise: async (plugin, metodo, opcoes) => {
      await new Promise((r) => setTimeout(r, metodo === "gravarParte" ? 5 : 1));
      chamadas.push({ metodo, lote: opcoes.lote });
      return { local: "Downloads/x.zip" };
    },
  };
  const blob = new Blob([new Uint8Array(7 * 1024 * 1024)]);
  await Promise.all([n.compartilharNativo("x.zip", blob, "application/zip"), n.salvarNativo("x.zip", blob, "application/zip")]);
  const lotes = [...new Set(chamadas.map((c) => c.lote))];
  assert.equal(lotes.length, 2);
  // todas as chamadas do primeiro lote vêm antes de qualquer uma do segundo
  assert.deepEqual(chamadas.map((c) => c.lote), [...Array(4).fill(lotes[0]), ...Array(4).fill(lotes[1])]);
  assert.deepEqual(chamadas.map((c) => c.metodo).filter((m) => m !== "gravarParte"), ["compartilhar", "salvarEmDownloads"]);
  delete globalThis.Capacitor;
});
