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

export async function avaliarPacote(texto, catalogo) {
  let pacote;
  try {
    pacote = JSON.parse(String(texto).replace(/^\uFEFF/, ""));
  } catch {
    return { ok: false, erro: "O arquivo não é um pacote de vistoria (conteúdo ilegível)." };
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
