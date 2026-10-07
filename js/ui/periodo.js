// Período e meses (telas v2): início e fim em mês/ano dentro do contrato e grade por ano-safra.
import { MESES, ajustarMeses, mesesDaSafra, resumoMeses, safrasDoPeriodo, validarPeriodo } from "../meses.js";
import { h } from "./dom.js";

function faixaDeAnos({ admissao, demissao }) {
  const a = Number(String(admissao ?? "").slice(-4)) || new Date().getFullYear() - 5;
  const b = Number(String(demissao ?? "").slice(-4)) || new Date().getFullYear();
  return Array.from({ length: Math.max(1, b - a + 1) }, (_, i) => a + i);
}

export function campoPeriodo(valor, salvar, ctx) {
  const inicio = ctx.catalogo.ano_safra_inicio;
  const contrato = { admissao: ctx.pacote.processo.admissao, demissao: ctx.pacote.processo.demissao };
  const anos = faixaDeAnos(contrato);
  const v = { ini: valor?.ini ?? "", fim: valor?.fim ?? "", meses: { ...(valor?.meses ?? {}) } };
  const raiz = h("div", { class: "folha" });

  function gravar() {
    // sempre todas as safras do período, mesmo vazias ("sem exposição informada")
    v.meses = ajustarMeses(v.meses, v.ini, v.fim, inicio);
    salvar(structuredClone(v));
    desenhar();
  }

  function seletor(rotulo, chave) {
    const [mes, ano] = (v[chave] || "/").split("/");
    const sm = h("select", { "aria-label": `${rotulo}: mês` }, h("option", { value: "" }, "mês"),
      MESES.map((m, i) => h("option", { value: String(i + 1).padStart(2, "0"), selected: Number(mes) === i + 1 }, m)));
    const sa = h("select", { "aria-label": `${rotulo}: ano` }, h("option", { value: "" }, "ano"),
      anos.map((a) => h("option", { value: String(a), selected: String(a) === ano }, String(a))));
    const muda = () => {
      if (sm.value && sa.value) {
        v[chave] = `${sm.value}/${sa.value}`;
        gravar();
      }
    };
    sm.addEventListener("change", muda);
    sa.addEventListener("change", muda);
    return h("div", {}, h("label", {}, rotulo), h("div", { class: "linha" }, sm, sa));
  }

  function dentroDa(s) {
    return mesesDaSafra(s, v.ini, v.fim, inicio).filter((c) => c.dentro).map((c) => c.mes);
  }

  function desenhar() {
    const safras = safrasDoPeriodo(v.ini, v.fim, inicio);
    raiz.replaceChildren(seletor("Início", "ini"), seletor("Fim", "fim"),
      ...safras.map((s, i) => {
        const marcados = new Set(v.meses[s] ?? []);
        return h("div", { "data-safra": s }, h("h2", {}, `Ano-safra ${s}`),
          h("div", { class: "grade" }, mesesDaSafra(s, v.ini, v.fim, inicio).map((c) =>
            h("button", { type: "button", "aria-pressed": String(marcados.has(c.mes)), disabled: !c.dentro,
              "aria-label": `${MESES[c.mes - 1]}/${c.ano}`, onclick: () => {
                if (marcados.has(c.mes)) marcados.delete(c.mes);
                else marcados.add(c.mes);
                v.meses[s] = [...marcados];
                gravar();
              } }, MESES[c.mes - 1]))),
          h("div", { class: "linha" },
            i > 0 ? h("button", { type: "button", onclick: () => {
              const ok = new Set(dentroDa(s));
              v.meses[s] = (v.meses[safras[i - 1]] ?? []).filter((m) => ok.has(m));
              gravar();
            } }, "Copiar safra anterior") : null,
            h("button", { type: "button", onclick: () => { v.meses[s] = dentroDa(s); gravar(); } }, "Todos"),
            h("button", { type: "button", onclick: () => { v.meses[s] = []; gravar(); } }, "Limpar")));
      }),
      h("p", {}, h("strong", {}, "Resumo: "),
        resumoMeses(Object.fromEntries(safras.map((s) => [s, v.meses[s] ?? []])), inicio) || "—"),
      ...validarPeriodo(v, contrato, inicio).map((p) => h("p", { class: "alerta" }, p)));
  }

  desenhar();
  return raiz;
}
