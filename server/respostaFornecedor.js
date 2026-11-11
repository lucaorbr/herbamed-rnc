// Link público do fornecedor: quando ele pode responder e como a resposta entra na RNC.
// Puro, para testar. Espelha `complementoAberto` de src/features/rnc/tipoRncLogic.js
// (o servidor é CommonJS e não importa o front).
//
// Regra (v3.29.0): o link responde uma vez. Se a Qualidade pedir complemento
// (`rnc.complementoFornecedor.pedidoEm` mais novo que a última resposta), o MESMO link
// volta a aceitar resposta. A resposta anterior não se perde: vai para
// `respostasFornecedorAnteriores[]`.

const ts = v => (v ? new Date(v).getTime() || 0 : 0);

function ultimaRespostaEm(rnc) {
  const datas = [rnc?.respostaFornecedor?.respondidoEm, ...((rnc?.respostasPlanilha || []).map(p => p.em))].filter(Boolean);
  if (!datas.length) return null;
  return datas.reduce((a, b) => (ts(b) > ts(a) ? b : a));
}

function complementoAberto(rnc) {
  const pedido = rnc?.complementoFornecedor?.pedidoEm;
  return !!pedido && ts(pedido) > ts(ultimaRespostaEm(rnc));
}

/** O link (token) pode receber resposta agora? */
function podeResponder(token, rnc) {
  if (!token?.respondido_em) return true;
  return complementoAberto(rnc);
}

/** Dados da RNC com a resposta nova; a anterior vai para o arquivo. */
function rncComResposta(rnc, resposta) {
  const anteriores = rnc?.respostaFornecedor
    ? [...(rnc.respostasFornecedorAnteriores || []), rnc.respostaFornecedor]
    : (rnc?.respostasFornecedorAnteriores || []);
  return { ...rnc, respostaFornecedor: resposta, respostasFornecedorAnteriores: anteriores };
}

module.exports = { podeResponder, complementoAberto, rncComResposta };
