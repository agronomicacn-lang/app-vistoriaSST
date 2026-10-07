// Gravações adiadas (digitação/ditado) podem ser forçadas antes de trocar de tela ou ir para o fundo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { adiado, gravarPendentes } from "../js/adiar.js";

test("gravarPendentes grava na hora o que estava esperando e só uma vez", async () => {
  const chamadas = [];
  let texto = "a";
  const salvar = adiado(() => chamadas.push(texto), 50);
  salvar();
  texto = "ab";
  salvar();
  gravarPendentes();
  assert.deepEqual(chamadas, ["ab"]);
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(chamadas, ["ab"]);
  gravarPendentes();
  assert.deepEqual(chamadas, ["ab"]);
});
