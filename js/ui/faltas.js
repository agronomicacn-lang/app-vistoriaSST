// Aba Faltas (telas v2): o que trava o encerramento, com atalho para resolver.
// O motivo de cada falta fica na camada privada (olho no alto da tela).
import { indice } from "../estado.js";
import { h } from "./dom.js";

function destino(f) {
  if (f.regra === "alegacao_sem_situacao") return `#/alegacoes?al=${encodeURIComponent(f.alvo)}`;
  return `#/fato/${f.pergunta}?de=faltas`;
}

export function desenhar(ctx) {
  const idx = indice(ctx.catalogo);
  const lista = ctx.faltas;
  return h("section", {}, h("h1", {}, `Faltas (${lista.length})`),
    lista.length ? h("p", { class: "ajuda" }, "Toque no olho, no alto da tela, para ver o motivo de cada falta.")
      : h("p", { class: "estado-ok" }, "Nada trava o encerramento."),
    lista.map((f, i) => {
      const it = idx.get(f.pergunta);
      return h("div", { class: "cartao falta" },
        h("p", {}, h("strong", {}, `⛔ ${i + 1}. ${it?.modulo.titulo ?? f.modulo}`)),
        h("p", {}, it?.pergunta.texto ?? ""),
        h("p", { class: "privado" }, f.texto),
        h("a", { class: "botao", href: destino(f) }, "Resolver ▸"));
    }));
}
