// Armazenamento no aparelho (IndexedDB): diligências e eventos (lista que só cresce).
import { ehNativo } from "./nativo.js";

const NOME = "vistoria";
const VERSAO = 1;
let banco;

export function abrirBanco() {
  banco ??= new Promise((ok, erro) => {
    const r = indexedDB.open(NOME, VERSAO);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore("diligencias", { keyPath: "id" });
      db.createObjectStore("eventos", { autoIncrement: true }).createIndex("diligencia", "diligencia");
      db.createObjectStore("fotos", { keyPath: "id" });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
  return banco;
}

function transacao(lojas, modo, fazer) {
  return abrirBanco().then((db) => new Promise((ok, erro) => {
    const t = db.transaction(lojas, modo);
    const pedido = fazer(t);
    t.oncomplete = () => ok(pedido?.result);
    t.onerror = () => erro(t.error);
    t.onabort = () => erro(t.error ?? new Error("gravação cancelada"));
  }));
}

export const salvarDiligencia = (d) => transacao(["diligencias"], "readwrite", (t) => t.objectStore("diligencias").put(d));
export const listarDiligencias = () => transacao(["diligencias"], "readonly", (t) => t.objectStore("diligencias").getAll());
export const acrescentarEvento = (diligencia, evento) =>
  transacao(["eventos"], "readwrite", (t) => t.objectStore("eventos").add({ diligencia, evento }));
export const eventosDe = (diligencia) =>
  transacao(["eventos"], "readonly", (t) => t.objectStore("eventos").index("diligencia").getAll(diligencia))
    .then((lista) => lista.map((x) => x.evento));

export async function pedirPersistencia() {
  if (ehNativo()) return true; // aplicativo instalado: os dados não são apagados pela limpeza do navegador
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

// fotos: chave "<diligência>:<foto>"; o Blob é o arquivo original da câmera
const faixaFotos = (d) => IDBKeyRange.bound(`${d}:`, `${d}:\uffff`);
export const salvarFoto = (diligencia, foto, blob, sha256) =>
  transacao(["fotos"], "readwrite", (t) => t.objectStore("fotos").put({ id: `${diligencia}:${foto}`, diligencia, foto, blob, sha256 }));
export const fotoDe = (diligencia, foto) =>
  transacao(["fotos"], "readonly", (t) => t.objectStore("fotos").get(`${diligencia}:${foto}`));
export const fotosDaDiligencia = (diligencia) =>
  transacao(["fotos"], "readonly", (t) => t.objectStore("fotos").getAll(faixaFotos(diligencia)));

export async function atualizarDiligencia(id, mudar) {
  const d = (await listarDiligencias()).find((x) => x.id === id);
  if (d) await salvarDiligencia(mudar(d));
}

export function apagarDiligencia(id) {
  return transacao(["diligencias", "eventos", "fotos"], "readwrite", (t) => {
    t.objectStore("diligencias").delete(id);
    t.objectStore("fotos").delete(faixaFotos(id));
    t.objectStore("eventos").index("diligencia").openCursor(IDBKeyRange.only(id)).onsuccess = (ev) => {
      const c = ev.target.result;
      if (c) {
        c.delete();
        c.continue();
      }
    };
  });
}
