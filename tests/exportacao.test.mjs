// Conteúdo da ata e exportação final (zip + manifesto + recibo), com os mesmos hashes do PC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { linhasDaAta } from "../js/ata.js";
import { aplicar, eventoSimples } from "../js/estado.js";
import { montarExportacao } from "../js/exportacao.js";
import { hashLista } from "../js/integridade.js";
import { catalogo, montarDemo, pacote, T } from "./ferramentas/demo.mjs";

test("ata: conteúdo oficial, sem as versões detalhadas", () => {
  const e = montarDemo();
  const texto = JSON.stringify(linhasDaAta(e, pacote, catalogo, {}));
  assert.ok(texto.includes("Ata de diligência pericial") && texto.includes("Pedro Fictício"));
  assert.ok(texto.includes("Máquinas vendidas pela Reclamada") && texto.includes("PRÉVIA"));
  assert.ok(!texto.includes("Só o encarregado operava a bomba") && !texto.includes("Operava a bomba todo dia"));
  const comHash = JSON.stringify(linhasDaAta(e, pacote, catalogo, { hashDados: "abcdef1234" }));
  assert.ok(comHash.includes("ABCDEF12") && !comHash.includes("PRÉVIA"));
});

test("exportação travada: ata, manifesto e recibo; cópia de segurança sem ata", async () => {
  let e = montarDemo();
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  e = aplicar(e, eventoSimples("foto", "FT1", T, { id: "FT1", arquivo: "fotos/FT1.jpg", legenda: "Tanque", modulo: "A6",
    pergunta: "A6.ar.tipo", fato: null, participantes: false, usar_no_laudo: true, sha256: "", instante: T }));
  const copia = await montarExportacao(e, pacote, catalogo, { FT1: jpeg }, new Date(2025, 7, 5, 14, 20));
  assert.equal(copia.recibo, null);
  assert.ok(copia.nome.startsWith("Copia_seguranca_") && !("ata.pdf" in copia.manifesto.arquivos));
  e = aplicar(e, eventoSimples("travar", e.id, T, { travada_em: T, fim: T }));
  const exp = await montarExportacao(e, pacote, catalogo, { FT1: jpeg }, new Date(2025, 7, 5, 14, 36));
  assert.equal(exp.nome, "Vistoria_0010000-00.2025.5.18.0101_20250805-1436.zip");
  assert.deepEqual(Object.keys(exp.manifesto.arquivos).sort(), ["ata.pdf", "fotos/FT1.jpg", "vistoria.json"]);
  assert.equal(exp.manifesto.sha256_total, await hashLista(exp.manifesto.arquivos));
  assert.equal(exp.codigo, exp.manifesto.sha256_dados.slice(0, 8).toUpperCase());
  assert.match(exp.recibo, /^[0-9A-F]{8}$/);
});

test("exportação lê cada foto uma vez, monta o zip como Blob e entrega a ata à parte", async () => {
  let e = montarDemo();
  e = aplicar(e, eventoSimples("foto", "FT1", T, { id: "FT1", arquivo: "fotos/FT1.jpg", legenda: "", modulo: "A6",
    pergunta: "A6.ar.tipo", fato: null, participantes: false, usar_no_laudo: true, sha256: "", instante: T }));
  e = aplicar(e, eventoSimples("travar", e.id, T, { travada_em: T, fim: T }));
  const foto = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
  let leituras = 0;
  const ler = foto.arrayBuffer.bind(foto);
  foto.arrayBuffer = () => { leituras++; return ler(); };
  const exp = await montarExportacao(e, pacote, catalogo, { FT1: foto });
  assert.ok(exp.blob instanceof Blob && !("zip" in exp));
  assert.equal(leituras, 1);
  assert.ok(exp.ata instanceof Uint8Array && exp.ata.length > 100);
  const bytes = new Uint8Array(await exp.blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 3, 4]);
  assert.equal(exp.tamanho, bytes.length);
});

test("ata: quem se retirou antes da assinatura aparece como tal", () => {
  let e = montarDemo();
  const p = e.participantes[2];
  e = aplicar(e, eventoSimples("participante", p.id, T, { ...p, saida: "14:00" }, p));
  const item = linhasDaAta(e, pacote, catalogo, {}).find((i) => i.tipo === "assinatura" && i.nome === p.nome);
  assert.equal(item.observacao, "retirou-se às 14:00, antes da assinatura da ata");
});

test("exportação recusa foto adulterada ou sem arquivo (o recibo liberaria a exclusão)", async () => {
  let e = montarDemo();
  e = aplicar(e, eventoSimples("foto", "FT1", T, { id: "FT1", arquivo: "fotos/FT1.jpg", legenda: "", modulo: "A6",
    pergunta: "A6.ar.tipo", fato: null, participantes: false, usar_no_laudo: true, sha256: "0".repeat(64), instante: T }));
  e = aplicar(e, eventoSimples("travar", e.id, T, { travada_em: T, fim: T }));
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  await assert.rejects(montarExportacao(e, pacote, catalogo, { FT1: jpeg }), /FT1 não confere/);
  await assert.rejects(montarExportacao(e, pacote, catalogo, {}), /FT1 não está no aparelho/);
});
