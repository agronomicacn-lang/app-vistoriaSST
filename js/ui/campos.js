// Campos de resposta por tipo de pergunta do catálogo. Os valores seguem o formato que o PC lê:
// datas dd/mm/aaaa, horas hh:mm, períodos mm/aaaa com meses por ano-safra.
import { adiado } from "../adiar.js";
import { lerNumero } from "../texto.js";
import { h } from "./dom.js";
import { botaoFoto, fotosDe } from "./fotos.js";
import { campoPeriodo } from "./periodo.js";

const FREQUENCIA = [["vezes_dia", "Vezes por dia"], ["minutos_evento", "Minutos por vez"],
  ["horas_dia", "Horas por dia"], ["dias_semana", "Dias por semana"]];

export function resumoValor(v) {
  if (v === true) return "Sim";
  if (v === false) return "Não";
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(resumoValor).join("; ");
  if (typeof v === "object")
    return Object.entries(v).filter(([, x]) => x !== "" && x !== null && x !== undefined)
      .map(([k, x]) => `${k}: ${resumoValor(x)}`).join(", ");
  return String(v);
}

const isoParaBr = (s) => (/^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "") ?? []).slice(1).reverse().join("/");
const brParaIso = (s) => (/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s ?? "") ?? []).slice(1).reverse().join("-");

function texto(valor, salvar, attrs = {}) {
  const el = h("textarea", attrs);
  el.value = valor ?? "";
  const s = adiado(() => salvar(el.value.trim()));
  el.addEventListener("input", s);
  el.addEventListener("change", () => s.agora());
  return el;
}

function linhaDeTexto(valor, salvar) {
  const el = h("input", { type: "text" });
  el.value = valor ?? "";
  const s = adiado(() => salvar(el.value.trim()));
  el.addEventListener("input", s);
  el.addEventListener("change", () => s.agora());
  return el;
}

function numero(valor, salvar, unidade) {
  const el = h("input", { type: "text", inputmode: "decimal" });
  el.value = valor ?? "";
  const s = adiado(() => salvar(lerNumero(el.value)));
  el.addEventListener("input", s);
  el.addEventListener("change", () => s.agora());
  return h("div", { class: "linha" }, el, unidade ? h("span", {}, unidade) : null);
}

function chips(opcoes, marcadas, multipla, salvar, rotulo = (o) => o) {
  const sel = new Set(marcadas);
  const linha = h("div", { class: "linha" });
  const desenhar = () => linha.replaceChildren(...opcoes.map((o) =>
    h("button", { type: "button", class: "chip", "aria-pressed": String(sel.has(o)), onclick: () => {
      if (multipla) {
        if (sel.has(o)) sel.delete(o);
        else sel.add(o);
        salvar(opcoes.filter((x) => sel.has(x)));
      } else {
        sel.clear();
        sel.add(o);
        salvar(o);
      }
      desenhar();
    } }, rotulo(o))));
  desenhar();
  return linha;
}

function simnao(valor, salvar) {
  let atual = valor;
  const el = h("div", { class: "simnao" });
  const desenhar = () => el.replaceChildren(...[["Sim", true], ["Não", false]].map(([r, v]) =>
    h("button", { type: "button", "aria-pressed": String(atual === v), onclick: () => {
      atual = v;
      salvar(v);
      desenhar();
    } }, atual === v ? `✓ ${r}` : r)));
  desenhar();
  return el;
}

function data(valor, salvar) {
  const el = h("input", { type: "date" });
  el.value = brParaIso(valor);
  el.addEventListener("change", () => salvar(isoParaBr(el.value) || null));
  return el;
}

function hora(valor, salvar) {
  const el = h("input", { type: "time" });
  el.value = valor ?? "";
  el.addEventListener("change", () => salvar(el.value || null));
  return h("div", { class: "linha" }, el, h("button", { type: "button", onclick: () => {
    const d = new Date();
    el.value = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    salvar(el.value);
  } }, "Agora"));
}

function frequencia(valor, salvar) {
  const v = { ...(valor ?? {}) };
  return h("div", {}, FREQUENCIA.map(([k, r]) => h("label", {}, r, numero(v[k], (n) => {
    if (n === null) delete v[k];
    else v[k] = n;
    salvar({ ...v });
  }))));
}

function subcampo(c, valor, salvar, ctx) {
  if (c.tipo === "numero") return numero(valor, salvar);
  if (c.tipo === "periodo") return campoPeriodo(valor, salvar, ctx);
  return linhaDeTexto(valor, salvar);
}

function lista(pergunta, valor, salvar, ctx) {
  const itens = structuredClone(valor ?? []);
  const raiz = h("div");
  const gravar = () => salvar(structuredClone(itens));
  function desenhar() {
    raiz.replaceChildren(...itens.map((item, i) => h("div", { class: "cartao" },
      h("p", {}, h("strong", {}, `Item ${i + 1}`)),
      pergunta.campos.map((c) => h("label", {}, c.rotulo, subcampo(c, item[c.id], (v) => { item[c.id] = v; gravar(); }, ctx))),
      h("button", { type: "button", onclick: () => { itens.splice(i, 1); gravar(); desenhar(); } }, "Remover item"))),
    h("button", { type: "button", class: "primario", onclick: () => { itens.push({}); gravar(); desenhar(); } }, "+ Incluir item"));
  }
  desenhar();
  return raiz;
}

function quesitos(valor, salvar, ctx) {
  const obs = structuredClone(valor ?? []);
  const gravar = () => salvar(structuredClone(obs));
  const doQuesito = (q) => {
    let o = obs.find((x) => x.origem === q.origem && String(x.numero) === String(q.numero));
    if (!o) {
      o = { origem: q.origem, numero: q.numero, observacao: "", origem_obs: "", depende_documento: false };
      obs.push(o);
    }
    return o;
  };
  const rotulo = (id) => ctx.catalogo.origens.find((x) => x.id === id)?.rotulo ?? id;
  const qs = ctx.pacote.quesitos ?? [];
  if (!qs.length) return h("p", {}, "O pacote não trouxe quesitos.");
  return h("div", {}, qs.map((q) => {
    const o = doQuesito(q);
    const dep = h("button", { type: "button", class: "chip", "aria-pressed": String(Boolean(o.depende_documento)),
      onclick: () => {
        o.depende_documento = !o.depende_documento;
        dep.setAttribute("aria-pressed", String(o.depende_documento));
        gravar();
      } }, "Depende de documento a ser juntado");
    return h("div", { class: "cartao" }, h("p", {}, h("strong", {}, `${q.origem} ${q.numero}. `), q.texto),
      h("label", {}, "Observação colhida", texto(o.observacao, (t) => { o.observacao = t; gravar(); })),
      h("p", {}, "Quem informou:"),
      chips(ctx.catalogo.origens.map((x) => x.id), o.origem_obs ? [o.origem_obs] : [], false,
        (x) => { o.origem_obs = x; gravar(); }, rotulo),
      dep);
  }));
}

export function campo(pergunta, valor, salvar, ctx) {
  switch (pergunta.tipo) {
    case "simnao": return simnao(valor, salvar);
    case "escolha": return chips(pergunta.opcoes, valor === null || valor === undefined ? [] : [valor], false, salvar);
    case "multipla": {
      const rotulos = new Map(ctx.catalogo.marcadores.map((m) => [m.id, m.rotulo]));
      return chips(pergunta.opcoes, valor ?? [], true, salvar, (o) => rotulos.get(o) ?? o);
    }
    case "texto": return texto(valor, salvar, { "aria-labelledby": "pergunta" });
    case "numero": return numero(valor, salvar, pergunta.unidade);
    case "data": return data(valor, salvar);
    case "hora": return hora(valor, salvar);
    case "periodo": return campoPeriodo(valor, salvar, ctx);
    case "frequencia": return frequencia(valor, salvar);
    case "lista": return lista(pergunta, valor, salvar, ctx);
    case "quesitos": return quesitos(valor, salvar, ctx);
    case "alegacoes": return h("a", { class: "botao", href: "#/alegacoes" }, "Abrir as alegações ▸");
    case "assinatura": return h("a", { class: "botao", href: "#/presenca" }, "Abrir a lista de presença ▸");
    case "foto": {
      const participantes = pergunta.id === "M0.foto_participantes";
      return h("div", {}, botaoFoto(ctx, { modulo: pergunta.id.split(".")[0], pergunta: pergunta.id, participantes }),
        participantes ? h("p", { class: "ajuda" },
          "Foto opcional, com aviso aos presentes. Só entra no laudo se você marcar \"Usar no laudo\".") : null,
        fotosDe(ctx, (f) => f.pergunta === pergunta.id));
    }
    default: return h("p", { class: "ajuda" }, "Tipo de pergunta sem campo neste app.");
  }
}
