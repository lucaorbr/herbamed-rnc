const test = require("node:test");
const assert = require("node:assert/strict");
const { vigenciasParaPreencher, aplicarVigencias, diaBrasilia } = require("./vigenciaHistorico");

const ts = (iso) => new Date(iso).getTime();
const aud = (acao, iso, depois) => ({ docId: "d1", acao, ts: ts(iso), dadosDepois: depois ? JSON.stringify(depois) : null });

test("POP migrado como Rev.01: vigência da 01 vem da aprovação antes da Nova Revisão — Rev.02", () => {
  const doc = { id: "d1", versao: "02", historicoRevisoes: [{ versao: "01", versaoAlvo: "02", status: "Vigente", data: "2026-07-10" }] };
  const { preencher, pulados } = vigenciasParaPreencher(doc, [
    aud("Assinou como Elaborador", "2026-06-16T12:00:00Z"),
    aud("Assinou como Aprovador", "2026-06-20T12:00:00Z", { status: "Vigente", dataVigencia: "2026-06-22" }),
    aud("Nova Revisão — Rev.02", "2026-07-10T12:00:00Z"),
  ]);
  assert.deepEqual(pulados, []);
  assert.equal(preencher.length, 1);
  assert.equal(preencher[0].vigencia, "2026-06-22");
});

test("várias revisões: cada versão pega a aprovação da sua janela", () => {
  const doc = { id: "d1", versao: "02", historicoRevisoes: [
    { versao: "00", versaoAlvo: "01", status: "Vigente" },
    { versao: "01", versaoAlvo: "02", status: "Vigente" },
  ] };
  const { preencher } = vigenciasParaPreencher(doc, [
    aud("Assinou como Aprovador", "2026-01-10T12:00:00Z", { dataVigencia: "2026-01-10" }),
    aud("Nova Revisão — Rev.01", "2026-03-01T12:00:00Z"),
    aud("Assinou como Aprovador", "2026-03-15T12:00:00Z", { dataVigencia: "2026-03-20" }),
    aud("Nova Revisão — Rev.02", "2026-06-01T12:00:00Z"),
  ]);
  assert.deepEqual(preencher.map((p) => [p.versao, p.vigencia]), [["00", "2026-01-10"], ["01", "2026-03-20"]]);
});

test("recusa e reassinatura: vale a última aprovação antes da revisão seguinte", () => {
  const doc = { id: "d1", versao: "01", historicoRevisoes: [{ versao: "00", versaoAlvo: "01", status: "Vigente" }] };
  const { preencher } = vigenciasParaPreencher(doc, [
    aud("Assinou como Aprovador", "2026-01-10T12:00:00Z", { dataVigencia: "2026-01-10" }),
    aud("Assinou como Aprovador", "2026-02-10T12:00:00Z", { dataVigencia: "2026-02-12" }),
    aud("Nova Revisão — Rev.01", "2026-05-01T12:00:00Z"),
  ]);
  assert.equal(preencher[0].vigencia, "2026-02-12");
});

test("aprovação antiga sem dataVigencia usa o dia da assinatura em Brasília", () => {
  const doc = { id: "d1", versao: "01", historicoRevisoes: [{ versao: "00", versaoAlvo: "01", status: "Vigente" }] };
  const { preencher } = vigenciasParaPreencher(doc, [
    aud("Assinou como Aprovador", "2026-02-11T01:30:00Z", { status: "Vigente" }), // 22h30 do dia 10 em Brasília
    aud("Nova Revisão — Rev.01", "2026-05-01T12:00:00Z"),
  ]);
  assert.equal(preencher[0].vigencia, "2026-02-10");
});

test("não mexe no que já tem vigência, nem em versão nunca aprovada, e explica o que pulou", () => {
  const doc = { id: "d1", versao: "03", historicoRevisoes: [
    { versao: "00", versaoAlvo: "01", status: "Vigente", vigenciaVersao: "2025-01-01" },
    { versao: "01", versaoAlvo: "02", status: "Rascunho" },
    { versao: "02", versaoAlvo: "03", status: "Vigente" },
  ] };
  const { preencher, pulados } = vigenciasParaPreencher(doc, [aud("Nova Revisão — Rev.03", "2026-05-01T12:00:00Z")]);
  assert.deepEqual(preencher, []);
  assert.deepEqual(pulados.map((p) => p.versao), ["01", "02"]);
});

test("ignora auditoria de outro documento", () => {
  const doc = { id: "d1", versao: "01", historicoRevisoes: [{ versao: "00", versaoAlvo: "01", status: "Vigente" }] };
  const outro = { ...aud("Assinou como Aprovador", "2026-01-10T12:00:00Z", { dataVigencia: "2026-01-10" }), docId: "d2" };
  const { preencher } = vigenciasParaPreencher(doc, [outro, aud("Nova Revisão — Rev.01", "2026-05-01T12:00:00Z")]);
  assert.deepEqual(preencher, []);
});

test("aplicar só acrescenta vigenciaVersao e a origem, sem tocar no resto", () => {
  const doc = { id: "d1", titulo: "X", historicoRevisoes: [{ versao: "00", versaoAlvo: "01", data: "2026-07-17", descricao: "d" }] };
  const novo = aplicarVigencias(doc, [{ idx: 0, vigencia: "2026-06-25", fonte: "f" }], "06/11/2026");
  assert.equal(novo.historicoRevisoes[0].vigenciaVersao, "2026-06-25");
  assert.equal(novo.historicoRevisoes[0].data, "2026-07-17");
  assert.match(novo.historicoRevisoes[0].vigenciaVersaoOrigem, /log de auditoria/);
  assert.equal(doc.historicoRevisoes[0].vigenciaVersao, undefined);
  assert.equal(diaBrasilia(ts("2026-06-01T12:00:00Z")), "2026-06-01");
});
