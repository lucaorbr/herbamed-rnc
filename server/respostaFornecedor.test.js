const test = require("node:test");
const assert = require("node:assert/strict");
const { podeResponder, complementoAberto, rncComResposta } = require("./respostaFornecedor");

const respondida = { respostaFornecedor: { causaRaiz: "x", respondidoEm: "2026-11-05T10:00:00Z" } };

test("link novo pode responder", () => {
  assert.equal(podeResponder({ respondido_em: null }, {}), true);
});

test("link já respondido não responde de novo", () => {
  assert.equal(podeResponder({ respondido_em: "2026-11-05T10:00:00Z" }, respondida), false);
});

test("pedido de complemento reabre o mesmo link", () => {
  const rnc = { ...respondida, complementoFornecedor: { pedidoEm: "2026-11-06T10:00:00Z" } };
  assert.equal(complementoAberto(rnc), true);
  assert.equal(podeResponder({ respondido_em: "2026-11-05T10:00:00Z" }, rnc), true);
});

test("complemento já atendido (resposta mais nova) fecha o link de novo", () => {
  const rnc = { respostaFornecedor: { respondidoEm: "2026-11-07T10:00:00Z" }, complementoFornecedor: { pedidoEm: "2026-11-06T10:00:00Z" } };
  assert.equal(podeResponder({ respondido_em: "2026-11-07T10:00:00Z" }, rnc), false);
});

test("resposta nova arquiva a anterior", () => {
  const out = rncComResposta({ ...respondida, num: "1" }, { causaRaiz: "y", respondidoEm: "2026-11-08T10:00:00Z" });
  assert.equal(out.respostaFornecedor.causaRaiz, "y");
  assert.equal(out.respostasFornecedorAnteriores.length, 1);
  assert.equal(out.respostasFornecedorAnteriores[0].causaRaiz, "x");
  assert.equal(out.num, "1");
  assert.equal(out.historico.at(-1).acao, "Resposta do fornecedor recebida (link público)");
});

test("resposta a um complemento entra no histórico como complemento", () => {
  const rnc = { ...respondida, complementoFornecedor: { pedidoEm: "2026-11-06T10:00:00Z" }, historico: [{ acao: "x" }] };
  const out = rncComResposta(rnc, { causaRaiz: "y" }, new Date("2026-11-08T13:00:00Z"));
  assert.equal(out.historico.length, 2);
  assert.match(out.historico[1].acao, /Complemento recebido/);
  assert.equal(out.historico[1].data, "2026-11-08");
});

test("primeira resposta não cria arquivo vazio de lixo", () => {
  const out = rncComResposta({ num: "1" }, { causaRaiz: "y" });
  assert.deepEqual(out.respostasFornecedorAnteriores, []);
});
