// Alegações (catálogo v1, M2): situação de cada alegação do pacote e o que foi informado sobre ela.
import { adiado } from "../adiar.js";
import { eventoSimples } from "../estado.js";
import { h } from "./dom.js";

function cartao(ctx, a) {
  const antes = ctx.estado.alegacoes.find((x) => x.id === a.id) ?? null;
  const s = antes ?? { id: a.id, situacao: "", motivo: "", fatos: [] };
  const fatos = ctx.estado.fatos.filter((f) => f.alegacao === a.id).map((f) => f.id);
  const gravar = async (mudanca, redesenhar = true) => {
    await ctx.registrar(eventoSimples("alegacao", a.id, ctx.agora(), { ...s, ...mudanca, fatos }, antes));
    if (redesenhar) ctx.redesenhar();
  };
  const motivo = h("input", { type: "text" });
  motivo.value = s.motivo ?? "";
  const gravarMotivo = adiado(() => gravar({ motivo: motivo.value.trim() }, false));
  motivo.addEventListener("input", gravarMotivo);
  motivo.addEventListener("change", () => gravarMotivo.agora());
  return h("div", { class: s.situacao ? "cartao" : "cartao falta", id: `al-${a.id}` },
    h("p", {}, h("strong", {}, `${a.id} · ${a.parte === "reclamada" ? "Contestação" : "Inicial"}`), a.fonte ? ` (${a.fonte})` : ""),
    h("p", {}, a.texto),
    h("div", { class: "linha" },
      h("button", { type: "button", class: "chip", "aria-pressed": String(s.situacao === "abordada"),
        onclick: () => gravar({ situacao: "abordada", motivo: "" }) }, "Abordada"),
      h("button", { type: "button", class: "chip", "aria-pressed": String(s.situacao === "nao_se_aplica"),
        onclick: () => gravar({ situacao: "nao_se_aplica" }) }, "Não se aplica")),
    s.situacao === "nao_se_aplica" ? h("label", {}, "Motivo", motivo) : null,
    h("p", {}, `Fatos registrados: ${fatos.length}`),
    h("a", { class: "botao", href: `#/fato/M2.fato?al=${encodeURIComponent(a.id)}` }, "Registrar o que foi informado ▸"));
}

export function desenhar(ctx, rota) {
  const lista = ctx.pacote.alegacoes ?? [];
  const alvo = rota.params.get("al");
  if (alvo) setTimeout(() => document.getElementById(`al-${alvo}`)?.scrollIntoView({ block: "start" }), 0);
  return h("section", {}, h("h1", {}, "Alegações"),
    lista.length ? null : h("p", {}, "O pacote não trouxe alegações."),
    lista.map((a) => cartao(ctx, a)));
}
