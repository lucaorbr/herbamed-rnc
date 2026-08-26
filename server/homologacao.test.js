const test = require("node:test");
const assert = require("node:assert/strict");
const { hasHomologacaoPermission, validateHomologacaoUpdate } = require("./homologacao");

const user = (id, role = "user", permissoes = {}) => ({ id, role, permissoes });
const base = { id: "h1", status: "Rascunho", criadoPorId: "u1" };

test("permissoes por papel aceitam override explicito", () => {
  assert.equal(hasHomologacaoPermission(user("1", "user"), "criarHomologacao"), true);
  assert.equal(hasHomologacaoPermission(user("1", "user"), "aprovarHomologacao"), false);
  assert.equal(hasHomologacaoPermission(user("1", "user", { aprovarHomologacao: true }), "aprovarHomologacao"), true);
});

test("nova homologacao nasce em rascunho e pertence ao usuario", () => {
  assert.doesNotThrow(() => validateHomologacaoUpdate(user("u1"), null, base));
  assert.throws(() => validateHomologacaoUpdate(user("u2"), null, base), /solicitante/i);
  assert.throws(() => validateHomologacaoUpdate(user("u1"), null, { ...base, status: "Em análise" }), /Rascunho/);
});

test("parecer exige permissao, assinatura propria e segregacao", () => {
  const assinatura = { userId: "u2" };
  const next = { ...base, status: "Aguardando aprovação", parecerTecnico: { assinatura } };
  assert.doesNotThrow(() => validateHomologacaoUpdate(user("u2", "rt"), { ...base, status: "Em análise" }, next));
  assert.throws(() => validateHomologacaoUpdate(user("u1", "rt"), { ...base, status: "Em análise" }, { ...next, parecerTecnico: { assinatura: { userId: "u1" } } }), /diferente do solicitante/i);
  assert.throws(() => validateHomologacaoUpdate(user("u2", "user"), { ...base, status: "Em análise" }, next), /permissao/i);
});

test("decisao final exige terceiro usuario e condicoes quando condicional", () => {
  const old = { ...base, status: "Aguardando aprovação", parecerTecnico: { assinatura: { userId: "u2" } } };
  const final = { ...old, status: "Homologada", decisaoFinal: { assinatura: { userId: "u3" } } };
  assert.doesNotThrow(() => validateHomologacaoUpdate(user("u3", "rt"), old, final));
  assert.throws(() => validateHomologacaoUpdate(user("u2", "rt"), old, { ...final, decisaoFinal: { assinatura: { userId: "u2" } } }), /diferente/);
  assert.throws(() => validateHomologacaoUpdate(user("u3", "rt"), old, { ...final, status: "Condicional", decisaoFinal: { assinatura: { userId: "u3" }, condicoes: "" } }), /condicoes/i);
});

test("registro finalizado e transicoes puladas ficam bloqueados", () => {
  assert.throws(() => validateHomologacaoUpdate(user("u3", "admin"), { ...base, status: "Homologada" }, { ...base, status: "Rascunho" }), /finalizada/i);
  assert.throws(() => validateHomologacaoUpdate(user("u2", "rt"), base, { ...base, status: "Homologada" }), /Transicao/);
});
