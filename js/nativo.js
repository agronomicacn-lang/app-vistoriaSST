// Diferenças do aplicativo Android (Capacitor) em relação ao navegador. Fora do aplicativo nada
// aqui é chamado: as telas seguem usando as APIs do navegador. Dentro dele, o plugin Java
// "Vistoria" (sistema/android/VistoriaPlugin.java) grava, compartilha, abre e recebe arquivos.
const PARTE = 3 * 1024 * 1024; // múltiplo de 3: cada pedaço vira base64 sem "=" no meio

export const ehNativo = () => Boolean(globalThis.Capacitor?.isNativePlatform?.());

function chamar(metodo, opcoes = {}) {
  const cap = globalThis.Capacitor;
  const plugin = cap?.Plugins?.Vistoria;
  if (typeof plugin?.[metodo] === "function") return plugin[metodo](opcoes);
  return cap.nativePromise("Vistoria", metodo, opcoes);
}

export function paraBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function deBase64(b64) {
  const s = atob(b64 ?? "");
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// uma operação de arquivo por vez, cada uma na sua pasta ("lote") do cache: dois toques seguidos
// (ou Compartilhar e depois Salvar) nunca misturam os pedaços nem zeram um arquivo em uso
let fila = Promise.resolve();
function emFila(tarefa) {
  const r = fila.then(tarefa, tarefa);
  fila = r.catch(() => {});
  return r;
}
let contador = 0;
const novoLote = () => `${Date.now().toString(36)}${(contador++).toString(36)}`;

// o arquivo vai para o cache do aplicativo em pedaços (um zip com fotos pode ter dezenas de MB)
export async function gravarNoAparelho(nome, blob, lote = novoLote()) {
  const total = Math.max(1, Math.ceil(blob.size / PARTE));
  for (let i = 0; i < total; i++) {
    const bytes = new Uint8Array(await blob.slice(i * PARTE, (i + 1) * PARTE).arrayBuffer());
    await chamar("gravarParte", { nome, lote, base64: paraBase64(bytes), anexar: i > 0 });
  }
}

export const compartilharNativo = (nome, blob, tipo) => emFila(async () => {
  const lote = novoLote();
  await gravarNoAparelho(nome, blob, lote);
  await chamar("compartilhar", { nome, tipo, lote });
});

export const salvarNativo = (nome, blob, tipo) => emFila(async () => {
  const lote = novoLote();
  await gravarNoAparelho(nome, blob, lote);
  return chamar("salvarEmDownloads", { nome, tipo, lote });
});

export const abrirNativo = (nome, blob, tipo) => emFila(async () => {
  const lote = novoLote();
  await gravarNoAparelho(nome, blob, lote);
  await chamar("abrir", { nome, tipo, lote });
});

export const telaAcesaNativa = (sim) => chamar("telaAcesa", { sim });
export const sairDoApp = () => chamar("sair");

// "Abrir com" / "Compartilhar → Vistoria in loco": o Java guardou os arquivos ao receber o pedido
export async function recebidosNativos() {
  const r = await chamar("pegarRecebidos");
  const arquivos = r?.arquivos ?? [];
  const lista = arquivos.filter((a) => !a.erro).map((a) => deBase64(a.base64));
  const recebido = arquivos.map((a) => a.erro ? `${a.nome}: erro ${a.erro}`
    : `arquivo "${a.nome}" (${a.tipo || "sem tipo"}, ${deBase64(a.base64).length} bytes)`).join("; ");
  return { lista, recebido };
}

// com o celular na mão de outra pessoa (modo entrega) a tela não é trocada
export const deveAbrirRecebidos = (ctx) => !ctx.entrega;
