// Motor de faltas que travam o encerramento (catálogo v1, M-Fim e seção 2), recalculado a cada evento.
import { fatoDe, indice, modulosAtivos } from "./estado.js";
import { periodoCompleto } from "./meses.js";
import { ladoDaManifestacao, pendenciasDecisivo } from "./origem.js";
import { normalizar, vazio } from "./texto.js";

// origens em que só o reclamante sustenta o fato
const SO_RECLAMANTE = new Set(["reclamante", "divergem"]);

export function calcularFaltas(estado, catalogo, pacote) {
  const regra = Object.fromEntries(catalogo.regras_bloqueio.map((r) => [r.id, r.texto]));
  const idx = indice(catalogo);
  const contrato = { admissao: pacote.processo?.admissao, demissao: pacote.processo?.demissao };
  const inicio = catalogo.ano_safra_inicio;
  const out = [];
  const falta = (id, detalhe, modulo, pergunta, alvo = null) =>
    out.push({ regra: id, texto: `${regra[id]}: ${detalhe}`, modulo, pergunta, alvo });

  for (const a of pacote.alegacoes ?? []) {
    const s = estado.alegacoes.find((x) => x.id === a.id);
    if (!s?.situacao || (s.situacao === "nao_se_aplica" && !String(s.motivo ?? "").trim()))
      falta("alegacao_sem_situacao", `${a.id} — ${a.texto.slice(0, 70)}`, "M2", "M2.alegacoes", a.id);
  }

  for (const f of estado.fatos.filter((x) => x.decisivo)) {
    const it = idx.get(f.pergunta);
    const pend = pendenciasDecisivo(f);
    if (it && pend.length)
      falta("decisivo_incompleto", `${it.pergunta.texto} (falta ${pend.join(", ")})`, it.modulo.id, f.pergunta, f.id);
  }

  for (const m of modulosAtivos(estado, catalogo, pacote)) {
    const doModulo = estado.fatos.filter((f) => idx.get(f.pergunta)?.modulo === m);
    if (m.periculosidade) {
      const conf = fatoDe(estado, `${m.id}.confirma`);
      const relatos = doModulo.filter((f) => f !== conf && idx.get(f.pergunta).pergunta.fato &&
        !f.pergunta.endsWith(".confirma_motivo"));
      const efetiva = (f) => (f.origem === "manifestacao"
        ? ladoDaManifestacao(estado.participantes.find((p) => p.id === f.falante)) : f.origem);
      const soReclamante = relatos.length > 0 && relatos.every((f) => SO_RECLAMANTE.has(efetiva(f)));
      const semMotivo = conf && normalizar(conf.valor) === "ninguem" &&
        vazio(fatoDe(estado, `${m.id}.confirma_motivo`)?.valor);
      if (soReclamante && (!conf || vazio(conf.valor) || semMotivo))
        falta("periculosidade_sem_corroboracao", m.titulo, m.id, `${m.id}.confirma`);
    }
    if ((m.linha_nr ?? []).length && doModulo.some((f) => !f.pergunta.endsWith(".periodo"))) {
      const p = fatoDe(estado, `${m.id}.periodo`);
      if (!p || !periodoCompleto(p.valor, contrato, inicio))
        falta("atividade_sem_periodo", m.titulo, m.id, `${m.id}.periodo`);
    }
  }

  for (const [i, item] of (fatoDe(estado, "M1.atividades")?.valor ?? []).entries())
    if (!periodoCompleto(item?.periodo, contrato, inicio))
      falta("atividade_sem_periodo", item?.descricao || `atividade ${i + 1}`, "M1", "M1.atividades", i);

  const observacoes = fatoDe(estado, "MQ.quesitos")?.valor ?? [];
  for (const q of pacote.quesitos ?? []) {
    const o = observacoes.find((x) => x.origem === q.origem && String(x.numero) === String(q.numero));
    if (!o || (!String(o.observacao ?? "").trim() && !o.depende_documento))
      falta("quesito_sem_observacao", `${q.origem} ${q.numero}`, "MQ", "MQ.quesitos", `${q.origem} ${q.numero}`);
  }

  for (const pid of ["M4.documentos", "M4.material_parte"])
    for (const d of fatoDe(estado, pid)?.valor ?? [])
      if ((pid === "M4.material_parte" || normalizar(d.situacao).startsWith("solicitad")) &&
          !String(d.prazo ?? "").trim())
        falta("documento_sem_prazo", d.documento || "documento sem nome", "M4", pid);

  const ant = fatoDe(estado, "M0.antecedencia")?.valor;
  if (!vazio(ant) && Number(ant) < 5 && vazio(fatoDe(estado, "M0.antecedencia_just")?.valor))
    falta("antecedencia_sem_justificativa", `${ant} dia(s)`, "M0", "M0.antecedencia_just");

  return out;
}
