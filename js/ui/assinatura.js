// Modo entrega (telas v2): o celular passa para a parte e a tela mostra só a assinatura ou a
// ressalva. Para sair, segurar o botão por 2 s; o "voltar" não sai. Tela acesa enquanto isso.
import { eventoFato, eventoSimples, fatoDe, novoFatoId } from "../estado.js";
import { aviso, h, segurar, telaAcesa } from "./dom.js";

function entrar(ctx) {
  ctx.entrega = location.hash;
  document.body.classList.add("modo-entrega");
  telaAcesa(true);
}

function sair(ctx, destino) {
  ctx.entrega = null;
  document.body.classList.remove("modo-entrega");
  telaAcesa(false);
  location.replace(destino); // o "voltar" depois disso não reabre o modo entrega
}

export function desenhar(ctx, rota) {
  const p = ctx.estado.participantes.find((x) => x.id === rota.partes[0]);
  if (!p) return h("p", {}, "Participante não encontrado.");
  const volta = `#/${rota.params.get("de") || "presenca"}`;
  entrar(ctx);
  const canvas = h("canvas", { class: "assinatura", "aria-label": "Área para assinar" });
  const tracos = [];
  let traco = null;
  const pintar = () => {
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.lineWidth = 1;
    c.strokeStyle = "#333333";
    c.beginPath();
    c.moveTo(16, canvas.height * 0.75);
    c.lineTo(canvas.width - 16, canvas.height * 0.75);
    c.stroke();
    c.lineWidth = 3;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#111111";
    for (const t of tracos) {
      c.beginPath();
      t.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
  };
  const ponto = (e) => {
    const r = canvas.getBoundingClientRect();
    const limitar = (v, max) => Math.round(Math.min(Math.max(0, v), max));
    return [limitar(e.clientX - r.left, canvas.width), limitar(e.clientY - r.top, canvas.height)];
  };
  canvas.addEventListener("pointerdown", (e) => {
    // a área mudou de tamanho (tela girada) sem aviso do navegador: mede de novo antes de registrar o toque
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) medir();
    canvas.setPointerCapture(e.pointerId);
    traco = [ponto(e)];
    tracos.push(traco);
    pintar();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!traco) return;
    traco.push(ponto(e));
    pintar();
  });
  for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, () => { traco = null; });
  const medir = () => {
    if (!canvas.isConnected) {
      removeEventListener("resize", medir);
      return;
    }
    const mudou = canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (mudou && tracos.length) {
      tracos.length = 0; // a tela girou: os pontos já feitos não correspondem mais à área
      aviso("A tela mudou de tamanho: assine de novo.");
    }
    pintar();
  };
  setTimeout(medir, 0); // não depende de requestAnimationFrame, que fica parado com a aba em segundo plano
  addEventListener("resize", medir);
  const gravar = async (mudanca) => {
    const antes = ctx.estado.participantes.find((x) => x.id === p.id);
    await ctx.registrar(eventoSimples("participante", p.id, ctx.agora(), { ...antes, ...mudanca }, antes));
    sair(ctx, volta);
  };
  const motivo = h("input", { type: "text", "aria-label": "Motivo da recusa" });
  return h("section", {},
    h("p", { class: "pergunta" }, p.nome || "Participante"), h("p", {}, p.qualidade),
    canvas, h("p", { class: "ajuda" }, "Assine acima da linha com o dedo."),
    h("div", { class: "simnao" },
      h("button", { type: "button", onclick: () => { tracos.length = 0; pintar(); } }, "Limpar"),
      h("button", { type: "button", class: "primario", onclick: () => {
        if (!tracos.length) return;
        gravar({ assinatura: { tracos, largura: canvas.width, altura: canvas.height, instante: ctx.agora() }, recusou: false, motivo: "" });
      } }, "Confirmar")),
    h("details", {}, h("summary", {}, "Recusou assinar"), h("label", {}, "Motivo informado", motivo),
      h("button", { type: "button", onclick: () => gravar({ assinatura: null, recusou: true, motivo: motivo.value.trim() }) }, "Registrar recusa")),
    segurar("◂ Sair (segure 2 s)", 2000, () => sair(ctx, volta)));
}

export const ressalva = {
  desenhar(ctx, rota) {
    const lado = rota.partes[0] === "reclamada" ? "Reclamada" : "Reclamante";
    entrar(ctx);
    const f = fatoDe(ctx.estado, "MFIM.ressalvas");
    const lista = f?.valor ?? [];
    const texto = h("textarea", { "aria-label": `Ressalva: ${lado}` });
    texto.value = lista.find((x) => x.parte === lado)?.texto ?? "";
    const concluir = async () => {
      const valor = [...lista.filter((x) => x.parte !== lado), ...(texto.value.trim() ? [{ parte: lado, texto: texto.value.trim() }] : [])];
      const base = fatoDe(ctx.estado, "MFIM.ressalvas") ??
        { id: novoFatoId(ctx.estado), pergunta: "MFIM.ressalvas", origem: "constatado", falante: null, presentes: [], fotos: [] };
      await ctx.registrar(eventoFato(ctx.estado, { ...base, valor }, ctx.agora()));
      sair(ctx, "#/ata");
    };
    return h("section", {}, h("p", { class: "pergunta" }, `Ressalva: ${lado}`),
      h("p", {}, "Escreva ou dite aqui a sua ressalva sobre a diligência. Ela fará parte da ata."), texto,
      segurar("Concluir (segure 2 s)", 2000, concluir, { class: "primario" }));
  },
};
