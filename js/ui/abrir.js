// Abrir pacote (telas v2, telas complementares): confere a integridade e faz a checagem pré-diligência.
import { pedirPersistencia } from "../db.js";
import { eventoIniciar } from "../estado.js";
import { avaliarPacote, avaliarRecebidos } from "../pacote.js";
import { h, trocar } from "./dom.js";

// pacote recebido pelo "Compartilhar" do Android: o service worker o guarda e abre esta tela
async function pacoteRecebido() {
  const cache = await caches.open("vistoria-recebido");
  const r = await cache.match("pacote-recebido");
  if (!r) return null;
  const lista = [];
  for (let i = 0; i < Number(r.headers.get("X-Quantos") ?? 0); i++) {
    const a = await cache.match(`pacote-recebido/${i}`);
    if (a) lista.push(new Uint8Array(await a.arrayBuffer()));
    await cache.delete(`pacote-recebido/${i}`);
  }
  await cache.delete("pacote-recebido");
  return { lista, recebido: decodeURIComponent(r.headers.get("X-Recebido") ?? "") };
}

export function desenhar(ctx, rota) {
  const area = h("div");
  // sem filtro de tipo: o Android às vezes deixa o ".vistoria" cinza; o app confere o conteúdo
  const entrada = h("input", { type: "file" });
  entrada.addEventListener("change", async () => {
    const arq = entrada.files?.[0];
    if (arq) await mostrar(ctx, area, new Uint8Array(await arq.arrayBuffer()));
  });
  const demo = new URLSearchParams(location.search).has("demo") &&
    h("button", { type: "button", onclick: async () =>
      mostrar(ctx, area, new Uint8Array(await (await fetch("tests/fixtures/pacote_demo.vistoria")).arrayBuffer())) },
    "Usar pacote de demonstração (fictício)");
  if (rota?.params.get("recebido")) {
    pacoteRecebido().then((r) => {
      if (r?.lista.some((b) => b.length)) mostrar(ctx, area, r.lista, `O Android enviou: ${r.recebido}`);
      else trocar(area, h("p", { class: "alerta" }, "Nenhum arquivo chegou pelo Compartilhar. Escolha o arquivo do pacote acima."));
    }).catch(() => {});
  }
  const guardadas = h("div");
  ctx.listarDiligencias().then((lista) => {
    if (!lista.length) return;
    lista.sort((a, b) => String(b.criada).localeCompare(String(a.criada)));
    trocar(guardadas, h("h2", {}, "Diligências guardadas neste aparelho"), lista.map((d) => h("div", { class: "cartao" },
      h("p", {}, h("strong", {}, `Proc. ${d.pacote.processo.numero}`)),
      h("p", { class: "ajuda" }, `Iniciada em ${new Date(d.criada).toLocaleString("pt-BR")}`),
      d.id === ctx.estado?.id ? h("p", { class: "estado-ok" }, "Aberta agora")
        : h("button", { type: "button", onclick: () => ctx.retomar(d.id) }, "Retomar"))));
  }).catch(() => {});
  return h("section", {}, h("h1", {}, "Abrir pacote do processo"),
    ctx.estado ? h("p", { class: "alerta" }, `Há uma diligência em andamento (Proc. ${ctx.estado.processo.numero}). ` +
      "Abrir outro pacote não a apaga: ela continua guardada e pode ser retomada abaixo.") : null,
    h("p", { class: "ajuda" }, "Mais fácil: no WhatsApp, segure o documento Pacote_<nº>.vistoria, toque em " +
      "Compartilhar e escolha \"Vistoria in loco\". Ou escolha o arquivo aqui (ele costuma ficar em Downloads)."),
    h("label", {}, "Arquivo do pacote", entrada), demo, area, guardadas);
}

// bytes: o arquivo escolhido; ou a lista de arquivos que chegaram pelo Compartilhar
async function mostrar(ctx, area, bytes, origem) {
  const r = Array.isArray(bytes) ? await avaliarRecebidos(bytes, ctx.catalogo) : await avaliarPacote(bytes, ctx.catalogo);
  if (!r.ok) {
    trocar(area, h("div", { class: "cartao falta", role: "alert" }, h("p", { class: "alerta" }, r.erro),
      origem ? h("p", { class: "ajuda" }, origem) : null));
    return;
  }
  const p = r.pacote;
  const titulos = new Map(ctx.catalogo.modulos.map((m) => [m.id, m.titulo]));
  const persistente = await pedirPersistencia();
  const bateria = await navigator.getBattery?.().catch(() => null);
  trocar(area,
    h("div", { class: "cartao" },
      h("h2", {}, `Processo ${p.processo.numero}`),
      h("p", {}, `${p.processo.reclamante} × ${p.processo.reclamada}`),
      h("p", {}, `Alegações: ${p.alegacoes.length} · Quesitos: ${p.quesitos.length}`),
      h("p", {}, `Módulos acionados: ${p.modulos_acionados.map((m) => titulos.get(m) ?? m).join(", ") || "nenhum"}`),
      h("p", { class: "estado-ok" }, "Integridade do arquivo verificada"),
      r.avisos.map((a) => h("p", { class: "alerta" }, a))),
    h("div", { class: "cartao" }, h("h2", {}, "Antes de sair para a diligência"),
      h("p", { class: persistente ? "estado-ok" : "alerta" }, persistente ? "Armazenamento persistente concedido"
        : "O navegador não garantiu o armazenamento persistente: faça uma cópia ao fim de cada etapa."),
      h("p", { class: bateria && bateria.level < 0.5 ? "alerta" : "estado-pend" },
        bateria ? `Bateria: ${Math.round(bateria.level * 100)}%` : "Bateria: confira no aparelho"),
      h("p", { class: "estado-pend" }, `Data e hora do aparelho: ${new Date().toLocaleString("pt-BR")} — confira`),
      h("p", { class: "estado-pend" }, "Ditado por voz sem internet (Gboard, português do Brasil): confira se está baixado")),
    h("button", { type: "button", class: "primario", onclick: (ev) => {
      if (ctx.estado && !confirm("Iniciar outra diligência? A atual continua guardada neste aparelho " +
        "e pode ser retomada em Abrir pacote.")) return;
      ev.currentTarget.disabled = true; // um toque só: evita duas diligências iguais
      ctx.iniciar(p, eventoIniciar(p, ctx.catalogo, crypto.randomUUID(), ctx.agora()));
    } }, "Iniciar diligência"));
}
