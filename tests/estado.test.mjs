// Estado da diligência = vistoria.json, reconstruído dos eventos (lista que só cresce).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  aplicar, etapas, eventoFato, eventoIniciar, eventoSimples, isoLocal, modulosAtivos, novoFatoId,
  novoFotoId, perguntaRespondida, perguntasDoModulo, reconstruir,
} from "../js/estado.js";

const ler = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const catalogo = ler("../catalogo.json");
const pacote = ler("./fixtures/pacote_demo.vistoria");
const T = "2025-08-05T13:32:00-03:00";
const iniciar = () => reconstruir([eventoIniciar(pacote, catalogo, "dil-1", T)]);
const comFato = (e, pergunta, valor, origem = "constatado") =>
  aplicar(e, eventoFato(e, { id: novoFatoId(e), pergunta, valor, origem }, T));

test("iniciar cria a vistoria no formato do PC", () => {
  const e = iniciar();
  assert.equal(e.tipo, "vistoria");
  assert.equal(e.versao, 1);
  assert.equal(e.processo.numero, pacote.processo.numero);
  assert.equal(e.pacote_sha256, pacote.sha256);
  assert.equal(e.inicio, T);
  assert.equal(e.travada_em, null);
  assert.deepEqual(e.participantes.map((p) => p.id), ["P1", "P2", "P3", "P4"]);
  assert.equal(e.eventos.length, 1);
});

test("fato novo, edição, exclusão e restauração", () => {
  let e = iniciar();
  const f = { id: novoFatoId(e), pergunta: "M0.local", valor: "Sede", origem: "constatado" };
  e = aplicar(e, eventoFato(e, f, T));
  e = aplicar(e, eventoFato(e, { ...f, valor: "Galpão" }, T));
  assert.equal(e.fatos.length, 1);
  assert.equal(e.fatos[0].valor, "Galpão");
  assert.equal(e.fatos[0].instante, T);
  assert.equal(e.eventos.at(-1).antes.valor, "Sede");
  e = aplicar(e, eventoSimples("fato_excluido", "F1", T, null, e.fatos[0]));
  assert.deepEqual([e.fatos.length, e.lixeira.length], [0, 1]);
  assert.equal(novoFatoId(e), "F2");
  e = aplicar(e, eventoSimples("fato_restaurado", "F1", T));
  assert.deepEqual([e.fatos[0].valor, e.lixeira.length], ["Galpão", 0]);
});

test("reabrir o app reconstrói o mesmo estado a partir dos eventos", () => {
  let e = iniciar();
  e = comFato(e, "M0.data", "05/08/2025");
  e = comFato(e, "M3.realizada", false);
  e = aplicar(e, eventoSimples("alegacao", "AL1", T, { id: "AL1", situacao: "abordada", motivo: "", fatos: [] }));
  e = aplicar(e, eventoSimples("fato_excluido", "F1", T, null, e.fatos[0]));
  assert.deepEqual(reconstruir(e.eventos), e);
  assert.equal(reconstruir([]), null);
});

test("perguntas condicionais e módulos acionados", () => {
  let e = iniciar();
  const ids = () => modulosAtivos(e, catalogo, pacote).map((m) => m.id);
  assert.ok(ids().includes("A6") && ids().includes("MQ") && !ids().includes("A8"));
  const m3 = catalogo.modulos.find((m) => m.id === "M3");
  assert.ok(!perguntasDoModulo(m3, e).some((p) => p.id === "M3.motivo"));
  e = comFato(e, "M3.realizada", false);
  assert.ok(perguntasDoModulo(m3, e).some((p) => p.id === "M3.motivo"));
  e = comFato(e, "M1.marcadores", ["eletricidade"], "reclamante");
  e = comFato(e, "A4.expurgo", true, "reclamante");
  e = aplicar(e, eventoSimples("modulo_aberto", "A9", T));
  assert.ok(["A8", "A13", "A9"].every((x) => ids().includes(x)));
  const m2 = catalogo.modulos.find((m) => m.id === "M2");
  assert.deepEqual(perguntasDoModulo(m2, e).map((p) => p.id), ["M2.alegacoes"]);
});

test("roteiro: etapas com progresso e bloqueios", () => {
  let e = iniciar();
  e = comFato(e, "M0.data", "05/08/2025");
  const r = etapas(e, catalogo, pacote, [{ modulo: "M0" }]);
  assert.deepEqual(r.map((x) => x.id), catalogo.etapas.map((x) => x.id));
  assert.equal(r[0].situacao, "Em andamento");
  assert.equal(r[0].bloqueios, 1);
  assert.deepEqual([r[0].modulos[0].respondidas, r[0].modulos[0].total], [1, 13]);
  assert.equal(r[3].situacao, "Sem módulos acionados");
});

test("instante local com fuso", () => {
  const d = new Date(Date.UTC(2025, 7, 5, 16, 32, 0));
  const s = isoLocal(d);
  assert.match(s, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.equal(new Date(s).getTime(), d.getTime());
});

test("foto: metadados no estado e id sequencial", () => {
  let e = iniciar();
  assert.equal(novoFotoId(e), "FT1");
  const foto = { id: "FT1", arquivo: "fotos/FT1.jpg", legenda: "", modulo: "M3", pergunta: "M3.fotos", fato: null,
    participantes: false, usar_no_laudo: true, sha256: "x", instante: T };
  e = aplicar(e, eventoSimples("foto", "FT1", T, foto));
  e = aplicar(e, eventoSimples("foto", "FT1", T, { ...foto, legenda: "Galpão" }));
  assert.deepEqual([e.fotos.length, e.fotos[0].legenda, novoFotoId(e)], [1, "Galpão", "FT2"]);
  const m3 = catalogo.modulos.find((m) => m.id === "M3");
  assert.ok(perguntaRespondida(m3.blocos[0].perguntas.find((p) => p.id === "M3.fotos"), e, pacote));
});

test("assinatura: respondida quando todos os presentes assinaram ou recusaram", () => {
  let e = iniciar();
  const presenca = catalogo.modulos[0].blocos[0].perguntas.find((p) => p.id === "M0.presenca");
  assert.equal(perguntaRespondida(presenca, e, pacote), false);
  for (const p of e.participantes)
    e = aplicar(e, eventoSimples("participante", p.id, T, p.id === "P2" ? { ...p, recusou: true, motivo: "orientação" }
      : { ...p, assinatura: { tracos: [[[0, 0], [5, 5]]], largura: 10, altura: 10 } }, p));
  assert.equal(perguntaRespondida(presenca, e, pacote), true);
});

test("depois de travar nada muda", () => {
  let e = comFato(iniciar(), "M0.data", "05/08/2025");
  e = aplicar(e, eventoSimples("travar", e.id, T, { travada_em: T, fim: T }));
  assert.deepEqual([e.travada_em, e.fim], [T, T]);
  assert.throws(() => comFato(e, "M0.local", "Sede"), /encerrada e travada/);
  assert.deepEqual(reconstruir(e.eventos), e);
});

test("evento gravado depois do travamento não impede reabrir a diligência", () => {
  let e = comFato(iniciar(), "M0.data", "05/08/2025");
  e = aplicar(e, eventoSimples("travar", e.id, T, { travada_em: T, fim: T }));
  const tardio = { instante: T, tipo: "fato", alvo: "F9", antes: null,
    depois: { id: "F9", pergunta: "M0.local", valor: "x", origem: "constatado" } };
  const r = reconstruir([...e.eventos, tardio]);
  assert.equal(r.fatos.length, 1);
  assert.equal(r.eventos.at(-1), tardio);
});

test("quem se retirou antes da ata não precisa assinar nem recusar", () => {
  let e = iniciar();
  const presenca = catalogo.modulos[0].blocos[0].perguntas.find((p) => p.id === "M0.presenca");
  for (const p of e.participantes)
    e = aplicar(e, eventoSimples("participante", p.id, T, p.id === "P3" ? { ...p, saida: "14:00" }
      : { ...p, assinatura: { tracos: [[[0, 0], [1, 1]]], largura: 2, altura: 2 } }, p));
  assert.equal(perguntaRespondida(presenca, e, pacote), true);
});

test("a foto opcional dos participantes não conta no progresso (LGPD: mínimo de dados)", () => {
  assert.equal(etapas(iniciar(), catalogo, pacote, [])[0].modulos[0].total, 13);
});
