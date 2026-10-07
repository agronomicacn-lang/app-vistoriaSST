// Motor de faltas (catálogo v1, M-Fim): cada regra que trava o encerramento.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aplicar, eventoFato, eventoIniciar, eventoSimples, novoFatoId, reconstruir } from "../js/estado.js";
import { calcularFaltas } from "../js/faltas.js";

const ler = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const catalogo = ler("../catalogo.json");
const pacote = ler("./fixtures/pacote_demo.vistoria");
const T = "2025-08-05T13:32:00-03:00";
let e;
const novo = () => reconstruir([eventoIniciar(pacote, catalogo, "d", T)]);
const fato = (pergunta, valor, origem = "constatado", extra = {}) => {
  e = aplicar(e, eventoFato(e, { id: novoFatoId(e), pergunta, valor, origem, ...extra }, T));
  return e.fatos.at(-1);
};
const faltas = () => calcularFaltas(e, catalogo, pacote);
const regras = () => faltas().map((f) => f.regra);

test("diligência recém-aberta: alegações e quesito sem observação travam", () => {
  e = novo();
  const r = faltas();
  assert.equal(r.filter((f) => f.regra === "alegacao_sem_situacao").length, pacote.alegacoes.length);
  const q = pacote.quesitos[0];
  assert.ok(r.some((f) => f.regra === "quesito_sem_observacao" && f.alvo === `${q.origem} ${q.numero}`));
  assert.match(r[0].texto, /^Alegação sem situação: AL1 — /);
});

test("alegação 'não se aplica' exige motivo", () => {
  e = novo();
  e = aplicar(e, eventoSimples("alegacao", "AL1", T, { id: "AL1", situacao: "nao_se_aplica", motivo: "", fatos: [] }));
  assert.ok(faltas().some((f) => f.alvo === "AL1"));
  e = aplicar(e, eventoSimples("alegacao", "AL1", T, { id: "AL1", situacao: "nao_se_aplica", motivo: "Pedido retirado", fatos: [] }));
  assert.ok(!faltas().some((f) => f.alvo === "AL1"));
});

test("fato decisivo incompleto", () => {
  e = novo();
  const f = fato("A6.ab.operava", true, "reclamante", { decisivo: true });
  const x = faltas().find((y) => y.alvo === f.id);
  assert.equal(x.regra, "decisivo_incompleto");
  assert.match(x.texto, /falta posição da outra parte, confirmação objetiva/);
  assert.deepEqual([x.modulo, x.pergunta], ["A6", "A6.ab.operava"]);
});

test("periculosidade só com relato do reclamante exige quem confirma (ou motivo)", () => {
  e = novo();
  fato("A6.tr.volume", 1000, "reclamante");
  assert.ok(regras().includes("periculosidade_sem_corroboracao"));
  fato("A6.confirma", "Ninguém", "reclamante");
  assert.ok(regras().includes("periculosidade_sem_corroboracao"));
  fato("A6.confirma_motivo", "Não havia planilha de abastecimento", "reclamante");
  assert.ok(!regras().includes("periculosidade_sem_corroboracao"));
});

test("periculosidade com relato convergente não trava", () => {
  e = novo();
  fato("A6.tr.volume", 1000, "ambas");
  assert.ok(!regras().includes("periculosidade_sem_corroboracao"));
});

test("atividade sem período ou meses", () => {
  e = novo();
  fato("M1.atividades", [{ descricao: "Abastecia", periodo: { ini: "03/2021", fim: "11/2023", meses: {} } }], "reclamante");
  fato("A4.equip", "Costal", "ambas");
  const per = () => faltas().filter((f) => f.regra === "atividade_sem_periodo").map((f) => f.pergunta).sort();
  assert.deepEqual(per(), ["A4.periodo", "M1.atividades"]);
  fato("A4.periodo", { ini: "03/2021", fim: "11/2023", meses: { "2021/22": [10] } }, "ambas");
  assert.deepEqual(per(), ["M1.atividades"]);
});

test("documento solicitado sem prazo e antecedência curta sem justificativa", () => {
  e = novo();
  fato("M4.documentos", [{ documento: "PGRTR", situacao: "Solicitado" }, { documento: "ASO", situacao: "Já nos autos", id: "123" }]);
  fato("M0.antecedencia", 3);
  const outras = regras().filter((r) => r !== "alegacao_sem_situacao" && r !== "quesito_sem_observacao");
  assert.deepEqual(outras, ["documento_sem_prazo", "antecedencia_sem_justificativa"]);
  fato("M0.antecedencia_just", "Urgência determinada pelo juízo");
  assert.ok(!regras().includes("antecedencia_sem_justificativa"));
});

test("manifestação do advogado do reclamante não corrobora periculosidade", () => {
  e = novo();
  const adv = e.participantes.find((p) => /advogad/i.test(p.qualidade) && /reclamante/i.test(p.qualidade));
  fato("A6.tr.volume", 1000, "manifestacao", { falante: adv.id });
  assert.ok(regras().includes("periculosidade_sem_corroboracao"));
});
