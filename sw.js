// Service worker: guarda os arquivos do app para uso sem internet.
// Rede primeiro (até 3 s), depois o que está guardado. O aviso de versão nova vem na Fase 4.
const VERSAO = "vistoria-0.4.5";
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
 "fontes/OFL.txt",
 "js/recebido.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)));
});

// a versão nova só assume quando o perito toca em "Atualizar" (nunca no meio de uma tela)
self.addEventListener("message", (e) => { if (e.data === "atualizar") self.skipWaiting(); });

const RECEBIDO = "vistoria-recebido"; // pacote recebido pelo "Compartilhar", até ser aberto no app

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO && k !== RECEBIDO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.pathname.endsWith("/receber-pacote")) {
    // "Compartilhar → Vistoria in loco" (WhatsApp, Arquivos, e-mail): o Android envia o arquivo para cá
    e.respondWith((async () => {
      const dados = await e.request.formData();
      const arquivos = dados.getAll("pacote").filter((x) => typeof x !== "string");
      // o que o Android mandou, para mostrar se o arquivo não for um pacote
      const campos = [...dados].map(([k, v]) => typeof v === "string" ? `${k}: "${v.slice(0, 80)}"`
        : `${k}: arquivo "${v.name}" (${v.type || "sem tipo"}, ${v.size} bytes)`).join("; ");
      const cache = await caches.open(RECEBIDO);
      // guarda os bytes como vieram (podem estar compactados): quem lê é a tela Abrir pacote
      await Promise.all(arquivos.map((a, i) => cache.put(`pacote-recebido/${i}`, new Response(a))));
      await cache.put("pacote-recebido", new Response("", { headers: {
        "X-Quantos": String(arquivos.length), "X-Recebido": encodeURIComponent(campos || "nada") } }));
      return Response.redirect(new URL("index.html#/abrir?recebido=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
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
