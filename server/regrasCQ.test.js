const test = require("node:test");
const assert = require("node:assert/strict");
const { validarGravacaoCQ, validarExclusaoCQ } = require("./regrasCQ");

const u = (role, permissoes = {}, name = "Ana") => ({ id: "1", role, name, permissoes });
const analista = u("user");                                   // lancarAnalise sim, aprovarAnalise não
const aprovador = u("user", { aprovarAnalise: true }, "Bia");
const rt = u("rt", {}, "Rita");                               // lança, aprova e edita aprovada

const analise = { num: "RA-1", lote: "L1", conclusao: "Aprovado", resultados: [{ nome: "pH", resultado: "6" }] };
const aprovacao = nome => ({ nome, data: "2026-11-23", conclusao: "Aprovado" });

test("analista lança e edita análise em aberto, mas não aprova", () => {
  assert.doesNotThrow(() => validarGravacaoCQ(analista, "cq_analises", "1", analise, null));
  assert.doesNotThrow(() => validarGravacaoCQ(analista, "cq_analises", "1", { ...analise, lote: "L2" }, analise));
  assert.throws(() => validarGravacaoCQ(analista, "cq_analises", "1", { ...analise, aprovacaoDisposicao: aprovacao("Ana") }, analise), { status: 403 });
  assert.throws(() => validarGravacaoCQ(u("viewer"), "cq_analises", "1", analise, null), { status: 403 });
});

test("aprovar disposição exige aprovarAnalise e o nome de quem está logado", () => {
  assert.doesNotThrow(() => validarGravacaoCQ(aprovador, "cq_analises", "1", { ...analise, aprovacaoDisposicao: aprovacao("Bia") }, analise));
  assert.throws(() => validarGravacaoCQ(aprovador, "cq_analises", "1", { ...analise, aprovacaoDisposicao: aprovacao("Outra") }, analise), { status: 403 });
});

test("aprovação gravada não se troca e análise aprovada só com editarAnalise", () => {
  const aprovada = { ...analise, aprovacaoDisposicao: aprovacao("Bia") };
  assert.throws(() => validarGravacaoCQ(rt, "cq_analises", "1", { ...aprovada, aprovacaoDisposicao: aprovacao("Rita") }, aprovada), { status: 409 });
  assert.throws(() => validarGravacaoCQ(rt, "cq_analises", "1", { ...analise }, aprovada), { status: 409 });
  assert.throws(() => validarGravacaoCQ(analista, "cq_analises", "1", { ...aprovada, lote: "L9" }, aprovada), { status: 403 });
  assert.doesNotThrow(() => validarGravacaoCQ(rt, "cq_analises", "1", { ...aprovada, lote: "L9" }, aprovada));
  // regravar igual (ex.: ordem de chaves diferente) não é edição
  assert.doesNotThrow(() => validarGravacaoCQ(analista, "cq_analises", "1", { resultados: aprovada.resultados, ...aprovada }, aprovada));
});

test("exclusão de análise segue a mesma regra", () => {
  assert.doesNotThrow(() => validarExclusaoCQ(analista, "cq_analises", analise));
  assert.throws(() => validarExclusaoCQ(analista, "cq_analises", { ...analise, aprovacaoDisposicao: aprovacao("Bia") }), { status: 403 });
  assert.doesNotThrow(() => validarExclusaoCQ(rt, "cq_fichas", { ...analise, aprovacaoDisposicao: aprovacao("Bia") }));
});

test("material e template exigem criarMaterialCQ, salvo o material novo do Areco", () => {
  assert.throws(() => validarGravacaoCQ(analista, "cq_materiais", "m1", { nome: "X" }, null), { status: 403 });
  assert.throws(() => validarGravacaoCQ(analista, "cq_templates", "t1", { nome: "T" }, null), { status: 403 });
  assert.doesNotThrow(() => validarGravacaoCQ(rt, "cq_materiais", "m1", { nome: "X" }, null));
  assert.doesNotThrow(() => validarGravacaoCQ(analista, "cq_materiais", "areco-123", { nome: "X" }, null));
  assert.throws(() => validarGravacaoCQ(analista, "cq_materiais", "areco-123", { nome: "Y" }, { nome: "X" }), { status: 403 });
  assert.throws(() => validarExclusaoCQ(analista, "cq_materiais", { nome: "X" }), { status: 403 });
});
