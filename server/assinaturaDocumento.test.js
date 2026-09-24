const test = require("node:test");
const assert = require("node:assert/strict");
const { validarAssinaturaDocumento, validarGravacaoDocumento } = require("./assinaturaDocumento");

const u = (id, role = "user", extra = {}) => ({ id, role, name: `Pessoa ${id}`, email: `p${id}@x.com`, ...extra });
const ass = (id, cod = `C-${id}`) => ({ uid: id, nome: `Pessoa ${id}`, email: `p${id}@x.com`, codigoVerificacao: cod });
const rota = { revisorId: "2", aprovadorId: "3" };
const emRevisao = { rota, assinaturaElaborador: ass("1") };
const aguardandoAprov = { ...emRevisao, assinaturaRevisor: ass("2") };

const status = fn => { try { fn(); return 200; } catch (e) { return e.status; } };

test("designado assina Revisor e Aprovador na ordem", () => {
  assert.equal(status(() => validarAssinaturaDocumento(u("2"), emRevisao, "Revisor")), 200);
  assert.equal(status(() => validarAssinaturaDocumento(u("3"), aguardandoAprov, "Aprovador")), 200);
});

test("admin fora da rota NÃO assina como Revisor nem Aprovador", () => {
  assert.equal(status(() => validarAssinaturaDocumento(u("9", "admin"), emRevisao, "Revisor")), 403);
  assert.equal(status(() => validarAssinaturaDocumento(u("9", "admin"), aguardandoAprov, "Aprovador")), 403);
});

test("admin designado na rota assina normalmente", () => {
  const doc = { ...emRevisao, rota: { revisorId: "9", aprovadorId: "3" } };
  assert.equal(status(() => validarAssinaturaDocumento(u("9", "admin"), doc, "Revisor")), 200);
});

test("sem designado na rota ninguém assina (documento anterior à rota)", () => {
  const doc = { assinaturaElaborador: ass("1") };
  assert.equal(status(() => validarAssinaturaDocumento(u("2"), doc, "Revisor")), 409);
  assert.equal(status(() => validarAssinaturaDocumento(u("9", "admin"), doc, "Revisor")), 409);
});

test("ordem: Aprovador antes do Revisor é recusado; papel já assinado também", () => {
  assert.equal(status(() => validarAssinaturaDocumento(u("3"), emRevisao, "Aprovador")), 409);
  assert.equal(status(() => validarAssinaturaDocumento(u("2"), aguardandoAprov, "Revisor")), 409);
});

test("segregação: mesma pessoa não assina dois papéis, mesmo designada", () => {
  const doc = { ...emRevisao, rota: { revisorId: "1", aprovadorId: "3" } };
  assert.equal(status(() => validarAssinaturaDocumento(u("1"), doc, "Revisor")), 403);
  const doc2 = { ...aguardandoAprov, rota: { revisorId: "2", aprovadorId: "2" } };
  assert.equal(status(() => validarAssinaturaDocumento(u("2"), doc2, "Aprovador")), 403);
});

test("segregação reconhece assinatura antiga sem id, por e-mail", () => {
  const doc = { rota: { revisorId: "1", aprovadorId: "3" }, assinaturaElaborador: { nome: "Outro nome", email: "P1@x.com" } };
  assert.equal(status(() => validarAssinaturaDocumento(u("1"), doc, "Revisor")), 403);
});

test("gravação: assinatura nova tem de ser do próprio usuário e seguir a rota", () => {
  const novo = { ...emRevisao, assinaturaRevisor: ass("2") };
  assert.equal(status(() => validarGravacaoDocumento(u("2"), emRevisao, novo)), 200);
  assert.equal(status(() => validarGravacaoDocumento(u("9", "admin"), emRevisao, novo)), 403);
  const doAdmin = { ...emRevisao, assinaturaRevisor: ass("9") };
  assert.equal(status(() => validarGravacaoDocumento(u("9", "admin"), emRevisao, doAdmin)), 403);
});

test("gravação: Elaborador define a rota junto com a própria assinatura", () => {
  const novo = { rota, assinaturaElaborador: ass("1") };
  assert.equal(status(() => validarGravacaoDocumento(u("1"), {}, novo)), 200);
});

test("gravação: outras edições preservando as assinaturas passam, por qualquer usuário", () => {
  assert.equal(status(() => validarGravacaoDocumento(u("9"), aguardandoAprov, { ...aguardandoAprov, titulo: "x" })), 200);
});

test("gravação: anular assinatura (recusa/troca) passa; substituir por outra não", () => {
  assert.equal(status(() => validarGravacaoDocumento(u("9", "admin"), aguardandoAprov, { ...aguardandoAprov, assinaturaRevisor: null })), 200);
  const trocada = { ...aguardandoAprov, assinaturaRevisor: ass("2", "OUTRO") };
  assert.equal(status(() => validarGravacaoDocumento(u("2"), aguardandoAprov, trocada)), 409);
});
