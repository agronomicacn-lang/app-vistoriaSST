// Um módulo: blocos e perguntas visíveis, com o que já foi registrado.
import { fatoDe, perguntaRespondida, perguntasDoModulo } from "../estado.js";
import { h } from "./dom.js";

export function desenhar(ctx, rota) {
  const m = ctx.catalogo.modulos.find((x) => x.id === rota.partes[0]);
  if (!m) return h("p", {}, "Módulo não encontrado.");
  const visiveis = new Set(perguntasDoModulo(m, ctx.estado).map((p) => p.id));
  return h("section", {}, h("h1", {}, m.titulo),
    m.blocos.map((b) => {
      const ps = b.perguntas.filter((p) => visiveis.has(p.id));
      if (!ps.length) return null;
      return h("div", {}, m.blocos.length > 1 ? h("h2", {}, b.titulo) : null, ps.map((p) => {
        const ok = perguntaRespondida(p, ctx.estado, ctx.pacote);
        const f = fatoDe(ctx.estado, p.id);
        return h("a", { class: "cartao", href: p.tipo === "alegacoes" ? "#/alegacoes" : `#/fato/${p.id}` },
          h("div", {}, p.texto),
          h("div", { class: ok ? "estado-ok" : "estado-pend" }, ok ? "Registrado" : "Pendente"),
          f?.origem === "divergem" ? h("div", { class: "divergencia" }, "Versões divergentes") : null);
      }));
    }),
    h("a", { class: "botao", href: "#/modulos" }, "◂ Módulos"));
}
