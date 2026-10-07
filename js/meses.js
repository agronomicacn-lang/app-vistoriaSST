// Período em meses e grade de ano-safra (telas v2, "Período e meses").
// O resumo usa o mesmo texto que o PC grava na coluna "Exposição sazonal" (laudo/vistoria_mapa.py).
export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const posicao = (m, inicio) => (m - inicio + 12) % 12;
const indiceMes = ({ mes, ano }) => ano * 12 + mes - 1;
const rotuloSafra = (a) => `${a}/${String((a + 1) % 100).padStart(2, "0")}`;
const textoMesAno = ({ mes, ano }) => `${String(mes).padStart(2, "0")}/${ano}`;

export function ordenarMeses(meses, inicio = 7) {
  return [...new Set(meses)].sort((a, b) => posicao(a, inicio) - posicao(b, inicio));
}

function faixas(meses) {
  if (!meses.length) return "";
  const grupos = [[meses[0]]];
  for (const m of meses.slice(1)) {
    const g = grupos[grupos.length - 1];
    if (m === (g[g.length - 1] % 12) + 1) g.push(m);
    else grupos.push([m]);
  }
  return grupos.map((g) => (g.length === 1 ? MESES[g[0] - 1] : `${MESES[g[0] - 1]}–${MESES[g[g.length - 1] - 1]}`))
    .join(", ");
}

function juntar(itens) {
  return itens.length === 1 ? itens[0] : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

export function resumoMeses(porSafra, inicio = 7) {
  const safras = Object.keys(porSafra ?? {}).sort();
  if (!safras.length) return "";
  if (safras.every((s) => new Set(porSafra[s]).size === 12)) return "Não há: ano todo";
  const grupos = new Map();
  const vazias = [];
  for (const s of safras) {
    const f = faixas(ordenarMeses(porSafra[s], inicio));
    if (!f) vazias.push(s);
    else if (grupos.has(f)) grupos.get(f).push(s);
    else grupos.set(f, [s]);
  }
  const partes = [...grupos].map(([f, ss]) => `${f} (${ss.length === 1 ? "safra" : "safras"} ${juntar(ss)})`);
  if (vazias.length) partes.push(`sem exposição informada em ${juntar(vazias)}`);
  return partes.join("; ");
}

export function parseMesAno(s) {
  const m = /^(\d{1,2})\/(\d{4})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const mes = Number(m[1]);
  return mes >= 1 && mes <= 12 ? { mes, ano: Number(m[2]) } : null;
}

export function safraDe({ mes, ano }, inicio = 7) {
  return rotuloSafra(mes >= inicio ? ano : ano - 1);
}

export function safrasDoPeriodo(ini, fim, inicio = 7) {
  const a = parseMesAno(ini);
  const b = parseMesAno(fim);
  if (!a || !b || indiceMes(b) < indiceMes(a)) return [];
  const out = [];
  for (let s = Number(safraDe(a, inicio).slice(0, 4)); s <= Number(safraDe(b, inicio).slice(0, 4)); s++)
    out.push(rotuloSafra(s));
  return out;
}

export function mesesDaSafra(safra, ini, fim, inicio = 7) {
  const s = Number(safra.slice(0, 4));
  const a = parseMesAno(ini);
  const b = parseMesAno(fim);
  return Array.from({ length: 12 }, (_, i) => {
    const mes = ((inicio - 1 + i) % 12) + 1;
    const ano = mes >= inicio ? s : s + 1;
    const k = indiceMes({ mes, ano });
    return { mes, ano, dentro: Boolean(a && b) && k >= indiceMes(a) && k <= indiceMes(b) };
  });
}

function mesAnoDaData(d) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(d ?? "").trim());
  return m ? { mes: Number(m[2]), ano: Number(m[3]) } : null;
}

export function validarPeriodo(periodo, contrato = {}, inicio = 7) {
  const p = periodo ?? {};
  const a = parseMesAno(p.ini);
  const b = parseMesAno(p.fim);
  if (!a || !b) return ["Informe o início e o fim (mês/ano)."];
  const problemas = [];
  if (indiceMes(b) < indiceMes(a)) problemas.push("O fim é anterior ao início.");
  const adm = mesAnoDaData(contrato?.admissao);
  const dem = mesAnoDaData(contrato?.demissao);
  if (adm && indiceMes(a) < indiceMes(adm)) problemas.push(`Começa antes da admissão (${textoMesAno(adm)}).`);
  if (dem && indiceMes(b) > indiceMes(dem)) problemas.push(`Termina depois da demissão (${textoMesAno(dem)}).`);
  const marcados = Object.entries(p.meses ?? {});
  if (!marcados.some(([, ms]) => ms.length)) problemas.push("Marque os meses de cada ano-safra.");
  for (const [safra, ms] of marcados)
    for (const c of mesesDaSafra(safra, p.ini, p.fim, inicio))
      if (ms.includes(c.mes) && !c.dentro) problemas.push(`Mês marcado fora do período: ${MESES[c.mes - 1]}/${c.ano}.`);
  return problemas;
}

export function periodoCompleto(periodo, contrato, inicio = 7) {
  return validarPeriodo(periodo, contrato, inicio).length === 0;
}

// meses de todas as safras do período (mesmo vazias); com o período incompleto ou invertido
// (por exemplo, enquanto o perito ainda troca o ano de início) nada do que foi marcado é apagado
export function ajustarMeses(meses, ini, fim, inicio = 7) {
  const safras = safrasDoPeriodo(ini, fim, inicio);
  if (!safras.length) return { ...(meses ?? {}) };
  return Object.fromEntries(safras.map((s) => [s, (meses ?? {})[s] ?? []]));
}
