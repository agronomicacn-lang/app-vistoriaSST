// Pacote do processo: JSON canônico e hash iguais aos do PC; recusa de arquivo alterado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avaliarPacote, canonico, hashPacote } from "../js/pacote.js";

const catalogo = JSON.parse(readFileSync(new URL("../catalogo.json", import.meta.url), "utf8"));
const demo = readFileSync(new URL("./fixtures/pacote_demo.vistoria", import.meta.url), "utf8");

test("canônico igual ao do PC: chaves em ordem, sem espaços, acentos sem escape", () => {
  assert.equal(canonico({ b: [1, "ç"], a: { d: null, c: true } }), '{"a":{"c":true,"d":null},"b":[1,"ç"]}');
});

test("pacote de demonstração gerado no PC é aceito", async () => {
  const r = await avaliarPacote(demo, catalogo);
  assert.equal(r.ok, true);
  assert.deepEqual(r.avisos, []);
  assert.equal(r.pacote.processo.numero, "0010000-00.2025.5.18.0101");
});

test("pacote alterado é recusado", async () => {
  const r = await avaliarPacote(demo.replace("Pedro Fictício", "Pedro Alterado"), catalogo);
  assert.equal(r.ok, false);
  assert.match(r.erro, /alterado/);
});

test("arquivo que não é pacote", async () => {
  assert.match((await avaliarPacote("nada", catalogo)).erro, /não é um pacote/);
  assert.match((await avaliarPacote('{"tipo":"vistoria"}', catalogo)).erro, /não é um pacote/);
});

test("versão diferente do catálogo gera aviso, não recusa", async () => {
  const p = JSON.parse(demo);
  p.catalogo_versao = "0.9.0";
  p.sha256 = await hashPacote(p);
  const r = await avaliarPacote(JSON.stringify(p), catalogo);
  assert.equal(r.ok, true);
  assert.match(r.avisos[0], /0\.9\.0/);
});
