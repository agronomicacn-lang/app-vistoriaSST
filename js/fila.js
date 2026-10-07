// Fila de gravação no aparelho: grava na ordem; se uma gravação falha, o item fica pendente e é
// refeito antes de qualquer item novo, até conseguir. Nada é descartado.
export function criarFila(gravar, { aoSalvar = () => {}, aoFalhar = () => {} } = {}) {
  const pendentes = [];
  let corrente = Promise.resolve();

  async function drenar() {
    while (pendentes.length) {
      try {
        await gravar(pendentes[0]);
        pendentes.shift();
      } catch (e) {
        aoFalhar(e, pendentes.length);
        return false;
      }
    }
    aoSalvar();
    return true;
  }

  const agendar = () => (corrente = corrente.then(drenar));
  return {
    acrescentar(item) {
      pendentes.push(item);
      return agendar();
    },
    tentarDeNovo: agendar,
    get pendentes() {
      return pendentes.length;
    },
  };
}
