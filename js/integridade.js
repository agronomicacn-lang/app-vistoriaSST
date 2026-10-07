// Integridade da exportação (spec §7), com as mesmas regras do PC (laudo/vistoria_importar.py).
import { sha256Hex } from "./pacote.js";

// sha256 de "nome:hash\n" em ordem alfabética dos nomes
export function hashLista(itens) {
  return sha256Hex(Object.keys(itens).sort().map((n) => `${n}:${itens[n]}\n`).join(""));
}

export async function reciboDe(id, sha256Total) {
  return (await sha256Hex(`${id}:${sha256Total}:importado`)).slice(0, 8).toUpperCase();
}
