// Fila de gravação: nada se perde quando uma gravação falha; a ordem é mantida.
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarFila } from "../js/fila.js";

test("gravação que falha fica pendente e é refeita antes das novas, na ordem", async () => {
  const gravados = [];
  let falhar = true;
  const falhas = [];
  let salvos = 0;
  const fila = criarFila(async (x) => {
    if (x === "b" && falhar) throw new Error("cota cheia");
    gravados.push(x);
  }, { aoFalhar: (e, n) => falhas.push(n), aoSalvar: () => salvos++ });
  await fila.acrescentar("a");
  await fila.acrescentar("b");
  await fila.acrescentar("c");
  assert.deepEqual(gravados, ["a"]);
  assert.equal(fila.pendentes, 2);
  assert.ok(falhas.length >= 2);
  falhar = false;
  await fila.tentarDeNovo();
  assert.deepEqual(gravados, ["a", "b", "c"]);
  assert.equal(fila.pendentes, 0);
  assert.ok(salvos >= 2);
});
