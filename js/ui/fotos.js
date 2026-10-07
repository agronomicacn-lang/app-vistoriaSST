// Fotos (telas v2, "Câmera"): câmera do aparelho, arquivo original sem recorte nem compressão, hash
// na hora, vínculo com a pergunta, o fato e o módulo, legenda com etiquetas rápidas.
import { adiado } from "../adiar.js";
import { fotoDe, salvarFoto } from "../db.js";
import { eventoSimples, novoFotoId } from "../estado.js";
import { sha256Hex } from "../pacote.js";
import { aviso, h } from "./dom.js";

const ETIQUETAS = ["Bula", "NF", "Placa INMETRO", "Máquina", "Instrumento"];
const enderecos = new Map();

async function endereco(ctx, id) {
  const chave = `${ctx.estado.id}:${id}`;
  if (!enderecos.has(chave)) {
    const reg = await fotoDe(ctx.estado.id, id).catch(() => null);
    if (!reg) return null;
    enderecos.set(chave, URL.createObjectURL(reg.blob));
  }
  return enderecos.get(chave);
}

export function botaoFoto(ctx, { modulo, pergunta = null, fato = null, participantes = false }) {
  if (ctx.estado.travada_em) return null; // diligência travada: nada novo entra
  const entrada = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true });
  entrada.addEventListener("change", async () => {
    const arq = entrada.files?.[0];
    entrada.value = "";
    if (!arq) return;
    if (ctx.estado.travada_em) {
      aviso("A diligência está encerrada e travada: a foto não foi guardada.");
      return;
    }
    const bytes = new Uint8Array(await arq.arrayBuffer());
    const id = novoFotoId(ctx.estado);
    const sha256 = await sha256Hex(bytes);
    try {
      await salvarFoto(ctx.estado.id, id, arq, sha256);
    } catch (e) {
      aviso(`A foto não foi guardada no aparelho (${e?.message ?? e}). Tente de novo.`);
      return;
    }
    await ctx.registrar(eventoSimples("foto", id, ctx.agora(), { id, arquivo: `fotos/${id}${arq.type === "image/png" ? ".png" : ".jpg"}`,
      legenda: "", modulo, pergunta, fato, participantes, usar_no_laudo: !participantes, sha256, instante: ctx.agora() }));
    aviso("Original preservado ✓");
    ctx.redesenhar();
  });
  return h("span", {}, entrada, h("button", { type: "button", onclick: () => entrada.click() }, "📷 Tirar foto"));
}

export function fotosDe(ctx, filtro) {
  const travada = Boolean(ctx.estado.travada_em);
  return ctx.estado.fotos.filter(filtro).map((f) => {
    const atual = () => ctx.estado.fotos.find((x) => x.id === f.id);
    const img = h("img", { alt: `Foto ${f.id}`, class: "miniatura" });
    endereco(ctx, f.id).then((u) => { if (u) img.src = u; });
    const legenda = h("input", { type: "text", "aria-label": `Legenda da foto ${f.id}`, disabled: travada });
    legenda.value = f.legenda ?? "";
    const gravar = adiado(() => ctx.registrar(eventoSimples("foto", f.id, ctx.agora(), { ...atual(), legenda: legenda.value.trim() }, atual())));
    legenda.addEventListener("input", gravar);
    legenda.addEventListener("change", () => gravar.agora());
    return h("div", { class: "cartao" }, img, h("p", { class: "estado-ok" }, `${f.id} · original preservado`),
      h("label", {}, "Legenda", legenda),
      travada ? null : h("div", { class: "linha" }, ETIQUETAS.map((t) => h("button", { type: "button", class: "chip", onclick: () => {
        legenda.value = legenda.value ? `${legenda.value}; ${t}` : t;
        gravar.agora();
      } }, t))),
      f.participantes && !travada ? h("button", { type: "button", class: "chip", "aria-pressed": String(Boolean(f.usar_no_laudo)),
        onclick: async () => {
          await ctx.registrar(eventoSimples("foto", f.id, ctx.agora(), { ...atual(), usar_no_laudo: !atual().usar_no_laudo }, atual()));
          ctx.redesenhar();
        } }, "Usar no laudo") : null);
  });
}
