// Pacote recebido pelo "Compartilhar": leitura do que o service worker guardou (formato novo e antigo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerRecebidos } from "../js/recebido.js";

// imitação mínima do Cache do navegador (match/delete por nome)
function cacheFalso(entradas) {
  const m = new Map(Object.entries(entradas));
  return {
    match: async (k) => m.get(k)?.clone(),
    delete: async (k) => m.delete(k),
    tamanho: () => m.size,
  };
}
const bytes = (s) => new TextEncoder().encode(s);

test("formato novo: um arquivo por entrada, na ordem; tudo é apagado depois de lido", async () => {
  const c = cacheFalso({
    "pacote-recebido": new Response("", { headers: { "X-Quantos": "2", "X-Recebido": encodeURIComponent("pacote: 2 arquivos") } }),
    "pacote-recebido/0": new Response("Pacote_x.vistoria"),
    "pacote-recebido/1": new Response("{}"),
  });
  const r = await lerRecebidos(c);
  assert.deepEqual(r.lista, [bytes("Pacote_x.vistoria"), bytes("{}")]);
  assert.equal(r.recebido, "pacote: 2 arquivos");
  assert.equal(c.tamanho(), 0);
});

test("formato antigo (gravado pela versão anterior do app): o arquivo está na própria entrada", async () => {
  const c = cacheFalso({ "pacote-recebido": new Response("{}") });
  const r = await lerRecebidos(c);
  assert.deepEqual(r.lista, [bytes("{}")]);
  assert.equal(c.tamanho(), 0);
});

test("nada guardado (já foi aberto antes): null, sem aviso de erro", async () => {
  assert.equal(await lerRecebidos(cacheFalso({})), null);
});
