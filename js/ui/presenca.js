// Lista de presença (telas v2): qualidade em chips, OAB/CREA quando a qualidade exige, chegada com
// "Agora", saída com um toque (atualiza os presentes dos fatos seguintes) e assinatura.
import { adiado } from "../adiar.js";
import { eventoSimples } from "../estado.js";
import { h } from "./dom.js";

const QUALIDADES = ["Reclamante", "Preposto(a) da Reclamada", "Reclamada", "Advogado(a) do(a) Reclamante",
  "Advogado(a) da Reclamada", "Assistente técnico do(a) Reclamante", "Assistente técnico da Reclamada", "Paradigma", "Outro"];
const hora = () => new Date().toTimeString().slice(0, 5);

export function desenhar(ctx) {
  const gravar = async (p, mudanca, redesenhar = true) => {
    const antes = ctx.estado.participantes.find((x) => x.id === p.id);
    await ctx.registrar(eventoSimples("participante", p.id, ctx.agora(), { ...antes, ...mudanca }, antes));
    if (redesenhar) ctx.redesenhar();
  };
  const campoTexto = (p, chave, rotulo) => {
    const el = h("input", { type: "text", "aria-label": `${rotulo} (${p.id})` });
    el.value = p[chave] ?? "";
    const g = adiado(() => gravar(p, { [chave]: el.value.trim() }, false));
    el.addEventListener("input", g);
    el.addEventListener("change", () => g.agora());
    return h("label", {}, rotulo, el);
  };
  const cartao = (p) => {
    const opcoes = QUALIDADES.includes(p.qualidade) ? QUALIDADES : [p.qualidade, ...QUALIDADES];
    const presente = p.presente !== false;
    return h("div", { class: "cartao", id: `pa-${p.id}` },
      campoTexto(p, "nome", "Nome"),
      h("p", {}, h("strong", {}, "Qualidade")),
      h("div", { class: "linha" }, opcoes.map((q) => h("button", { type: "button", class: "chip",
        "aria-pressed": String(p.qualidade === q), onclick: () => gravar(p, { qualidade: q }) }, q))),
      /advogad|assistente/i.test(p.qualidade) ? campoTexto(p, "registro", "OAB/CREA") : null,
      h("div", { class: "linha" },
        h("button", { type: "button", class: "chip", "aria-pressed": String(presente), onclick: () => gravar(p, { presente: true }) }, "Presente"),
        h("button", { type: "button", class: "chip", "aria-pressed": String(!presente), onclick: () => gravar(p, { presente: false }) }, "Ausente")),
      presente ? h("div", { class: "linha" },
        p.chegada ? h("span", {}, `Chegada ${p.chegada}`) : h("button", { type: "button", onclick: () => gravar(p, { chegada: hora() }) }, "Chegada: agora"),
        p.saida ? h("span", {}, `Saída ${p.saida}`) : h("button", { type: "button", onclick: () => gravar(p, { saida: hora() }) }, "Saída: agora")) : null,
      !presente ? null : p.assinatura ? h("p", { class: "estado-ok" }, "Assinou")
        : p.recusou ? h("p", { class: "alerta" }, `Recusou assinar${p.motivo ? `: ${p.motivo}` : ""}`)
          : p.saida ? h("p", { class: "ajuda" }, `Retirou-se às ${p.saida}, antes da assinatura da ata`)
            : h("a", { class: "botao", href: `#/assinar/${p.id}?de=presenca` }, "Assinar ▸"));
  };
  return h("section", {}, h("h1", {}, "Lista de presença"),
    ctx.estado.participantes.map(cartao),
    h("button", { type: "button", class: "primario", onclick: async () => {
      const n = Math.max(0, ...ctx.estado.participantes.map((p) => Number(String(p.id).replace(/^P/, "")) || 0)) + 1;
      await ctx.registrar(eventoSimples("participante", `P${n}`, ctx.agora(),
        { id: `P${n}`, nome: "", qualidade: "Outro", registro: "", presente: true }));
      ctx.redesenhar();
    } }, "+ Incluir participante"));
}
