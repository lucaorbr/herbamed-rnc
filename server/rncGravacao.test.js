const test = require("node:test");
const assert = require("node:assert/strict");
const { mesclarPatchRNC, validarSubstituicaoRNC } = require("./rncGravacao");

const rnc = {
  id: "r1", num: "220926 1", desc: "Cápsula amassada", sev: "Maior", prazoAC: "2026-10-10",
  status: "Aberta", historico: [{ acao: "RNC aberta" }],
};

test("PATCH de status preserva número, descrição e prazos", () => {
  const out = mesclarPatchRNC(rnc, { status: "Em andamento", historico: [...rnc.historico, { acao: "Status" }] }, "r1");
  assert.equal(out.num, "220926 1");
  assert.equal(out.desc, "Cápsula amassada");
  assert.equal(out.prazoAC, "2026-10-10");
  assert.equal(out.status, "Em andamento");
  assert.equal(out.historico.length, 2);
});

test("PATCH não troca o id do registro", () => {
  assert.equal(mesclarPatchRNC(rnc, { id: "outro" }, "r1").id, "r1");
});

test("PATCH sobre registro vazio devolve só o patch com id", () => {
  assert.deepEqual(mesclarPatchRNC(null, { status: "Aberta" }, "x"), { status: "Aberta", id: "x" });
});

test("PUT com a RNC completa passa", () => {
  assert.doesNotThrow(() => validarSubstituicaoRNC(rnc, { ...rnc, desc: "editada" }));
});

test("PUT sem número sobre RNC numerada é recusado com 409", () => {
  assert.throws(() => validarSubstituicaoRNC(rnc, { id: "r1", status: "Em andamento" }), e => e.status === 409);
});

test("PUT de RNC nova (sem registro anterior) passa", () => {
  assert.doesNotThrow(() => validarSubstituicaoRNC(undefined, { id: "r2", status: "Aberta" }));
});
