// Pacote do processo (gerado no PC pelo PREPARAR VISTORIA): leitura e conferência da integridade.
// JSON canônico igual ao do PC: json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).
// O pacote só tem textos, inteiros, booleanos e null (sem números fracionários), então a
// serialização de números coincide nas duas linguagens.

export function canonico(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(",")}}`;
}

export async function sha256Hex(dados) {
  const bytes = typeof dados === "string" ? new TextEncoder().encode(dados) : dados;
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPacote(pacote) {
  const { sha256, ...resto } = pacote;
  return sha256Hex(canonico(resto));
}

// Bytes do arquivo como chegaram ao celular. O Chrome do Android pode salvar o pacote ainda compactado
// (gzip do servidor) e com o nome "arquivo.bin": descompacta antes de ler.
async function textoDosBytes(bytes) {
  const inicio = String.fromCharCode(...bytes.subarray(0, 5));
  if (inicio.startsWith("PK"))
    throw new Error("Este arquivo é um .zip (talvez a exportação de uma diligência), não o pacote do processo.");
  if (inicio === "%PDF-") throw new Error("Este arquivo é um PDF, não o pacote do processo.");
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    bytes = new Uint8Array(await new Response(fluxo).arrayBuffer());
  }
  return new TextDecoder().decode(bytes);
}

export async function avaliarPacote(texto, catalogo) {
  let pacote;
  try {
    if (texto instanceof Uint8Array) texto = await textoDosBytes(texto);
  } catch (e) {
    return { ok: false, erro: e.message };
  }
  try {
    pacote = JSON.parse(String(texto).replace(/^\uFEFF/, ""));
  } catch {
    const tamanho = new TextEncoder().encode(String(texto)).length;
    return { ok: false, erro: `O arquivo não é um pacote de vistoria (conteúdo ilegível; chegaram ${tamanho} bytes).` };
  }
  if (!pacote || pacote.tipo !== "pacote_vistoria" || pacote.versao !== 1)
    return { ok: false, erro: "O arquivo não é um pacote de vistoria gerado pelo PREPARAR VISTORIA." };
  if (!pacote.processo?.numero)
    return { ok: false, erro: "O pacote não traz o número do processo. Gere de novo no PC." };
  if ((await hashPacote(pacote)) !== pacote.sha256)
    return { ok: false, erro: "O pacote foi alterado depois de gerado (a integridade não confere). Gere de novo no PC." };
  const avisos = [];
  if (pacote.catalogo_versao !== catalogo.versao)
    avisos.push(`O pacote foi gerado com as perguntas da versão ${pacote.catalogo_versao}; ` +
      `o app usa a versão ${catalogo.versao}.`);
  return { ok: true, pacote, avisos };
}
