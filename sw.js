// Service worker: guarda os arquivos do app para uso sem internet.
// Rede primeiro (atÃ© 3 s), depois o que estÃ¡ guardado. O aviso de versÃ£o nova vem na Fase 4.
const VERSAO = "vistoria-0.4.0";
const ARQUIVOS = [
 "./",
 "index.html",
 "manifest.webmanifest",
 "catalogo.json",
 "css/app.css",
 "icones/icone-192.png",
 "icones/icone-512.png",
 "js/adiar.js",
 "js/app.js",
 "js/db.js",
 "js/estado.js",
 "js/faltas.js",
 "js/fila.js",
 "js/meses.js",
 "js/origem.js",
 "js/pacote.js",
 "js/texto.js",
 "js/ui/abrir.js",
 "js/ui/alegacoes.js",
 "js/ui/campos.js",
 "js/ui/dom.js",
 "js/ui/faltas.js",
 "js/ui/fato.js",
 "js/ui/modulo.js",
 "js/ui/modulos.js",
 "js/ui/periodo.js",
 "js/ui/roteiro.js",
 "js/integridade.js",
 "js/pdf.js",
 "js/zip.js",
 "js/ata.js",
 "js/exportacao.js",
 "js/ui/assinatura.js",
 "js/ui/fotos.js",
 "js/ui/presenca.js",
 "js/ui/ata.js",
 "js/ui/encerramento.js",
 "js/ui/exportar.js",
 "fontes/AtkinsonHyperlegible-Regular.ttf",
 "fontes/AtkinsonHyperlegible-Bold.ttf",
 "fontes/OFL.txt"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)));
});

// a versÃ£o nova sÃ³ assume quando o perito toca em "Atualizar" (nunca no meio de uma tela)
self.addEventListener("message", (e) => { if (e.data === "atualizar") self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    try {
      const r = await Promise.race([fetch(e.request),
        new Promise((_, nao) => setTimeout(() => nao(new Error("sem resposta")), 3000))]);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: true })) ?? Response.error();
    }
  })());
});
