// Casca do app: estado em memória, gravação imediata no aparelho, rotas, cabeçalho e camada privada.
import { gravarPendentes } from "./adiar.js";
import { abrirBanco, acrescentarEvento, eventosDe, listarDiligencias, salvarDiligencia } from "./db.js";
import { aplicar, isoLocal, reconstruir } from "./estado.js";
import { calcularFaltas } from "./faltas.js";
import { criarFila } from "./fila.js";
import * as abrir from "./ui/abrir.js";
import * as alegacoes from "./ui/alegacoes.js";
import * as assinatura from "./ui/assinatura.js";
import * as ata from "./ui/ata.js";
import * as encerramento from "./ui/encerramento.js";
import * as exportar from "./ui/exportar.js";
import { aviso, h, telaAcesa, trocar } from "./ui/dom.js";
import * as fato from "./ui/fato.js";
import * as faltas from "./ui/faltas.js";
import * as modulo from "./ui/modulo.js";
import * as modulos from "./ui/modulos.js";
import * as presenca from "./ui/presenca.js";
import * as roteiro from "./ui/roteiro.js";

const telas = { abrir, alegacoes, assinar: assinatura, ata, encerramento, exportar, fato, faltas, modulo, modulos,
  presenca, ressalva: assinatura.ressalva, roteiro };
const ctx = { catalogo: null, pacote: null, estado: null, faltas: [], falante: null, falanteEtapa: null };
let timerPrivada;
const ATUAL = "vistoria.atual"; // diligência aberta por último neste aparelho

// grava na ordem; o que falha fica pendente e é refeito antes dos registros novos
const fila = criarFila(({ id, evento }) => acrescentarEvento(id, evento), {
  aoSalvar: () => {
    document.getElementById("faixa-erro").hidden = true;
    document.getElementById("salvo").textContent = `✓ Salvo ${new Date().toLocaleTimeString("pt-BR")}`;
  },
  aoFalhar: (e, n) => falhaGravacao(e, n),
});
setInterval(() => { if (fila.pendentes) fila.tentarDeNovo(); }, 5000);

function lembrarAtual(id) {
  try { localStorage.setItem(ATUAL, id); } catch { /* sem armazenamento local: abre a mais recente */ }
}

function lerAtual() {
  try { return localStorage.getItem(ATUAL); } catch { return null; }
}

ctx.agora = () => isoLocal();
ctx.redesenhar = () => desenhar();
ctx.ir = (rota) => (location.hash === rota ? desenhar() : (location.hash = rota));

ctx.registrar = (evento) => {
  if (ctx.estado?.travada_em) {
    aviso("A diligência está encerrada e travada: nada mais pode ser alterado.");
    return Promise.resolve();
  }
  ctx.estado = aplicar(ctx.estado, evento);
  ctx.faltas = calcularFaltas(ctx.estado, ctx.catalogo, ctx.pacote);
  atualizarCabecalho();
  return fila.acrescentar({ id: ctx.estado.id, evento });
};

ctx.listarDiligencias = listarDiligencias;

// cópia de segurança: o mesmo zip, sem travamento e sem ata (o PC não a importa como diligência)
ctx.salvarCopia = async () => {
  if (!ctx.estado) return;
  try {
    const exp = await exportar.gerarArquivo(ctx);
    exportar.baixar(exp.nome, exp.blob);
    aviso("Cópia de segurança salva em Downloads.");
  } catch (e) {
    aviso(`Não foi possível salvar a cópia (${e?.message ?? e}).`);
  }
};

ctx.esquecer = () => {
  ctx.estado = null;
  ctx.pacote = null;
  ctx.faltas = [];
  try { localStorage.removeItem(ATUAL); } catch { /* nada a esquecer */ }
  atualizarCabecalho();
  ctx.ir("#/abrir");
};

function vigiarBateria() {
  navigator.getBattery?.().then((b) => {
    const avisados = new Set();
    const ver = () => {
      for (const nivel of [0.2, 0.1])
        if (b.level <= nivel && !b.charging && !avisados.has(nivel) && !ctx.entrega) {
          avisados.add(nivel);
          aviso(`Bateria em ${Math.round(b.level * 100)}%.`, { rotulo: "Salvar cópia agora", acao: () => ctx.salvarCopia() }, 20000);
        }
    };
    b.addEventListener("levelchange", ver);
    ver();
  }).catch(() => {});
}

async function carregar(d) {
  ctx.pacote = d.pacote;
  ctx.estado = reconstruir(await eventosDe(d.id));
  ctx.faltas = ctx.estado ? calcularFaltas(ctx.estado, ctx.catalogo, ctx.pacote) : [];
  ctx.falante = null;
  ctx.falanteEtapa = null;
  lembrarAtual(d.id);
}

ctx.retomar = async (id) => {
  gravarPendentes();
  const d = (await listarDiligencias()).find((x) => x.id === id);
  if (!d) return;
  await carregar(d);
  atualizarCabecalho();
  ctx.ir("#/roteiro");
};

ctx.iniciar = async (pacote, evento) => {
  await salvarDiligencia({ id: evento.alvo, pacote, criada: evento.instante });
  lembrarAtual(evento.alvo);
  ctx.pacote = pacote;
  ctx.estado = null;
  ctx.falante = null;
  ctx.falanteEtapa = null;
  await ctx.registrar(evento);
  ctx.ir("#/roteiro");
};

function falhaGravacao(e, pendentes = 0) {
  const faixa = document.getElementById("faixa-erro");
  document.getElementById("salvo").textContent = "";
  trocar(faixa, h("div", {}, `Não foi possível gravar no aparelho (${e?.message ?? e}). ` +
      (pendentes ? `${pendentes} registro(s) aguardando gravação; o app tenta de novo sozinho. ` : "") +
      "Não feche o app."),
    h("div", { class: "linha" },
      h("button", { type: "button", onclick: () => fila.tentarDeNovo() }, "Tentar de novo"),
      h("button", { type: "button", onclick: salvarCopia }, "Salvar cópia agora")));
  faixa.hidden = false;
}

function erroAoAbrir(e) {
  // diferente de falha de gravação: os registros estão no aparelho, mas não puderam ser lidos
  const faixa = document.getElementById("faixa-erro");
  trocar(faixa, h("div", {}, `Não foi possível abrir a diligência guardada neste aparelho (${e?.message ?? e}). ` +
    "Os registros continuam guardados: não apague os dados do navegador e procure o suporte."));
  faixa.hidden = false;
}

function salvarCopia() {
  const blob = new Blob([JSON.stringify(ctx.estado)], { type: "application/json" });
  const numero = String(ctx.estado?.processo?.numero ?? "sem_numero").replace(/[^\w.-]/g, "-");
  const a = h("a", { href: URL.createObjectURL(blob), download: `Copia_vistoria_${numero}_${Date.now()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
}

function atualizarCabecalho() {
  document.getElementById("processo").textContent = ctx.pacote ? `Proc. ${ctx.pacote.processo.numero}` : "Vistoria";
  document.getElementById("selo-faltas").textContent = ctx.faltas.length ? String(ctx.faltas.length) : "";
  document.getElementById("abas").hidden = !ctx.estado;
}

function rotaAtual() {
  const [caminho, busca = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [nome, ...partes] = caminho.split("/");
  return { nome: nome || (ctx.estado ? "roteiro" : "abrir"), partes: partes.map(decodeURIComponent),
    params: new URLSearchParams(busca) };
}

function desenhar() {
  gravarPendentes(); // o que estava sendo digitado é gravado antes de trocar a tela
  if (ctx.mantemTela) { // voltou ao endereço do modo entrega: a tela (e a assinatura em curso) continua a mesma
    ctx.mantemTela = false;
    return;
  }
  if (ctx.entrega && location.hash !== ctx.entrega) {
    // modo entrega: só sai segurando o botão por 2 s. O "voltar" avança de novo para a mesma tela,
    // sem reescrever as páginas anteriores do histórico.
    const destino = ctx.entrega;
    ctx.mantemTela = true;
    history.forward();
    setTimeout(() => { if (ctx.entrega === destino && location.hash !== destino) location.replace(destino); }, 300);
    return;
  }
  const rota = rotaAtual();
  const tela = !ctx.estado ? telas.abrir : telas[rota.nome] ?? telas.roteiro;
  document.querySelectorAll("#abas a").forEach((a) => a.removeAttribute("aria-current"));
  document.querySelector(`#abas a[data-aba="${rota.nome}"]`)?.setAttribute("aria-current", "page");
  const main = document.getElementById("tela");
  trocar(main, tela.desenhar(ctx, rota));
  if (ctx.estado?.travada_em && ["fato", "presenca", "alegacoes"].includes(rota.nome)) {
    // diligência travada: campos e botões de alteração aparecem desligados (só leitura)
    main.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (!(rota.nome === "fato" && el.classList.contains("primario"))) el.disabled = true;
    });
    main.prepend(h("p", { class: "alerta" }, "Diligência encerrada e travada: só leitura."));
  }
  if (!ctx.entrega) telaAcesa(rota.nome === "ata");
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function mostrarPrivada(sim) {
  document.body.classList.toggle("privada-visivel", sim);
  document.getElementById("olho").setAttribute("aria-pressed", String(sim));
  clearTimeout(timerPrivada);
  if (sim) timerPrivada = setTimeout(() => mostrarPrivada(false), 10000);
}

function protegerSaida() {
  // o "voltar" do Android nunca fecha o app; na tela inicial pede confirmação
  history.replaceState({ raiz: true }, "");
  history.pushState({}, "");
  addEventListener("popstate", (e) => {
    if (!e.state?.raiz) return;
    if (confirm("Sair do app de vistoria? Tudo o que foi registrado já está salvo no aparelho.")) history.back();
    else history.pushState({}, "");
  });
}

// versão nova do app: avisa e só atualiza com um toque. Os dados ficam no aparelho e o formato da
// diligência é versionado, então uma diligência em andamento continua igual depois da atualização.
function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const oferecer = (sw) => aviso("Versão nova do app disponível.",
    { rotulo: "Atualizar", acao: () => sw.postMessage("atualizar") }, 600000);
  navigator.serviceWorker.register("sw.js").then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) oferecer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const novo = reg.installing;
      novo?.addEventListener("statechange", () => {
        if (novo.state === "installed" && navigator.serviceWorker.controller) oferecer(novo);
      });
    });
  }).catch(() => {});
  let recarregando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregando) return;
    recarregando = true;
    location.reload();
  });
}

async function iniciarApp() {
  ctx.catalogo = await (await fetch("catalogo.json")).json();
  try {
    await abrirBanco();
    const lista = (await listarDiligencias()).sort((a, b) => String(b.criada).localeCompare(String(a.criada)));
    if (lista.length) await carregar(lista.find((d) => d.id === lerAtual()) ?? lista[0]);
  } catch (e) {
    erroAoAbrir(e);
  }
  document.getElementById("olho").addEventListener("click",
    () => mostrarPrivada(!document.body.classList.contains("privada-visivel")));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    gravarPendentes();
    mostrarPrivada(false);
  });
  addEventListener("pagehide", gravarPendentes);
  atualizarCabecalho();
  protegerSaida();
  vigiarBateria();
  addEventListener("hashchange", desenhar);
  desenhar();
  registrarServiceWorker();
}

iniciarApp();
if (new URLSearchParams(location.search).has("demo")) window.__ctx = ctx; // só na demonstração, para conferência
