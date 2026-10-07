// Período e meses por ano-safra; o resumo tem de ser o mesmo texto que o PC grava.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../js/meses.js";

test("ordem dos meses começa em julho", () => {
  assert.deepEqual(m.ordenarMeses([1, 10, 12, 11]), [10, 11, 12, 1]);
});

test("resumo agrupa safras iguais (mesmo texto do PC)", () => {
  assert.equal(m.resumoMeses({ "2021/22": [10, 11, 12, 1], "2022/23": [10, 11, 12, 1] }),
    "out–jan (safras 2021/22 e 2022/23)");
  assert.equal(m.resumoMeses({ "2020/21": [], "2021/22": [10, 11, 12, 1], "2022/23": [1, 10, 11, 12], "2023/24": [] }),
    "out–jan (safras 2021/22 e 2022/23); sem exposição informada em 2020/21 e 2023/24");
});

test("meses isolados e safra vazia", () => {
  assert.equal(m.resumoMeses({ "2021/22": [10, 12], "2022/23": [] }),
    "out, dez (safra 2021/22); sem exposição informada em 2022/23");
});

test("ano todo e vazio", () => {
  assert.equal(m.resumoMeses({ "2021/22": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }), "Não há: ano todo");
  assert.equal(m.resumoMeses({}), "");
});

test("safras do período", () => {
  assert.deepEqual(m.safrasDoPeriodo("03/2021", "11/2023"), ["2020/21", "2021/22", "2022/23", "2023/24"]);
  assert.deepEqual(m.safrasDoPeriodo("11/2023", "03/2021"), []);
  assert.equal(m.safraDe({ mes: 6, ano: 2022 }), "2021/22");
});

test("grade da safra marca o que está dentro do período", () => {
  const g = m.mesesDaSafra("2020/21", "03/2021", "11/2023");
  assert.equal(g.length, 12);
  assert.deepEqual(g[0], { mes: 7, ano: 2020, dentro: false });
  assert.deepEqual(g.find((c) => c.mes === 3), { mes: 3, ano: 2021, dentro: true });
});

test("período fora do contrato é apontado", () => {
  const c = { admissao: "01/03/2021", demissao: "30/11/2023" };
  assert.deepEqual(m.validarPeriodo({ ini: "03/2021", fim: "11/2023", meses: { "2021/22": [10] } }, c), []);
  const p = m.validarPeriodo({ ini: "01/2021", fim: "12/2023", meses: { "2021/22": [10] } }, c);
  assert.ok(p.includes("Começa antes da admissão (03/2021)."));
  assert.ok(p.includes("Termina depois da demissão (11/2023)."));
  assert.equal(m.validarPeriodo({ ini: "05/2022", fim: "02/2022", meses: { "2021/22": [1] } }, c)[0],
    "O fim é anterior ao início.");
});

test("período sem meses ou sem datas não está completo", () => {
  assert.equal(m.periodoCompleto({ ini: "03/2021", fim: "11/2023", meses: { "2021/22": [] } }), false);
  assert.equal(m.periodoCompleto({ ini: "", fim: "11/2023", meses: { "2021/22": [10] } }), false);
  assert.equal(m.periodoCompleto(undefined), false);
  assert.match(m.validarPeriodo({ ini: "03/2021", fim: "06/2021", meses: { "2020/21": [3, 8] } })[0],
    /fora do período: ago\/2020/);
});

test("período invertido por um instante não apaga os meses marcados", () => {
  const meses = { "2021/22": [10, 11] };
  assert.deepEqual(m.ajustarMeses(meses, "03/2024", "11/2023"), meses);
  assert.deepEqual(m.ajustarMeses(meses, "03/2021", "06/2022"), { "2020/21": [], "2021/22": [10, 11] });
});
