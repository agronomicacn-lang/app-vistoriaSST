// Montagem de elementos sem framework.
import { ehNativo, telaAcesaNativa } from "../nativo.js";
export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const f of filhos.flat(Infinity)) if (f !== null && f !== undefined && f !== false) el.append(f);
  return el;
}

export function trocar(alvo, ...filhos) {
  alvo.replaceChildren(...filhos.flat(Infinity).filter((f) => f !== null && f !== undefined && f !== false));
}

export function aviso(texto, botao = null, ms = 8000) {
  document.querySelector(".aviso")?.remove();
  const el = h("div", { class: "aviso", role: "status" }, h("span", {}, texto),
    botao && h("button", { type: "button", onclick: () => { el.remove(); botao.acao(); } }, botao.rotulo));
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
  return el;
}

// botão que só age depois de segurado (modo entrega: 2 s; encerrar e travar: 3 s)
export function segurar(rotulo, ms, acao, attrs = {}) {
  let t = null;
  let tique = null;
  const b = h("button", { type: "button", ...attrs }, rotulo);
  b.style.touchAction = "none";
  b.style.userSelect = "none";
  const parar = () => {
    clearTimeout(t);
    clearInterval(tique);
    t = null;
    b.textContent = rotulo;
  };
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const inicio = Date.now();
    tique = setInterval(() => { b.textContent = `Segure… ${Math.ceil((ms - (Date.now() - inicio)) / 1000)}`; }, 200);
    t = setTimeout(() => {
      parar();
      acao();
    }, ms);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, parar);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
  return b;
}

let travaDeTela = null;
let telaDesejada = false;
document.addEventListener("visibilitychange", () => {
  // o Android solta a trava ao apagar a tela ou ir para o fundo: pede de novo ao voltar
  if (document.visibilityState === "visible" && telaDesejada) {
    travaDeTela = null;
    telaAcesa(true);
  }
});

export async function telaAcesa(sim) {
  telaDesejada = sim;
  if (ehNativo()) return telaAcesaNativa(sim).catch(() => {}); // aplicativo instalado: o Android mantém
  try {
    if (sim && !travaDeTela) travaDeTela = await navigator.wakeLock?.request("screen");
    else if (!sim && travaDeTela) {
      await travaDeTela.release();
      travaDeTela = null;
    }
  } catch {
    travaDeTela = null;
  }
}
