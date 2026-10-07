// Exportação FICTÍCIA completa (dados + foto + assinaturas + ata + manifesto), montada como o app faz.
// Grava Vistoria.zip e Copia.zip na pasta indicada e imprime {id, recibo, codigo, nome}.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { aplicar, eventoFato, eventoSimples, novoFatoId } from "../../js/estado.js";
import { montarExportacao } from "../../js/exportacao.js";
import { catalogo, montarDemo, pacote, T } from "./demo.mjs";

const pasta = process.argv[2];
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]);
let e = montarDemo();
e = aplicar(e, eventoSimples("foto", "FT1", T, { id: "FT1", arquivo: "fotos/FT1.jpg", legenda: "Tanque de diesel",
  modulo: "A6", pergunta: "A6.ar.tipo", fato: null, participantes: false, usar_no_laudo: true, sha256: "", instante: T }));
for (const p of e.participantes)
  e = aplicar(e, eventoSimples("participante", p.id, T, { ...p, chegada: "13:30",
    assinatura: { tracos: [[[5, 30], [60, 10], [120, 35]]], largura: 200, altura: 60, instante: T } }, p));
e = aplicar(e, eventoFato(e, { id: novoFatoId(e), pergunta: "MFIM.ressalvas", origem: "constatado",
  valor: [{ parte: "Reclamada", texto: "A máquina mostrada não é a do período." }] }, T));
e = aplicar(e, eventoFato(e, { id: novoFatoId(e), pergunta: "MFIM.hora_fim", valor: "14:30", origem: "constatado" }, T));
const copia = await montarExportacao(e, pacote, catalogo, { FT1: jpeg }, new Date(2025, 7, 5, 14, 20));
const trava = "2025-08-05T14:35:00-03:00";
e = aplicar(e, eventoSimples("travar", e.id, trava, { travada_em: trava, fim: trava }));
const exp = await montarExportacao(e, pacote, catalogo, { FT1: jpeg }, new Date(2025, 7, 5, 14, 36));
writeFileSync(join(pasta, "Vistoria.zip"), Buffer.from(await exp.blob.arrayBuffer()));
writeFileSync(join(pasta, "Copia.zip"), Buffer.from(await copia.blob.arrayBuffer()));
process.stdout.write(JSON.stringify({ id: e.id, recibo: exp.recibo, codigo: exp.codigo, nome: exp.nome }));
