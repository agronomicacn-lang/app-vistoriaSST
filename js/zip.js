// Zip sem compressão (método "stored"), lido por qualquer descompactador e pelo zipfile do PC.
// As fotos já vêm comprimidas da câmera: guardar sem recomprimir preserva o original byte a byte.
const TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABELA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function juntar(pedacos) {
  const out = new Uint8Array(pedacos.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of pedacos) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

function dataDos(d) {
  return { hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    dia: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

export function montarZip(arquivos, data = new Date()) {
  return juntar(partesDoZip(arquivos.map(({ nome, dados }) => ({ nome, dados, crc: crc32(dados), tamanho: dados.length })), data));
}

// entradas: [{nome, dados, crc, tamanho}]; "dados" pode ser o Blob original da foto, que entra no
// zip sem ser copiado para a memória (o zip final é um Blob montado com essas partes)
export function partesDoZip(entradas, data = new Date()) {
  const enc = new TextEncoder();
  const { hora, dia } = dataDos(data);
  const locais = [];
  const centrais = [];
  let pos = 0;
  for (const { nome, dados, crc, tamanho } of entradas) {
    const n = enc.encode(nome);
    const l = new DataView(new ArrayBuffer(30));
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true); // nomes em UTF-8
    l.setUint16(8, 0, true);
    l.setUint16(10, hora, true);
    l.setUint16(12, dia, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, tamanho, true);
    l.setUint32(22, tamanho, true);
    l.setUint16(26, n.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, tamanho, true);
    c.setUint32(24, tamanho, true);
    c.setUint16(28, n.length, true);
    c.setUint32(42, pos, true);
    locais.push(new Uint8Array(l.buffer), n, dados);
    centrais.push(new Uint8Array(c.buffer), n);
    pos += 30 + n.length + tamanho;
  }
  const tamanho = centrais.reduce((s, p) => s + p.length, 0);
  const f = new DataView(new ArrayBuffer(22));
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, entradas.length, true);
  f.setUint16(10, entradas.length, true);
  f.setUint32(12, tamanho, true);
  f.setUint32(16, pos, true);
  return [...locais, ...centrais, new Uint8Array(f.buffer)];
}
