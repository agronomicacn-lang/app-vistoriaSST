// Ata (telas v2): prévia em letra grande, só com o conteúdo oficial; ressalvas por parte (modo
// entrega); assinaturas em sequência, com a opção de registrar a recusa.
import { linhasDaAta } from "../ata.js";
import { fatoDe } from "../estado.js";
import { montarPdf } from "../pdf.js";
import { h } from "./dom.js";

export function desenhar(ctx) {
  const itens = linhasDaAta(ctx.estado, ctx.pacote, ctx.catalogo, {});
  const ressalvas = fatoDe(ctx.estado, "MFIM.ressalvas")?.valor ?? [];
  const presentes = ctx.estado.participantes.filter((p) => p.presente !== false);
  return h("section", {}, h("h1", {}, "Ata da diligência (prévia)"),
    h("div", { class: "cartao previa" }, itens.filter((i) => i.tipo !== "assinatura")
      .map((i) => (i.tipo === "titulo" ? h("h2", {}, i.texto) : h("p", {}, i.texto)))),
    h("h2", {}, "Ressalvas"),
    ["Reclamante", "Reclamada"].map((lado) => h("div", { class: "cartao" }, h("p", {}, h("strong", {}, lado)),
      h("p", {}, ressalvas.find((r) => r.parte === lado)?.texto ?? "Sem ressalva registrada."),
      ctx.estado.travada_em ? null
        : h("a", { class: "botao", href: `#/ressalva/${lado.toLowerCase()}` }, "Entregar o celular à parte ▸"))),
    h("h2", {}, "Assinaturas"),
    presentes.map((p) => h("div", { class: "cartao" }, h("p", {}, h("strong", {}, p.nome || "(sem nome)"), ` — ${p.qualidade}`),
      p.assinatura ? h("p", { class: "estado-ok" }, "Assinou")
        : p.recusou ? h("p", { class: "alerta" }, `Recusou assinar${p.motivo ? `: ${p.motivo}` : ""}`)
          : p.saida ? h("p", { class: "ajuda" }, `Retirou-se às ${p.saida}, antes da assinatura da ata`)
            : h("a", { class: "botao", href: `#/assinar/${p.id}?de=ata` }, "Assinar ▸"))),
    h("div", { class: "linha" },
      ctx.estado.travada_em ? h("a", { class: "botao", href: "#/exportar" }, "A ata final, com o código, está em Exportar ▸")
        : h("button", { type: "button", onclick: () => {
          const url = URL.createObjectURL(new Blob([montarPdf(itens, { rodape: "PRÉVIA" })], { type: "application/pdf" }));
          window.open(url, "_blank");
        } }, "Ver a prévia em PDF"),
      h("a", { class: "botao", href: "#/encerramento" }, "◂ Encerramento")));
}
