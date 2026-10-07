// Conteúdo da ata de diligência (catálogo v1, M-Fim 3): só o oficial — sem conclusões e sem as
// versões detalhadas. Mostrado na prévia (tela) e impresso no PDF.
import { fatoDe } from "./estado.js";

const txt = (v) => (v === true ? "Sim" : v === false ? "Não" : Array.isArray(v) ? v.join(", ")
  : v === null || v === undefined ? "" : String(v));

export function linhasDaAta(e, pacote, catalogo, { hashDados = null } = {}) {
  const v = (pid) => fatoDe(e, pid)?.valor;
  const itens = [];
  const titulo = (t) => itens.push({ tipo: "titulo", texto: t });
  const texto = (t) => { if (t) itens.push({ tipo: "texto", texto: t }); };
  const p = pacote.processo ?? {};

  titulo("Ata de diligência pericial");
  texto(`Processo ${p.numero}${p.vara ? ` — ${p.vara}` : ""}`);
  texto(`${p.reclamante ?? ""} × ${p.reclamada ?? ""}`);
  texto(`${pacote.perito?.tratamento || "Perito"}: ${pacote.perito?.nome ?? ""}`);
  texto(`Data: ${txt(v("M0.data")) || "—"} · Início: ${txt(v("M0.hora_ini")) || "—"} · Término: ${txt(v("MFIM.hora_fim")) || "—"}`);
  texto(`Local: ${txt(v("M0.local")) || "—"}`);

  titulo("Comunicação às partes");
  const ant = v("M0.antecedencia");
  texto([v("M0.com_meio") && `Meio: ${txt(v("M0.com_meio"))}`, v("M0.com_data") && `data: ${v("M0.com_data")}`,
    v("M0.com_id") && `comprovante: ${v("M0.com_id")}`, ant !== undefined && ant !== null && `antecedência: ${ant} dia(s)`]
    .filter(Boolean).join("; ") || "Não registrada.");
  texto(v("M0.antecedencia_just") && `Justificativa da antecedência: ${v("M0.antecedencia_just")}`);

  titulo("Participantes");
  for (const x of e.participantes)
    texto(`${x.nome || "(sem nome)"} — ${x.qualidade}${x.registro ? ` (${x.registro})` : ""}` +
      (x.presente === false ? ": ausente" : `: chegada ${x.chegada || "—"}, saída ${x.saida || "—"}`));
  texto(v("M0.sem_representante") && `Parte sem representante presente: ${v("M0.sem_representante")}`);
  texto(v("M0.metodo") && `Às ${v("M0.metodo")} o método foi explicado às partes: cada informação é registrada com quem ` +
    "a deu, e a outra parte pode confirmar ou contestar na hora.");
  texto(v("M0.deslocamento") && `Deslocamento até o local: ${v("M0.deslocamento")}.`);
  texto(v("M0.audio") === true ? "Houve gravação de áudio com a anuência de todos."
    : v("M0.audio") === false ? "Não houve gravação de áudio." : "");

  titulo("Vistoria do local");
  const realizada = v("M3.realizada");
  texto(realizada === true ? "A vistoria do local de trabalho foi realizada."
    : realizada === false ? `A vistoria do local de trabalho não foi realizada. Motivo registrado: ${txt(v("M3.motivo")) || "—"}.`
      : "Vistoria do local: não registrada.");
  texto(v("M3.local") && `Atividade, culturas e criações: ${txt(v("M3.local"))}.`);
  texto(v("M3.ambientes") && `Ambientes: ${txt(v("M3.ambientes"))}.`);
  for (const m of v("M3.maquinas") ?? [])
    texto(`Máquina: ${[m.tipo, m.marca_modelo, m.ano].filter(Boolean).join(", ")}${m.mesma ? ` (a mesma do período: ${m.mesma})` : ""}.`);
  for (const o of v("M3.ocorrencias") ?? [])
    texto(`Ocorrência: ${[o.tipo, o.quem && `quem: ${o.quem}`, o.motivo && `motivo informado: ${o.motivo}`].filter(Boolean).join("; ")}.`);

  const medicoes = v("MMED.medicoes") ?? [];
  if (medicoes.length) {
    titulo("Medições");
    for (const m of medicoes)
      texto(`${m.agente || "Medição"} — instrumento ${m.instrumento || "—"}; ponto: ${m.ponto || "—"}${m.tempo ? `; tempo: ${m.tempo}` : ""}.`);
  }

  const docs = [...(v("M4.documentos") ?? []),
    ...(v("M4.material_parte") ?? []).map((d) => ({ ...d, situacao: d.situacao || "Mostrado no celular de uma parte" }))];
  if (docs.length) {
    titulo("Documentos");
    for (const d of docs)
      texto(`${d.documento || "Documento"}: ${d.situacao || "—"}${d.id ? ` (ID ${d.id})` : ""}${d.prazo ? `. Prazo: ${d.prazo}; juntar no PJe` : ""}.`);
  }

  const suplementares = v("MQ.suplementares") ?? [];
  if (suplementares.length) {
    titulo("Quesitos suplementares recebidos");
    for (const q of suplementares) texto(`${q.parte || "—"}: ${q.texto || ""}`);
  }

  titulo("Ressalvas");
  const ressalvas = v("MFIM.ressalvas") ?? [];
  if (!ressalvas.length) texto("Nenhuma ressalva registrada.");
  for (const r of ressalvas) texto(`${r.parte}: ${r.texto}`);

  titulo("Integridade");
  texto(`Pacote do processo: ${String(e.pacote_sha256 ?? "").slice(0, 8).toUpperCase()}`);
  texto(hashDados ? `Código dos dados travados: ${hashDados.slice(0, 8).toUpperCase()}`
    : "PRÉVIA: sem valor de ata até o encerramento e travamento.");

  titulo("Assinaturas");
  for (const x of e.participantes.filter((y) => y.presente !== false))
    itens.push({ tipo: "assinatura", nome: x.nome, qualidade: x.qualidade, tracos: x.assinatura?.tracos ?? [],
      largura: x.assinatura?.largura ?? 1, altura: x.assinatura?.altura ?? 1,
      recusa: x.recusou ? (x.motivo || "sem motivo informado") : null,
      observacao: !x.assinatura && !x.recusou && x.saida ? `retirou-se às ${x.saida}, antes da assinatura da ata` : null });
  return itens;
}
