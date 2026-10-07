// Exportação (spec §4.2 e §7): vistoria.json + fotos originais + ata.pdf + manifest.json num zip.
// Ordem: dados travados → sha256_dados → ata com o código → sha256_total (cobre tudo, ata inclusive).
// Sem travamento, sai a cópia de segurança (sem ata), que o PC recusa importar.
// As fotos são lidas uma de cada vez (hash e CRC) e entram no zip como o Blob original, sem cópia:
// assim uma diligência com muitas fotos não estoura a memória do celular.
import { linhasDaAta } from "./ata.js";
import { exportarVistoria } from "./estado.js";
import { hashLista, reciboDe } from "./integridade.js";
import { sha256Hex } from "./pacote.js";
import { montarPdf } from "./pdf.js";
import { crc32, partesDoZip } from "./zip.js";

const enc = new TextEncoder();
const p2 = (n) => String(n).padStart(2, "0");
const entrada = (nome, bytes) => ({ nome, dados: bytes, crc: crc32(bytes), tamanho: bytes.length });

// fotos: {id: Blob | Uint8Array} com o arquivo original de cada foto
export async function montarExportacao(estado, pacote, catalogo, fotos, agora = new Date()) {
  const v = exportarVistoria(estado);
  const json = enc.encode(JSON.stringify(v));
  const entradas = [entrada("vistoria.json", json)];
  const hashes = { "vistoria.json": await sha256Hex(json) };
  for (const f of v.fotos) {
    const original = fotos[f.id];
    if (!original) throw new Error(`O arquivo da foto ${f.id} não está no aparelho.`);
    const bytes = original instanceof Uint8Array ? original : new Uint8Array(await original.arrayBuffer());
    const hash = await sha256Hex(bytes);
    if (f.sha256 && hash !== f.sha256) throw new Error(`A foto ${f.id} não confere com o original gravado no aparelho.`);
    entradas.push({ nome: f.arquivo, dados: original, crc: crc32(bytes), tamanho: bytes.length });
    hashes[f.arquivo] = hash;
  }
  const sha256Dados = await hashLista(hashes);
  const codigo = sha256Dados.slice(0, 8).toUpperCase();
  const travada = Boolean(v.travada_em);
  let ata = null;
  if (travada) {
    ata = montarPdf(linhasDaAta(v, pacote, catalogo, { hashDados: sha256Dados }),
      { rodape: `Proc. ${v.processo.numero} · código ${codigo}` });
    entradas.push(entrada("ata.pdf", ata));
    hashes["ata.pdf"] = await sha256Hex(ata);
  }
  const sha256Total = await hashLista(hashes);
  const manifesto = { arquivos: hashes, sha256_dados: sha256Dados, sha256_total: sha256Total,
    app_versao: v.app_versao, travada_em: v.travada_em };
  entradas.push(entrada("manifest.json", enc.encode(JSON.stringify(manifesto))));
  const blob = new Blob(partesDoZip(entradas, agora), { type: "application/zip" });
  const carimbo = `${agora.getFullYear()}${p2(agora.getMonth() + 1)}${p2(agora.getDate())}-${p2(agora.getHours())}${p2(agora.getMinutes())}`;
  const numero = v.processo.numero.replace(/[^\w.-]/g, "-");
  return {
    blob, tamanho: blob.size, ata,
    nome: `${travada ? "Vistoria" : "Copia_seguranca"}_${numero}_${carimbo}.zip`,
    manifesto, codigo,
    recibo: travada ? await reciboDe(v.id, sha256Total) : null,
  };
}
