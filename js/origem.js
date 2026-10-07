// Origem de cada fato (catálogo v1, seção 2) e contraditório (telas v2, "Registro de um fato").
import { normalizar } from "./texto.js";

export const FALANTES = [
  { id: "reclamante", rotulo: "Reclamante" }, { id: "reclamada", rotulo: "Reclamada" },
  { id: "terceiro", rotulo: "Terceiro" }, { id: "constatado", rotulo: "Constatado" },
];
export const POSICOES = [
  { id: "concorda", rotulo: "Concorda" }, { id: "discorda", rotulo: "Discorda" },
  { id: "nao_sabe", rotulo: "Não sabe" }, { id: "ausente", rotulo: "Ausente" },
  { id: "nao_perguntada", rotulo: "Não perguntada" },
];
export const CONFIRMACOES = [
  { id: "documento", rotulo: "Documento (ID)" }, { id: "vestigio", rotulo: "Vestígio físico" },
  { id: "terceiro", rotulo: "Terceiro" }, { id: "nenhuma", rotulo: "Nenhuma (motivo)" },
];
export const MOTIVO_SEM_CONSTATADO =
  "Atividade do período do contrato: o que se vê hoje não prova o passado. Escolha quem informou.";

const OUTRO_LADO = { reclamante: "reclamada", reclamada: "reclamante" };

export function falantePadrao(etapa) {
  return etapa === "entrevista" ? "reclamante" : "constatado";
}

export function aceitaConstatado(modulo, pergunta) {
  if (["periodo", "frequencia"].includes(pergunta.tipo) || pergunta.id.endsWith(".fonte_tempo")) return false;
  if (!pergunta.fato || pergunta.id.endsWith(".atual")) return true;
  return !(modulo.etapa === "entrevista" || (modulo.linha_nr ?? []).length > 0);
}

export function origemDoParticipante(p) {
  const q = normalizar(p?.qualidade);
  if (/advogad|assistente/.test(q)) return "manifestacao";
  if (q.startsWith("reclamante")) return "reclamante";
  if (/preposto|reclamada/.test(q)) return "reclamada";
  return "terceiro";
}

// manifestação de assistente ou advogado conta como relato do lado que ele representa (como no PC)
export function ladoDaManifestacao(p) {
  return /reclamada/.test(normalizar(p?.qualidade)) ? "reclamada" : "reclamante";
}

export function participanteDoLado(participantes, lado) {
  return (participantes ?? []).find((p) => p.presente !== false && origemDoParticipante(p) === lado) ?? null;
}

// posicao: concorda | discorda | nao_sabe | ausente | nao_perguntada
export function aplicarPosicao(fato, posicao, { versaoPropria = "", versaoOutra = "" } = {}) {
  const lado = fato.fala ?? fato.origem;
  if (!OUTRO_LADO[lado]) return { ...fato };
  const f = { ...fato, fala: lado, posicao_outra: posicao };
  delete f.versoes;
  if (posicao === "concorda") f.origem = "ambas";
  else if (posicao === "discorda") {
    f.origem = "divergem";
    f.versoes = { [lado]: versaoPropria, [OUTRO_LADO[lado]]: versaoOutra };
  } else f.origem = lado;
  return f;
}

export function pendenciasDecisivo(f) {
  const out = [];
  if (!f.posicao_outra) out.push("posição da outra parte");
  else if (f.posicao_outra === "discorda" && Object.values(f.versoes ?? {}).some((v) => !String(v ?? "").trim()))
    out.push("versão da outra parte");
  const c = f.confirmacao ?? {};
  if (!c.tipo) out.push("confirmação objetiva");
  else if (c.tipo !== "vestigio" && !String(c.detalhe ?? "").trim())
    out.push({ documento: "ID do documento", nenhuma: "motivo da falta de confirmação", terceiro: "quem confirmou" }[c.tipo]);
  return out;
}

// cabeçalho do cartão da alegação: de quem é, de qual peça e onde está nos autos
export function rotuloAlegacao(a) {
  const reclamada = a.parte === "reclamada";
  const doc = a.documento || (reclamada ? "Contestação" : "Inicial");
  return `${a.id} · ${reclamada ? "Reclamada" : "Reclamante"} · ${doc}${a.fonte ? ` (${a.fonte})` : ""}`;
}
