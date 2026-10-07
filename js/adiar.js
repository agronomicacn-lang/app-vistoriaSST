// Gravações adiadas (texto digitado ou ditado). Todas podem ser forçadas de uma vez antes de
// trocar de tela ou quando o app vai para o fundo, para não perder o fim do que foi digitado.
const pendentes = new Set();

export function adiado(fn, ms = 600) {
  let t = null;
  const executar = () => {
    clearTimeout(t);
    pendentes.delete(d);
    fn();
  };
  const d = () => {
    clearTimeout(t);
    pendentes.add(d);
    t = setTimeout(executar, ms);
  };
  d.agora = executar;
  return d;
}

export function gravarPendentes() {
  for (const d of [...pendentes]) d.agora();
}
