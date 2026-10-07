// Gera teste.zip e teste.pdf na pasta indicada, para o PC conferir (tests/test_app_js.py).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { montarPdf } from "../../js/pdf.js";
import { montarZip } from "../../js/zip.js";

const pasta = process.argv[2];
const enc = new TextEncoder();
writeFileSync(join(pasta, "teste.zip"), montarZip([
  { nome: "fotos/FT1.jpg", dados: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]) },
  { nome: "ação.txt", dados: enc.encode("olá") }]));
const itens = [{ tipo: "titulo", texto: "Ata de diligência" }];
for (let i = 1; i <= 80; i++) itens.push({ tipo: "texto", texto: `Linha ${i}` });
itens.push({ tipo: "texto", texto: "Ação – teste (parênteses) \\ barra" });
itens.push({ tipo: "assinatura", nome: "Pedro Fictício", qualidade: "Reclamante", tracos: [[[5, 30], [60, 10], [120, 35]]],
  largura: 200, altura: 60, recusa: null });
writeFileSync(join(pasta, "teste.pdf"), montarPdf(itens, { rodape: "código ABCD1234" }));
