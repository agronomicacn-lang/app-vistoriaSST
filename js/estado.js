// Estado da diligência = vistoria.json (spec 4.2), reconstruído da lista de eventos, que só cresce.
// Evento: {instante, tipo, alvo, antes, depois}. Tipos: iniciar, fato, fato_excluido,
// fato_restaurado, alegacao, participante, modulo_aberto.
import { vazio } from "./texto.js";

export const APP_VERSAO = "0.4.1";
const SEMPRE = new Set(["M0", "M1", "M2", "M3", "M4", "MFIM"]);

export function isoLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:` +
    `${p(d.getSeconds())}${sinal}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

export function indice(catalogo) {
  const out = new Map();
  for (const modulo of catalogo.modulos)
    for (const bloco of modulo.blocos)
      for (const pergunta of bloco.perguntas) out.set(pergunta.id, { modulo, bloco, pergunta });
  return out;
}

export function eventoIniciar(pacote, catalogo, id, instante) {
  const participantes = (pacote.participantes_previstos ?? []).map((p, i) => ({
    id: `P${i + 1}`, nome: p.nome, qualidade: p.qualidade, registro: p.registro ?? "", presente: true,
  }));
  return {
    instante, tipo: "iniciar", alvo: id, antes: null,
    depois: {
      tipo: "vistoria", versao: 1, id, pacote_sha256: pacote.sha256, app_versao: APP_VERSAO,
      catalogo_versao: catalogo.versao, processo: { numero: pacote.processo.numero },
      inicio: instante, fim: null, travada_em: null, participantes, fatos: [], alegacoes: [], fotos: [],
      ata: { ressalvas: [], hash_curto: "" }, lixeira: [], modulos_abertos: [],
    },
  };
}

function upsert(lista, item) {
  const i = lista.findIndex((x) => x.id === item.id);
  return i < 0 ? [...lista, item] : lista.map((x, j) => (j === i ? item : x));
}

export function aplicar(estado, ev) {
  if (ev.tipo === "iniciar") return { ...structuredClone(ev.depois), eventos: [ev] };
  if (!estado) throw new Error("A diligência ainda não foi iniciada.");
  if (estado.travada_em) throw new Error("A diligência está encerrada e travada.");
  const e = { ...estado, eventos: [...estado.eventos, ev] };
  switch (ev.tipo) {
    case "fato":
      e.fatos = upsert(e.fatos, ev.depois);
      break;
    case "fato_excluido": {
      const f = e.fatos.find((x) => x.id === ev.alvo);
      if (f) {
        e.fatos = e.fatos.filter((x) => x.id !== ev.alvo);
        e.lixeira = [...e.lixeira, { ...f, excluido_em: ev.instante }];
      }
      break;
    }
    case "fato_restaurado": {
      const f = e.lixeira.find((x) => x.id === ev.alvo);
      if (f) {
        const { excluido_em: _, ...resto } = f;
        e.lixeira = e.lixeira.filter((x) => x.id !== ev.alvo);
        e.fatos = upsert(e.fatos, resto);
      }
      break;
    }
    case "alegacao":
      e.alegacoes = upsert(e.alegacoes, ev.depois);
      break;
    case "participante":
      e.participantes = upsert(e.participantes, ev.depois);
      break;
    case "modulo_aberto":
      if (!e.modulos_abertos.includes(ev.alvo)) e.modulos_abertos = [...e.modulos_abertos, ev.alvo];
      break;
    case "foto":
      e.fotos = upsert(e.fotos, ev.depois);
      break;
    case "travar":
      e.travada_em = ev.depois.travada_em;
      e.fim = ev.depois.fim;
      break;
    default:
      throw new Error(`Evento desconhecido: ${ev.tipo}`);
  }
  return e;
}

export function reconstruir(eventos) {
  // um registro gravado depois do travamento (ex.: outra janela aberta) não impede reabrir: fica na
  // lista de eventos, que o PC mostra como "pós-travamento", e os dados travados não mudam
  return eventos.reduce((e, ev) => (e?.travada_em ? { ...e, eventos: [...e.eventos, ev] } : aplicar(e, ev)), null);
}

export function novoFatoId(estado) {
  const n = [...estado.fatos, ...estado.lixeira].map((f) => Number(String(f.id).replace(/^F/, "")) || 0);
  return `F${Math.max(0, ...n) + 1}`;
}

export function novoFotoId(estado) {
  const n = estado.fotos.map((f) => Number(String(f.id).replace(/^FT/, "")) || 0);
  return `FT${Math.max(0, ...n) + 1}`;
}

export function eventoFato(estado, fato, instante) {
  const antes = estado.fatos.find((f) => f.id === fato.id) ?? null;
  return { instante, tipo: "fato", alvo: fato.id, antes, depois: { ...fato, instante } };
}

export function eventoSimples(tipo, alvo, instante, depois = null, antes = null) {
  return { instante, tipo, alvo, antes, depois };
}

export function fatoDe(estado, perguntaId, alegacao = null) {
  return estado.fatos.find((f) => f.pergunta === perguntaId && (alegacao === null || f.alegacao === alegacao)) ?? null;
}

export function respondida(estado, perguntaId) {
  const f = fatoDe(estado, perguntaId);
  return Boolean(f) && !vazio(f.valor);
}

export function perguntaVisivel(pergunta, estado) {
  if (!pergunta.quando) return true;
  return fatoDe(estado, pergunta.quando.pergunta)?.valor === pergunta.quando.valor;
}

export function modulosAtivos(estado, catalogo, pacote) {
  const ativos = new Set([...SEMPRE, ...(pacote.modulos_acionados ?? []), ...estado.modulos_abertos]);
  if ((pacote.quesitos ?? []).length) ativos.add("MQ");
  const marcados = fatoDe(estado, "M1.marcadores")?.valor ?? [];
  for (const k of catalogo.marcadores) if (marcados.includes(k.id)) k.modulos.forEach((x) => ativos.add(x));
  const idx = indice(catalogo);
  for (const f of estado.fatos) {
    const p = idx.get(f.pergunta)?.pergunta;
    if (p?.abre && f.valor === true) ativos.add(p.abre);
  }
  return catalogo.modulos.filter((m) => ativos.has(m.id));
}

export function perguntasDoModulo(modulo, estado) {
  // M2.fato é registrado a partir de cada alegação (tela Alegações), não na lista do módulo
  return modulo.blocos.flatMap((b) => b.perguntas).filter((p) => p.id !== "M2.fato" && perguntaVisivel(p, estado));
}

export function perguntaRespondida(pergunta, estado, pacote) {
  if (pergunta.tipo === "alegacoes")
    return (pacote.alegacoes ?? []).every((a) => estado.alegacoes.some((x) => x.id === a.id && x.situacao));
  if (pergunta.tipo === "foto") return estado.fotos.some((f) => f.pergunta === pergunta.id);
  if (pergunta.tipo === "assinatura") {
    const presentes = estado.participantes.filter((p) => p.presente !== false);
    return presentes.length > 0 && presentes.every((p) => p.assinatura || p.recusou || p.saida);
  }
  return respondida(estado, pergunta.id);
}

export function progressoModulo(modulo, estado, pacote) {
  // a foto dos participantes é opcional (LGPD: mínimo de dados) e não conta no progresso
  const ps = perguntasDoModulo(modulo, estado).filter((p) => p.id !== "M0.foto_participantes");
  return { respondidas: ps.filter((p) => perguntaRespondida(p, estado, pacote)).length, total: ps.length };
}

export function etapas(estado, catalogo, pacote, faltas = []) {
  const ativos = modulosAtivos(estado, catalogo, pacote);
  return catalogo.etapas.map((e) => {
    const modulos = ativos.filter((m) => e.modulos.includes(m.id))
      .map((m) => ({ id: m.id, titulo: m.titulo, ...progressoModulo(m, estado, pacote) }));
    const respondidas = modulos.reduce((s, m) => s + m.respondidas, 0);
    const total = modulos.reduce((s, m) => s + m.total, 0);
    const bloqueios = faltas.filter((f) => e.modulos.includes(f.modulo)).length;
    const situacao = !modulos.length ? "Sem módulos acionados"
      : respondidas === total && !bloqueios ? "Concluída" : respondidas ? "Em andamento" : "Pendente";
    return { id: e.id, titulo: e.titulo, situacao, respondidas, total, bloqueios, modulos };
  });
}

export function exportarVistoria(estado) {
  return structuredClone(estado);
}
