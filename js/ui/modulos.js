// Aba Módulos: módulos ativos com progresso, abrir outro módulo e lixeira da diligência.
import { eventoSimples, modulosAtivos, progressoModulo } from "../estado.js";
import { h } from "./dom.js";

export function desenhar(ctx) {
  const ativos = modulosAtivos(ctx.estado, ctx.catalogo, ctx.pacote);
  const ids = new Set(ativos.map((m) => m.id));
  const outros = ctx.catalogo.modulos.filter((m) => !ids.has(m.id));
  const perguntas = new Map(ctx.catalogo.modulos.flatMap((m) => m.blocos.flatMap((b) => b.perguntas)).map((p) => [p.id, p.texto]));
  return h("section", {}, h("h1", {}, "Módulos"),
    h("div", { class: "linha" }, ativos.map((m) => {
      const p = progressoModulo(m, ctx.estado, ctx.pacote);
      return h("a", { class: "botao chip", href: `#/modulo/${m.id}` }, `${m.titulo} ${p.respondidas}/${p.total}`);
    })),
    outros.length ? h("h2", {}, "Abrir outro módulo") : null,
    h("div", { class: "linha" }, outros.map((m) => h("button", { type: "button", class: "chip", onclick: async () => {
      await ctx.registrar(eventoSimples("modulo_aberto", m.id, ctx.agora()));
      ctx.ir(`#/modulo/${m.id}`);
    } }, `+ ${m.titulo}`))),
    ctx.estado.lixeira.length ? h("h2", {}, `Lixeira (${ctx.estado.lixeira.length})`) : null,
    ctx.estado.lixeira.map((f) => h("div", { class: "cartao" }, h("p", {}, perguntas.get(f.pergunta) ?? f.pergunta),
      h("button", { type: "button", onclick: async () => {
        await ctx.registrar(eventoSimples("fato_restaurado", f.id, ctx.agora()));
        ctx.redesenhar();
      } }, "Restaurar"))));
}
