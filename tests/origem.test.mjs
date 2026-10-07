// Origem de cada fato, "Constatado" vedado para atividade do período e contraditório.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as o from "../js/origem.js";
import { normalizar, vazio } from "../js/texto.js";

const catalogo = JSON.parse(readFileSync(new URL("../catalogo.json", import.meta.url), "utf8"));
const achar = (pid) => {
  for (const m of catalogo.modulos) for (const b of m.blocos) for (const p of b.perguntas) if (p.id === pid) return [m, p];
  throw new Error(pid);
};

test("texto: normalizar e vazio", () => {
  assert.equal(normalizar(" Ninguém "), "ninguem");
  assert.ok(vazio(null) && vazio("") && vazio([]) && vazio({}));
  assert.ok(!vazio(false) && !vazio(0) && !vazio("x"));
});

test("quem fala por padrão em cada etapa", () => {
  assert.equal(o.falantePadrao("entrevista"), "reclamante");
  assert.equal(o.falantePadrao("vistoria"), "constatado");
  assert.equal(o.falantePadrao("abertura"), "constatado");
});

test("Constatado não vale para atividade do período", () => {
  assert.equal(o.aceitaConstatado(...achar("A6.ab.operava")), false);
  assert.equal(o.aceitaConstatado(...achar("M1.atividades")), false);
  assert.equal(o.aceitaConstatado(...achar("A6.periodo")), false);
  assert.equal(o.aceitaConstatado(...achar("A4.tempo")), false);
  assert.equal(o.aceitaConstatado(...achar("A6.fonte_tempo")), false);
  assert.equal(o.aceitaConstatado(...achar("A6.atual")), true);
  assert.equal(o.aceitaConstatado(...achar("M0.data")), true);
  assert.equal(o.aceitaConstatado(...achar("M3.realizada")), true);
  assert.ok(o.MOTIVO_SEM_CONSTATADO.length > 20);
});

test("Concorda vira 'ambas'; Discorda vira 'divergem' com as duas versões", () => {
  const f = { id: "F1", pergunta: "A6.ab.operava", valor: true, origem: "reclamante" };
  assert.equal(o.aplicarPosicao(f, "concorda").origem, "ambas");
  const d = o.aplicarPosicao(f, "discorda", { versaoPropria: "Sim", versaoOutra: "Só o encarregado" });
  assert.deepEqual([d.origem, d.fala, d.versoes], ["divergem", "reclamante", { reclamante: "Sim", reclamada: "Só o encarregado" }]);
  const volta = o.aplicarPosicao(d, "nao_sabe");
  assert.deepEqual([volta.origem, volta.versoes, volta.posicao_outra], ["reclamante", undefined, "nao_sabe"]);
  assert.equal(f.origem, "reclamante"); // não altera o original
});

test("fala de terceiro ou constatado não tem contraditório", () => {
  const f = { id: "F2", origem: "constatado" };
  assert.deepEqual(o.aplicarPosicao(f, "concorda"), f);
});

test("participante define a origem e o lado", () => {
  assert.equal(o.origemDoParticipante({ qualidade: "Advogado(a) do(a) Reclamante" }), "manifestacao");
  assert.equal(o.origemDoParticipante({ qualidade: "Assistente técnico da Reclamada" }), "manifestacao");
  assert.equal(o.origemDoParticipante({ qualidade: "Preposto(a) da Reclamada" }), "reclamada");
  assert.equal(o.origemDoParticipante({ qualidade: "Reclamante" }), "reclamante");
  assert.equal(o.origemDoParticipante({ qualidade: "Paradigma" }), "terceiro");
  const ps = [{ id: "P1", qualidade: "Reclamante", presente: false }, { id: "P2", qualidade: "Reclamada" },
    { id: "P3", qualidade: "Reclamante" }];
  assert.equal(o.participanteDoLado(ps, "reclamante").id, "P3");
  assert.equal(o.participanteDoLado(ps, "terceiro"), null);
});

test("fato decisivo: posição e confirmação", () => {
  assert.deepEqual(o.pendenciasDecisivo({ decisivo: true }), ["posição da outra parte", "confirmação objetiva"]);
  assert.deepEqual(o.pendenciasDecisivo({ posicao_outra: "concorda", confirmacao: { tipo: "documento", detalhe: "" } }),
    ["ID do documento"]);
  assert.deepEqual(o.pendenciasDecisivo({ posicao_outra: "discorda", versoes: { reclamante: "Sim", reclamada: "" },
    confirmacao: { tipo: "vestigio" } }), ["versão da outra parte"]);
  assert.deepEqual(o.pendenciasDecisivo({ posicao_outra: "ausente", confirmacao: { tipo: "nenhuma", detalhe: "sem planilha" } }), []);
});

test("número no formato brasileiro (milhar com ponto, decimal com vírgula)", async () => {
  const { lerNumero } = await import("../js/texto.js");
  assert.equal(lerNumero("1.000"), 1000);
  assert.equal(lerNumero("1.000,5"), 1000.5);
  assert.equal(lerNumero("2,5"), 2.5);
  assert.equal(lerNumero("15"), 15);
  assert.equal(lerNumero(""), null);
  assert.equal(lerNumero("cerca de 10"), "cerca de 10");
});

test("rótulo da alegação: parte, documento e fonte; pacote antigo sem documento", () => {
  assert.equal(o.rotuloAlegacao({ id: "AL1", parte: "reclamante", documento: "Petição inicial", fonte: "ID a1b2c3d, p. 4" }),
    "AL1 · Reclamante · Petição inicial (ID a1b2c3d, p. 4)");
  assert.equal(o.rotuloAlegacao({ id: "AL2", parte: "reclamada", fonte: "" }), "AL2 · Reclamada · Contestação");
});
