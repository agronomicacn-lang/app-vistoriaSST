// Roteiro (telas v2): um cartão por etapa, com estado em texto, contador e bloqueios em tempo real.
import { etapas } from "../estado.js";
import { h } from "./dom.js";

export function desenhar(ctx) {
  return h("section", {}, h("h1", {}, "Roteiro da diligência"),
    etapas(ctx.estado, ctx.catalogo, ctx.pacote, ctx.faltas).map((c) => h("div", { class: "cartao", "data-etapa": c.id },
      h("h2", {}, c.titulo),
      h("p", { class: c.situacao === "Concluída" ? "estado-ok" : "estado-pend" },
        c.modulos.length ? `${c.situacao} · ${c.respondidas}/${c.total}` : c.situacao),
      c.bloqueios ? h("p", { class: "alerta" }, `${c.bloqueios} ${c.bloqueios === 1 ? "trava" : "travam"} o encerramento`) : null,
      h("div", { class: "linha" }, c.modulos.map((m) =>
        h("a", { class: "botao chip", href: `#/modulo/${m.id}` }, `${m.titulo} ${m.respondidas}/${m.total}`))),
      c.id === "encerramento" ? h("a", { class: "botao", href: "#/encerramento" }, "Abrir o encerramento ▸") : null)),
    ctx.estado.travada_em ? h("p", { class: "estado-ok" }, h("a", { href: "#/exportar" }, "Diligência encerrada e travada — Exportar ▸")) : null,
    h("p", {}, h("a", { class: "botao", href: "#/abrir" }, "Abrir outro pacote")));
}
