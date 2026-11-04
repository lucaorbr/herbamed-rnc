const test = require("node:test");
const assert = require("node:assert/strict");
const { linhasHistoricoCapa } = require("./historicoCapa");

const transicao = (versao, versaoAlvo, extra = {}) => ({
  versao, versaoAlvo, data: "2026-07-17", itemModificado: "Revisão geral", descricao: "Revisão geral", conteudo: {}, ...extra,
});

test("documento novo, nunca revisado: só a Rev.00", () => {
  const rows = linhasHistoricoCapa({ versao: "00", status: "Vigente", criadoEm: "2026-06-01", dataVigencia: "2026-06-10" });
  assert.deepEqual(rows.map(r => [r.versao, r.data, r.descricao]), [["00", "2026-06-10", "Emissão inicial"]]);
});

test("rascunho nunca aprovado: Rev.00 em elaboração", () => {
  const rows = linhasHistoricoCapa({ versao: "00", status: "Rascunho", criadoEm: "2026-06-01" });
  assert.equal(rows[0].data, "Em elaboração");
});

test("documento migrado do papel já como Rev.01 não ganha uma Rev.00 inventada (POP-SGQ-002)", () => {
  const rows = linhasHistoricoCapa({
    versao: "02", status: "Em Revisão", criadoEm: "2026-06-16", dataVigencia: "2026-06-20",
    historicoRevisoes: [transicao("01", "02", { data: "2026-07-10" })],
  });
  assert.deepEqual(rows.map(r => r.versao), ["01", "02"]);
  assert.equal(rows[0].descricao, "Primeira versão registrada no sistema");
});

test("revisão aberta hoje não herda a data da versão anterior (POP-SGQ-009)", () => {
  const rows = linhasHistoricoCapa({
    versao: "01", status: "Em Revisão", criadoEm: "2026-06-19", dataVigencia: "2026-06-25",
    historicoRevisoes: [transicao("00", "01", { data: "2026-07-17" })],
  });
  assert.deepEqual(rows.map(r => [r.versao, r.data]), [["00", "2026-07-17"], ["01", "Em revisão"]]);
});

test("versão nova aprovada mostra a própria vigência; a anterior mostra a dela", () => {
  const rows = linhasHistoricoCapa({
    versao: "01", status: "Vigente", dataVigencia: "2026-11-10",
    historicoRevisoes: [transicao("00", "01", { vigenciaVersao: "2026-06-25", dataRevisao: "2026-11-04" })],
  });
  assert.deepEqual(rows.map(r => [r.versao, r.data]), [["00", "2026-06-25"], ["01", "2026-11-10"]]);
});

test("Em Revisão ignora a dataVigencia que ficou da versão anterior", () => {
  const rows = linhasHistoricoCapa({
    versao: "02", status: "Aguardando Aprovação", dataVigencia: "2026-08-01",
    historicoRevisoes: [
      transicao("00", "01", { vigenciaVersao: "2026-06-01" }),
      transicao("01", "02", { vigenciaVersao: "2026-08-01" }),
    ],
  });
  assert.deepEqual(rows.map(r => [r.versao, r.data]), [["00", "2026-06-01"], ["01", "2026-08-01"], ["02", "Em revisão"]]);
});

test("aprovado sem data de vigência usa a assinatura do Aprovador", () => {
  const rows = linhasHistoricoCapa({
    versao: "00", status: "Vigente", criadoEm: "2026-01-01",
    assinaturaAprovador: { timestamp: "2026-02-03T12:00:00.000Z" },
  });
  assert.equal(rows[0].data, "2026-02-03T12:00:00.000Z");
});

test("entrada antiga sem versaoAlvo segue a regra versão + 1", () => {
  const rows = linhasHistoricoCapa({
    versao: "01", status: "Vigente", dataVigencia: "2026-05-01",
    historicoRevisoes: [{ versao: "00", data: "2026-03-01", motivo: "Ajuste" }],
  });
  assert.deepEqual(rows.map(r => [r.versao, r.data, r.item]), [["00", "2026-03-01", "Documento completo"], ["01", "2026-05-01", "Ajuste"]]);
});
