// PDF simples (texto e traços), sem bibliotecas: a ata da diligência.
// Fonte Helvetica do próprio leitor de PDF, codificação WinAnsi (acentos do português).
import { juntar } from "./zip.js";

const A4 = { largura: 595, altura: 842, margem: 50 };
const ESPECIAIS = { "—": 0x97, "–": 0x96, "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92, "•": 0x95, "…": 0x85 };
const ascii = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));

export function winAnsi(texto) {
  const out = [];
  for (const ch of String(texto ?? "")) {
    const c = ch.codePointAt(0);
    if (ESPECIAIS[ch]) out.push(ESPECIAIS[ch]);
    else if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255)) out.push(c);
    else if (ch === "\t") out.push(32);
    else out.push(63); // "?" para o que a fonte não tem
  }
  return out;
}

function literal(texto) {
  return winAnsi(texto).map((b) => (b === 40 || b === 41 || b === 92 ? `\\${String.fromCharCode(b)}`
    : b < 128 ? String.fromCharCode(b) : `\\${b.toString(8).padStart(3, "0")}`)).join("");
}

// larguras aproximadas da Helvetica (milésimos do corpo), com 5% de folga para o negrito
const ESTREITAS = { i: 222, j: 222, l: 222, f: 278, t: 278, r: 333, I: 278, " ": 278, ".": 278, ",": 278,
  ":": 278, ";": 278, "/": 278, "!": 278, "|": 260, "'": 191, "(": 333, ")": 333, "-": 333 };
const LARGAS = { m: 833, w: 722, M: 833, W: 944, "—": 1000, "@": 1015, "%": 889 };

function larguraLetra(ch) {
  if (LARGAS[ch]) return LARGAS[ch];
  if (ESTREITAS[ch]) return ESTREITAS[ch];
  const base = ch.normalize("NFD")[0];
  if (base !== ch) return larguraLetra(base);
  return /[A-Z]/.test(ch) ? 722 : 556;
}

export function larguraTexto(texto, tamanho) {
  let soma = 0;
  for (const ch of String(texto ?? "")) soma += larguraLetra(ch);
  return (soma * tamanho * 1.05) / 1000;
}

export function quebrar(texto, tamanho, largura) {
  const cabe = (s) => larguraTexto(s, tamanho) <= largura;
  const linhas = [];
  for (const paragrafo of String(texto ?? "").split("\n")) {
    let linha = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      if (!linha) linha = palavra;
      else if (cabe(`${linha} ${palavra}`)) linha += ` ${palavra}`;
      else {
        linhas.push(linha);
        linha = palavra;
      }
      while (!cabe(linha)) { // palavra maior que a linha inteira: corta
        let n = linha.length - 1;
        while (n > 1 && !cabe(linha.slice(0, n))) n--;
        linhas.push(linha.slice(0, n));
        linha = linha.slice(n);
      }
    }
    linhas.push(linha);
  }
  return linhas;
}

function tracar(it, x, y, w, h) {
  const s = Math.min(w / (it.largura || 1), h / (it.altura || 1));
  const cx = (v, max) => Math.min(Math.max(0, v), max); // ponto fora da área (tela girada) fica na borda
  const ops = ["1.2 w 1 J 1 j"];
  for (const t of it.tracos ?? []) {
    if (t.length < 2) continue;
    ops.push(`${t.map(([px, py], i) => `${(x + cx(px, it.largura || 1) * s).toFixed(1)} ${(y + h - cx(py, it.altura || 1) * s).toFixed(1)} ${i ? "l" : "m"}`).join(" ")} S`);
  }
  return ops;
}

export function montarPdf(itens, { rodape = "" } = {}) {
  const { largura, altura, margem } = A4;
  const util = largura - 2 * margem;
  const paginas = [];
  let ops = [];
  let y = altura - margem;
  const novaPagina = () => {
    paginas.push(ops);
    ops = [];
    y = altura - margem;
  };
  const garantir = (h) => { if (y - h < margem + 20) novaPagina(); };
  const escrever = (t, tam, negrito) => {
    for (const l of quebrar(t, tam, util)) {
      garantir(tam * 1.4);
      y -= tam * 1.4;
      ops.push(`BT /${negrito ? "F2" : "F1"} ${tam} Tf ${margem} ${y.toFixed(1)} Td (${literal(l)}) Tj ET`);
    }
  };
  for (const it of itens) {
    if (it.tipo === "titulo") {
      y -= 6;
      escrever(it.texto, 13, true);
    } else if (it.tipo === "texto") escrever(it.texto, 10.5, false);
    else if (it.tipo === "assinatura") {
      garantir(100);
      y -= 70;
      ops.push(...tracar(it, margem, y, 240, 60));
      ops.push(`0.5 w ${margem} ${y.toFixed(1)} m ${margem + 260} ${y.toFixed(1)} l S`);
      y -= 4;
      escrever(`${it.nome || "(sem nome)"} — ${it.qualidade}${it.recusa ? ` (recusou assinar: ${it.recusa})` : ""}` +
        `${it.observacao ? ` (${it.observacao})` : ""}`, 9.5, false);
    }
  }
  paginas.push(ops);
  const total = paginas.length;
  const corpos = paginas.map((p, i) => [...p,
    `BT /F1 8 Tf ${margem} 30 Td (${literal(`${rodape}${rodape ? "  ·  " : ""}Página ${i + 1} de ${total}`)}) Tj ET`].join("\n"));
  const obj = [];
  obj[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  obj[2] = `<< /Type /Pages /Kids [${corpos.map((_, k) => `${5 + 2 * k} 0 R`).join(" ")}] /Count ${total} >>`;
  obj[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  obj[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  corpos.forEach((c, k) => {
    obj[5 + 2 * k] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${largura} ${altura}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * k} 0 R >>`;
    obj[6 + 2 * k] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
  });
  const partes = [Uint8Array.from([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10])]; // %PDF-1.4 + binário
  let pos = partes[0].length;
  const offs = [];
  for (let i = 1; i < obj.length; i++) {
    offs[i] = pos;
    const b = ascii(`${i} 0 obj\n${obj[i]}\nendobj\n`);
    partes.push(b);
    pos += b.length;
  }
  const xref = `xref\n0 ${obj.length}\n0000000000 65535 f \n` +
    offs.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${obj.length} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  partes.push(ascii(xref));
  return juntar(partes);
}
