// Vistoria FICTÍCIA montada com os mesmos eventos que as telas registram (base dos testes de contrato).
import { readFileSync } from "node:fs";
import { aplicar, eventoFato, eventoIniciar, eventoSimples, novoFatoId, reconstruir } from "../../js/estado.js";
import { aplicarPosicao } from "../../js/origem.js";

const ler = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
export const catalogo = ler("../../catalogo.json");
export const pacote = ler("../fixtures/pacote_demo.vistoria");
export const T = "2025-08-05T13:32:00-03:00";

export function montarDemo() {
  let e = reconstruir([eventoIniciar(pacote, catalogo, "7f1c2d3e-0000-4000-8000-0000000000aa", T)]);
  const fato = (pergunta, valor, origem, extra = {}) => {
    e = aplicar(e, eventoFato(e, { id: novoFatoId(e), pergunta, valor, origem, ...extra }, T));
    return e.fatos.at(-1);
  };
  fato("M0.data", "05/08/2025", "constatado");
  fato("M0.hora_ini", "13:32", "constatado");
  fato("M3.realizada", false, "constatado");
  fato("M3.motivo", "Máquinas vendidas pela Reclamada", "reclamada", { falante: "P2" });
  const op = fato("A6.ab.operava", true, "reclamante", { falante: "P1", decisivo: true });
  e = aplicar(e, eventoFato(e, {
    ...aplicarPosicao(op, "discorda", { versaoPropria: "Operava a bomba todo dia na safra",
      versaoOutra: "Só o encarregado operava a bomba" }),
    confirmacao: { tipo: "nenhuma", detalhe: "sem planilha de abastecimento" },
  }, T));
  fato("A6.tr.volume", 1000, "reclamante", { falante: "P1" });
  fato("A4.periodo", { ini: "03/2021", fim: "11/2023",
    meses: { "2020/21": [], "2021/22": [10, 11, 12, 1], "2022/23": [10, 11, 12, 1], "2023/24": [] } }, "ambas");
  fato("M1.atividades", [{ descricao: "Abastecia o pulverizador", equipamento: "Pulverizador", vezes_dia: 1,
    minutos_evento: 15, dias_semana: 6,
    periodo: { ini: "03/2021", fim: "11/2023", meses: { "2021/22": [10, 11, 12, 1] } } }], "reclamante", { falante: "P1" });
  fato("MQ.quesitos", [{ origem: pacote.quesitos[0].origem, numero: pacote.quesitos[0].numero,
    observacao: "Atividades descritas pelas partes", origem_obs: "ambas", depende_documento: false }], "constatado");
  e = aplicar(e, eventoSimples("alegacao", "AL1", T, { id: "AL1", situacao: "abordada", motivo: "", fatos: [op.id] }));
  return e;
}
