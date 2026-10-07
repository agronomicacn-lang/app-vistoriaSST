// Encerramento em passos numerados (telas v2): cada passo destrava o seguinte.
import { eventoFato, eventoSimples, fatoDe, novoFatoId } from "../estado.js";
import { h, segurar } from "./dom.js";

const MOTIVO = {
  1: (ctx) => `Resolva ${ctx.faltas.length} falta(s)`,
  2: () => "Registre a hora de término",
  3: () => "Colha as assinaturas ou registre as recusas",
  4: () => "Encerre e trave a diligência",
};

async function marcarFim(ctx) {
  const f = fatoDe(ctx.estado, "MFIM.hora_fim") ??
    { id: novoFatoId(ctx.estado), pergunta: "MFIM.hora_fim", origem: "constatado", falante: null, presentes: [], fotos: [] };
  await ctx.registrar(eventoFato(ctx.estado, { ...f, valor: new Date().toTimeString().slice(0, 5) }, ctx.agora()));
  ctx.redesenhar();
}

function travar(ctx, presentes) {
  const e = ctx.estado;
  return h("div", {},
    h("p", {}, `Presentes: ${presentes.length} · Fatos: ${e.fatos.length} · Fotos: ${e.fotos.length} · ` +
      `Término: ${fatoDe(e, "MFIM.hora_fim")?.valor ?? "—"}`),
    h("p", { class: "ajuda" }, "Depois de travar, nada mais pode ser alterado no celular."),
    segurar("Segure 3 s para encerrar e travar", 3000, async () => {
      const agora = ctx.agora();
      await ctx.registrar(eventoSimples("travar", e.id, agora, { travada_em: agora, fim: agora }));
      ctx.ir("#/exportar");
    }, { class: "primario" }));
}

export function desenhar(ctx) {
  const e = ctx.estado;
  const horaFim = fatoDe(e, "MFIM.hora_fim")?.valor;
  const presentes = e.participantes.filter((p) => p.presente !== false);
  const travada = Boolean(e.travada_em);
  const passos = [
    { n: 1, titulo: `Faltas: ${ctx.faltas.length ? `${ctx.faltas.length} a resolver` : "nenhuma"}`, ok: !ctx.faltas.length,
      acao: h("a", { class: "botao", href: "#/faltas" }, "Ver faltas ▸") },
    { n: 2, titulo: `Hora de término${horaFim ? `: ${horaFim}` : ""}`, ok: Boolean(horaFim),
      acao: h("div", { class: "linha" }, h("button", { type: "button", onclick: () => marcarFim(ctx) }, "Agora"),
        h("a", { class: "botao", href: "#/fato/MFIM.hora_fim" }, "Editar ▸")) },
    { n: 3, titulo: "Ata, ressalvas e assinaturas",
      ok: presentes.length > 0 && presentes.every((p) => p.assinatura || p.recusou || p.saida),
      acao: h("a", { class: "botao", href: "#/ata" }, "Abrir a ata ▸") },
    { n: 4, titulo: travada ? `Encerrada e travada às ${e.travada_em.slice(11, 16)}` : "Encerrar e travar", ok: travada,
      acao: travada ? null : travar(ctx, presentes) },
    { n: 5, titulo: "Exportar", ok: false, acao: h("a", { class: "botao", href: "#/exportar" }, "Exportar ▸") },
  ];
  let bloqueio = null;
  for (const p of passos) {
    p.bloqueio = travada ? null : bloqueio;
    if (!p.ok && !bloqueio && MOTIVO[p.n]) bloqueio = MOTIVO[p.n](ctx);
  }
  return h("section", {}, h("h1", {}, "Encerramento"), passos.map((p) =>
    h("div", { class: p.ok ? "cartao" : "cartao falta" }, h("h2", {}, `${p.n}. ${p.titulo}`),
      p.ok ? h("p", { class: "estado-ok" }, "Concluído") : null,
      p.bloqueio ? h("p", { class: "alerta" }, p.bloqueio) : p.acao)));
}
