// Registro de um fato (telas v2): quem está falando, valor, contraditório, outra origem,
// detalhamento do fato decisivo e barra com período e presentes.
import { eventoFato, eventoSimples, fatoDe, indice, novoFatoId, perguntasDoModulo } from "../estado.js";
import {
  CONFIRMACOES, FALANTES, MOTIVO_SEM_CONSTATADO, POSICOES, aceitaConstatado, aplicarPosicao,
  falantePadrao, origemDoParticipante, participanteDoLado, pendenciasDecisivo,
} from "../origem.js";
import { adiado } from "../adiar.js";
import { campo, resumoValor } from "./campos.js";
import { aviso, h } from "./dom.js";
import { botaoFoto, fotosDe } from "./fotos.js";

const OUTRO = { reclamante: "reclamada", reclamada: "reclamante" };
const NOME_LADO = { reclamante: "do reclamante", reclamada: "da reclamada" };

export function desenhar(ctx, rota) {
  const it = indice(ctx.catalogo).get(rota.partes[0]);
  if (!it) return h("p", {}, "Pergunta não encontrada.");
  const { modulo, pergunta } = it;
  const al = rota.params.get("al");
  const chave = `${pergunta.id}|${al ?? ""}`;
  if (ctx.ultimaPergunta !== chave) {
    ctx.folhaOrigem = false;
    ctx.detalhar = false;
    ctx.pendente = null;
    ctx.ultimaPergunta = chave;
  }
  if (ctx.falanteEtapa !== modulo.etapa) {
    ctx.falante = falantePadrao(modulo.etapa);
    ctx.falanteEtapa = modulo.etapa;
  }
  const permite = aceitaConstatado(modulo, pergunta);
  const falante = ctx.falante === "constatado" && !permite ? null : ctx.falante;
  const rotulos = Object.fromEntries(ctx.catalogo.origens.map((o) => [o.id, o.rotulo]));
  const corrente = () => fatoDe(ctx.estado, pergunta.id, al);
  const atual = corrente();

  function base(origem, falanteId) {
    return { id: novoFatoId(ctx.estado), pergunta: pergunta.id, valor: null, origem, falante: falanteId,
      ...(al ? { alegacao: al } : {}),
      presentes: ctx.estado.participantes.filter((p) => p.presente !== false && !p.saida).map((p) => p.id), fotos: [] };
  }

  function novo() {
    if (!pergunta.fato) return base("constatado", null);
    if (!falante) return null;
    if (falante === "terceiro") {
      const p = ctx.estado.participantes.find((x) => x.id === ctx.terceiro);
      return p ? base(origemDoParticipante(p), p.id) : null;
    }
    return base(falante, OUTRO[falante] ? participanteDoLado(ctx.estado.participantes, falante)?.id ?? null : null);
  }

  async function gravar(fato) {
    await ctx.registrar(eventoFato(ctx.estado, fato, ctx.agora()));
    if (!al) return;
    const s = ctx.estado.alegacoes.find((x) => x.id === al) ?? { id: al, situacao: "", motivo: "", fatos: [] };
    if (!s.situacao || !s.fatos.includes(fato.id))
      await ctx.registrar(eventoSimples("alegacao", al, ctx.agora(),
        { ...s, situacao: s.situacao || "abordada", fatos: [...new Set([...s.fatos, fato.id])] }, s));
  }

  async function alterar(mudar, redesenhar = true) {
    const f = corrente() ?? novo();
    if (!f) {
      // a resposta não se perde: fica guardada e é gravada assim que o perito escolher quem fala
      const anterior = ctx.pendente?.chave === chave ? ctx.pendente.mudar : null;
      ctx.pendente = { chave, mudar: anterior ? (x) => mudar(anterior(x)) : mudar };
      aviso(`${falante === "terceiro" ? "Escolha quem é o terceiro." : "Escolha quem está falando."} ` +
        "A resposta fica guardada e é gravada assim que você escolher.");
      return;
    }
    await gravar(mudar(f));
    if (redesenhar) ctx.redesenhar();
  }

  const salvarValor = (valor) => alterar((f) => ({ ...f, valor }), false);

  function trocarOrigem(origem, extra = {}) {
    ctx.folhaOrigem = false;
    alterar((f) => {
      const { fala: _a, posicao_outra: _b, versoes: _c, ...resto } = f;
      return { ...resto, origem, ...extra };
    });
  }

  function escolherTerceiro(escolher) {
    const sel = h("select", { "aria-label": "Terceiro" }, h("option", { value: "" }, "Escolha quem"),
      ctx.estado.participantes.map((p) => h("option", { value: p.id, selected: p.id === ctx.terceiro }, `${p.nome} — ${p.qualidade}`)));
    sel.addEventListener("change", () => {
      const p = ctx.estado.participantes.find((x) => x.id === sel.value);
      if (p) escolher(p);
    });
    const nome = h("input", { type: "text", "aria-label": "Nome de outra pessoa" });
    const incluir = h("button", { type: "button", onclick: async () => {
      if (!nome.value.trim()) return;
      const n = Math.max(0, ...ctx.estado.participantes.map((p) => Number(String(p.id).replace(/^P/, "")) || 0)) + 1;
      const p = { id: `P${n}`, nome: nome.value.trim(), qualidade: "Terceiro", registro: "", presente: true };
      await ctx.registrar(eventoSimples("participante", p.id, ctx.agora(), p));
      escolher(p);
    } }, "Incluir pessoa");
    return h("div", {}, h("label", {}, "Terceiro (quem?)", sel), h("div", { class: "linha" }, nome, incluir));
  }

  function versoes(f, lado) {
    return [lado, OUTRO[lado]].map((quem) => {
      const el = h("textarea", { "aria-label": `Versão ${NOME_LADO[quem]}` });
      el.value = f.versoes?.[quem] ?? "";
      const gravarVersao = adiado(() => alterar((x) => ({ ...x, versoes: { ...x.versoes, [quem]: el.value.trim() } }), false));
      el.addEventListener("input", gravarVersao);
      el.addEventListener("change", () => gravarVersao.agora());
      const doPacote = (ctx.pacote.alegacoes ?? []).find((a) => a.parte === quem && (a.id === al || a.modulos.includes(modulo.id)));
      return h("div", {}, h("label", {}, `Versão ${NOME_LADO[quem]}`, el),
        doPacote ? h("button", { type: "button", class: "chip", onclick: () => {
          el.value = doPacote.texto;
          alterar((x) => ({ ...x, versoes: { ...x.versoes, [quem]: doPacote.texto } }), false);
        } }, quem === "reclamante" ? "usar texto da inicial" : "usar texto da contestação") : null);
    });
  }

  function posicionar(id) {
    alterar((x) => {
      const lado = x.fala ?? x.origem;
      if (!OUTRO[lado]) return { ...x, posicao_outra: id };
      return aplicarPosicao(x, id, { versaoPropria: x.versoes?.[lado] ?? resumoValor(x.valor),
        versaoOutra: x.versoes?.[OUTRO[lado]] ?? "" });
    });
  }

  function detalhar(f) {
    const c = f.confirmacao ?? {};
    const detalhe = h("input", { type: "text", "aria-label": "Detalhe da confirmação" });
    detalhe.value = c.detalhe ?? "";
    const gravarDetalhe = adiado(() =>
      alterar((x) => ({ ...x, confirmacao: { ...(x.confirmacao ?? {}), detalhe: detalhe.value.trim() } }), false));
    detalhe.addEventListener("input", gravarDetalhe);
    detalhe.addEventListener("change", () => gravarDetalhe.agora());
    const pend = f.decisivo ? pendenciasDecisivo(f) : [];
    return h("div", { class: "folha" },
      h("div", { class: "privado" }, h("button", { type: "button", class: "chip", "aria-pressed": String(Boolean(f.decisivo)),
        onclick: () => alterar((x) => ({ ...x, decisivo: !x.decisivo })) }, "★ Premissa que decide pedido")),
      h("p", {}, h("strong", {}, "Posição da outra parte")),
      h("div", { class: "linha" }, POSICOES.map((p) => h("button", { type: "button", class: "chip",
        "aria-pressed": String(f.posicao_outra === p.id), onclick: () => posicionar(p.id) }, p.rotulo))),
      h("p", {}, h("strong", {}, "Confirmação objetiva")),
      h("div", { class: "linha" }, CONFIRMACOES.map((k) => h("button", { type: "button", class: "chip",
        "aria-pressed": String(c.tipo === k.id),
        onclick: () => alterar((x) => ({ ...x, confirmacao: { tipo: k.id, detalhe: x.confirmacao?.detalhe ?? "" } })) }, k.rotulo))),
      c.tipo && c.tipo !== "vestigio"
        ? h("label", {}, { documento: "ID do documento", terceiro: "Quem confirmou", nenhuma: "Motivo" }[c.tipo], detalhe) : null,
      pend.length ? h("p", { class: "alerta privado" }, `Falta: ${pend.join(", ")}`) : null);
  }

  function folhaOrigem() {
    const id = h("input", { type: "text", autocapitalize: "off", "aria-label": "ID do documento" });
    return h("div", { class: "folha" },
      h("div", { class: "linha" }, ["reclamante", "reclamada", "constatado"].map((o) => h("button", { type: "button", class: "chip",
        disabled: o === "constatado" && !permite, onclick: () =>
          trocarOrigem(o, { falante: OUTRO[o] ? participanteDoLado(ctx.estado.participantes, o)?.id ?? null : null }) }, rotulos[o]))),
      h("label", {}, "Documento (ID no PJe ou exibido na diligência)", id),
      h("div", { class: "linha" },
        h("button", { type: "button", onclick: () => trocarOrigem("documento", { confirmacao: { tipo: "documento", detalhe: id.value.trim() } }) }, "Usar documento"),
        h("button", { type: "button", onclick: () => trocarOrigem("demonstrado") }, rotulos.demonstrado)),
      escolherTerceiro((p) => trocarOrigem(origemDoParticipante(p), { falante: p.id })));
  }

  const nomeDe = (id) => ctx.estado.participantes.find((p) => p.id === id)?.nome;
  const lado = atual ? (atual.fala ?? (OUTRO[atual.origem] ? atual.origem : null)) : (OUTRO[falante] ? falante : null);
  const per = (modulo.linha_nr ?? []).length && pergunta.tipo !== "periodo" ? fatoDe(ctx.estado, `${modulo.id}.periodo`) : undefined;
  const lista = al ? [] : perguntasDoModulo(modulo, ctx.estado);
  const prox = lista[lista.findIndex((p) => p.id === pergunta.id) + 1];
  const voltar = al ? "#/alegacoes" : prox ? `#/fato/${prox.id}` : `#/modulo/${modulo.id}`;

  if (ctx.pendente?.chave === chave && novo()) {
    const { mudar } = ctx.pendente;
    ctx.pendente = null;
    setTimeout(() => alterar(mudar), 0);
  }

  return h("section", {},
    h("p", { class: "ajuda" }, h("a", { href: `#/modulo/${modulo.id}` }, `◂ ${modulo.titulo}`)),
    h("p", { class: "pergunta", id: "pergunta" }, pergunta.texto),
    pergunta.fato && !atual ? [
      h("p", {}, h("strong", {}, "Quem está falando")),
      h("div", { class: "linha", role: "group", "aria-label": "Quem está falando" }, FALANTES.map((f) =>
        h("button", { type: "button", class: "chip", "aria-pressed": String(falante === f.id),
          disabled: f.id === "constatado" && !permite,
          onclick: () => { ctx.falante = f.id; ctx.redesenhar(); } }, f.rotulo))),
      permite ? null : h("p", { class: "ajuda" }, MOTIVO_SEM_CONSTATADO),
      falante === "terceiro" ? escolherTerceiro((p) => { ctx.terceiro = p.id; ctx.redesenhar(); }) : null,
    ] : null,
    atual && pergunta.fato ? h("p", { class: atual.origem === "divergem" ? "divergencia" : "" },
      `Origem: ${rotulos[atual.origem] ?? atual.origem}${nomeDe(atual.falante) ? ` (${nomeDe(atual.falante)})` : ""}`) : null,
    campo(pergunta, atual?.valor, salvarValor, ctx),
    pergunta.fato && lado ? h("div", { class: "folha" }, h("p", {}, h("strong", {}, "Outra parte:")),
      h("div", { class: "linha" }, POSICOES.filter((p) => p.id !== "nao_perguntada").map((p) =>
        h("button", { type: "button", class: "chip", "aria-pressed": String(atual?.posicao_outra === p.id),
          onclick: () => posicionar(p.id) }, p.rotulo))),
      atual?.posicao_outra === "discorda" ? versoes(atual, lado) : null) : null,
    pergunta.fato ? [h("button", { type: "button", onclick: () => { ctx.folhaOrigem = !ctx.folhaOrigem; ctx.redesenhar(); } },
      "Outra origem ▾"), ctx.folhaOrigem ? folhaOrigem() : null] : null,
    pergunta.fato && atual ? [h("button", { type: "button", onclick: () => { ctx.detalhar = !ctx.detalhar; ctx.redesenhar(); } },
      "Detalhar ▸"), ctx.detalhar ? detalhar(atual) : null] : null,
    h("div", { class: "barra-fato" },
      h("span", {}, `Fotos (${ctx.estado.fotos.filter((f) => f.pergunta === pergunta.id).length})`),
      pergunta.tipo === "foto" ? null : botaoFoto(ctx, { modulo: modulo.id, pergunta: pergunta.id, fato: atual?.id ?? null }),
      per !== undefined ? h("a", { href: `#/fato/${modulo.id}.periodo`, class: per ? "estado-ok" : "alerta" },
        per ? `Período ${per.valor?.ini || "?"}–${per.valor?.fim || "?"}` : "Período: falta") : null,
      h("span", {}, `Presentes (${(atual?.presentes ?? ctx.estado.participantes.filter((p) => p.presente !== false && !p.saida)).length})`)),
    pergunta.tipo === "foto" ? null : fotosDe(ctx, (f) => f.pergunta === pergunta.id),
    h("div", { class: "linha" },
      atual ? h("button", { type: "button", onclick: async () => {
        const f = corrente();
        await ctx.registrar(eventoSimples("fato_excluido", f.id, ctx.agora(), null, f));
        aviso("Registro enviado para a lixeira.", { rotulo: "Desfazer", acao: async () => {
          await ctx.registrar(eventoSimples("fato_restaurado", f.id, ctx.agora()));
          ctx.redesenhar();
        } });
        ctx.redesenhar();
      } }, "Excluir registro") : null,
      rota.params.get("de") === "faltas" ? h("a", { class: "botao", href: "#/faltas" }, "◂ Voltar às faltas") : null,
      h("button", { type: "button", class: "primario", onclick: () => ctx.ir(voltar) },
        al ? "Concluir ▸" : prox ? "Próximo ▸" : "Concluir módulo ▸")));
}
