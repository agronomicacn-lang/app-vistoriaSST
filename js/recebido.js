// Pacote recebido pelo "Compartilhar" do Android: o service worker guarda o que chegou no cache
// "vistoria-recebido" e abre a tela Abrir pacote, que lê aqui (e apaga, para não abrir duas vezes).
// Formato atual: "pacote-recebido" (X-Quantos, X-Recebido) + "pacote-recebido/<i>" com cada arquivo.
// Formato da 0.4.1–0.4.3: o arquivo no corpo de "pacote-recebido" — o service worker antigo pode
// continuar ativo até o perito tocar em "Atualizar", enquanto as telas já vêm da versão nova.

export async function lerRecebidos(cache) {
  const indice = await cache.match("pacote-recebido");
  if (!indice) return null;
  const quantos = indice.headers.get("X-Quantos");
  const lista = [];
  if (quantos === null) {
    lista.push(new Uint8Array(await indice.arrayBuffer()));
  } else {
    for (let i = 0; i < Number(quantos); i++) {
      const a = await cache.match(`pacote-recebido/${i}`);
      if (a) lista.push(new Uint8Array(await a.arrayBuffer()));
      await cache.delete(`pacote-recebido/${i}`);
    }
  }
  await cache.delete("pacote-recebido");
  return { lista, recebido: decodeURIComponent(indice.headers.get("X-Recebido") ?? "") };
}
