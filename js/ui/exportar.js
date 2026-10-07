// Exportação (telas v2): arquivo único (dados, fotos originais e ata); código de 8 caracteres para ler
// em voz alta; compartilhar como documento ou salvar em Downloads; histórico de envios; o recibo
// emitido pelo PC libera a exclusão da diligência do celular.
import { apagarDiligencia, atualizarDiligencia, fotosDaDiligencia, listarDiligencias } from "../db.js";
import { montarExportacao } from "../exportacao.js";
import { compartilharNativo, ehNativo, salvarNativo } from "../nativo.js";
import { aviso, h, trocar } from "./dom.js";

// as fotos entram como o Blob original (sem cópia na memória)
export async function gerarArquivo(ctx) {
  const fotos = {};
  for (const r of await fotosDaDiligencia(ctx.estado.id)) fotos[r.foto] = r.blob;
  return montarExportacao(ctx.estado, ctx.pacote, ctx.catalogo, fotos);
}

// depois de travada nada muda: o arquivo é montado uma vez só
function exportacaoTravada(ctx) {
  if (ctx.exportacao?.id !== ctx.estado.id) ctx.exportacao = { id: ctx.estado.id, promessa: gerarArquivo(ctx) };
  return ctx.exportacao.promessa;
}

// devolve true quando o arquivo foi salvo (no navegador, quando o download foi entregue ao navegador)
export async function baixar(nome, dados, tipo = "application/zip") {
  const blob = dados instanceof Blob ? dados : new Blob([dados], { type: tipo });
  if (ehNativo()) { // aplicativo instalado: grava direto na pasta Downloads do celular
    try {
      const r = await salvarNativo(nome, blob, tipo);
      aviso(`Salvo em ${r?.local ?? "Downloads"}.`);
      return true;
    } catch (e) {
      aviso(`Não foi possível salvar (${e?.message ?? e}). Use "Compartilhar".`);
      return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

async function compartilhar(ctx, arquivo, como) {
  try {
    if (ehNativo()) await compartilharNativo(arquivo.name, arquivo, arquivo.type);
    else await navigator.share({ files: [arquivo], title: arquivo.name });
    await registrarEnvio(ctx, como);
    ctx.redesenhar();
  } catch (e) {
    if (e?.name !== "AbortError") aviso(`Não foi possível compartilhar (${e?.message ?? e}). Use "Salvar em Downloads".`);
  }
}

async function registrarEnvio(ctx, como) {
  await atualizarDiligencia(ctx.estado.id, (d) => ({ ...d, envios: [...(d.envios ?? []), { instante: ctx.agora(), como }] }));
}

function mostrar(ctx, area, exp) {
  const arquivo = new File([exp.blob], exp.nome, { type: "application/zip" });
  const ata = new File([exp.ata], `Ata_diligencia_${ctx.estado.processo.numero.replace(/[^\w.-]/g, "-")}.pdf`,
    { type: "application/pdf" });
  const compartilha = ehNativo() || Boolean(navigator.canShare?.({ files: [arquivo] }));
  const compartilhaAta = ehNativo() || Boolean(navigator.canShare?.({ files: [ata] }));
  const recibo = h("input", { type: "text", "aria-label": "Recibo do PC", maxlength: "8", autocapitalize: "characters" });
  const resposta = h("div");
  const historico = h("div");
  listarDiligencias().then((ls) => {
    const d = ls.find((x) => x.id === ctx.estado?.id);
    trocar(historico, (d?.envios ?? []).length ? d.envios.map((x) => h("p", { class: "ajuda" },
      `${new Date(x.instante).toLocaleString("pt-BR")} — ${x.como}`)) : h("p", { class: "ajuda" }, "Nenhum envio ainda."));
  }).catch(() => {});
  trocar(area,
    h("div", { class: "cartao" }, h("p", {}, h("strong", {}, exp.nome)), h("p", {}, `${(exp.tamanho / 1048576).toFixed(2)} MB`),
      h("p", {}, "Código (leia em voz alta; é o mesmo impresso na ata):"), h("p", { class: "codigo" }, exp.codigo)),
    h("h2", {}, "Ata para as partes"),
    h("p", { class: "ajuda" }, "Envie às partes só a ata (PDF). O arquivo completo (.zip) é para o seu PC: ele contém as suas anotações."),
    h("div", { class: "linha" },
      compartilhaAta ? h("button", { type: "button", onclick: () => compartilhar(ctx, ata, "ata compartilhada") }, "Compartilhar a ata (PDF)") : null,
      h("button", { type: "button", onclick: async () => {
        if (await baixar(ata.name, ata)) await registrarEnvio(ctx, "ata salva em Downloads");
        ctx.redesenhar();
      } }, "Salvar a ata (PDF)")),
    h("h2", {}, "Arquivo completo para o PC"),
    compartilha ? h("button", { type: "button", class: "primario", onclick: () => compartilhar(ctx, arquivo, "arquivo compartilhado") },
      "Compartilhar o arquivo completo (WhatsApp como documento, ou e-mail)") : null,
    h("button", { type: "button", class: compartilha ? "" : "primario", onclick: async () => {
      if (await baixar(exp.nome, exp.blob)) await registrarEnvio(ctx, "arquivo salvo em Downloads");
      ctx.redesenhar();
    } }, "Salvar o arquivo completo em Downloads"),
    h("h2", {}, "Envios"), historico,
    h("h2", {}, "Recibo da importação no PC"),
    h("p", { class: "ajuda" }, "Depois de importar no PC (IMPORTAR VISTORIA), digite aqui o recibo de 8 caracteres. " +
      "Só então a diligência pode ser apagada do celular."),
    h("label", {}, "Recibo", recibo),
    h("button", { type: "button", onclick: () => {
      if (recibo.value.trim().toUpperCase() !== exp.recibo) {
        trocar(resposta, h("p", { class: "alerta" }, "O recibo não confere com este arquivo. Confira o que o PC mostrou."));
        return;
      }
      trocar(resposta, h("p", { class: "estado-ok" }, "Recibo confere: a importação no PC foi confirmada."),
        h("button", { type: "button", onclick: async () => {
          if (!confirm("Apagar esta diligência do celular? Os dados já estão no PC.")) return;
          await apagarDiligencia(ctx.estado.id);
          ctx.esquecer();
        } }, "Apagar esta diligência do celular"));
    } }, "Conferir recibo"), resposta);
}

export function desenhar(ctx) {
  if (!ctx.estado.travada_em)
    return h("section", {}, h("h1", {}, "Exportar"),
      h("p", { class: "alerta" }, "Encerre e trave a diligência antes de exportar (Encerramento, passo 4)."),
      h("div", { class: "linha" }, h("button", { type: "button", onclick: () => ctx.salvarCopia() }, "Salvar cópia de segurança"),
        h("a", { class: "botao", href: "#/encerramento" }, "◂ Encerramento")));
  const area = h("div", {}, h("p", {}, "Montando o arquivo…"));
  exportacaoTravada(ctx).then((exp) => mostrar(ctx, area, exp))
    .catch((e) => trocar(area, h("p", { class: "alerta" }, `Não foi possível montar o arquivo (${e?.message ?? e}).`)));
  return h("section", {}, h("h1", {}, "Exportar"), area);
}
