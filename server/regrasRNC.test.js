const test = require("node:test");
const assert = require("node:assert/strict");
const { validarAlteracaoRNC, validarCriacaoRNC, comAutoria, camposAlterados, rncPropria } = require("./regrasRNC");

const u = (role, permissoes = {}, id = "u1", name = "Ana") => ({ id, role, permissoes, name });
const ana = u("user");                                   // editarRNCpropria + analisarRNC, sem editarRNCtodas
const bruno = u("user", {}, "u2", "Bruno");
const rt = u("rt", {}, "u3", "Carla");
const so = (perms, id = "u4", name = "Davi") => u("user", { criarRNC: false, editarRNCpropria: false, editarRNCtodas: false, analisarRNC: false, gerenciarReunioesRNC: false, triarDesvio: false, ...perms }, id, name);

const rnc = (extra = {}) => ({ id: "r1", num: "NC-1", status: "Aberta", criadoPor: "Ana", criadoPorId: "u1", desc: "texto", lote: "L1", historico: [{ acao: "criada" }], ...extra });
const h2 = [{ acao: "criada" }, { acao: "nova" }];

test("camposAlterados ignora id e trata vazio/ausente como igual", () => {
  assert.deepEqual(camposAlterados({ id: 1, a: "", b: [] }, { id: 2, c: null }), []);
  assert.deepEqual(camposAlterados({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } }), []);
  assert.deepEqual(camposAlterados({ a: 1 }, { a: 2, b: "x" }), ["a", "b"]);
});

test("RNC própria: pelo id, pelo nome de quem registrou ou de quem detectou", () => {
  assert.equal(rncPropria(rnc(), ana), true);
  assert.equal(rncPropria(rnc({ criadoPorId: "", criadoPor: "" , detector: "Bruno" }), bruno), true);
  assert.equal(rncPropria(rnc(), bruno), false);
  assert.equal(rncPropria(rnc({ criadoPor: "", criadoPorId: "", detector: "" }), u("user", {}, "x", "")), false);
});

test("registro: Editar RNC própria só na própria; Editar qualquer RNC em todas", () => {
  const editada = r => ({ ...r, lote: "L2", historico: h2 });
  assert.doesNotThrow(() => validarAlteracaoRNC(ana, rnc(), editada(rnc())));
  assert.throws(() => validarAlteracaoRNC(bruno, rnc(), editada(rnc())), { status: 403, message: /Editar qualquer RNC/ });
  assert.doesNotThrow(() => validarAlteracaoRNC(rt, rnc(), editada(rnc())));
  assert.throws(() => validarAlteracaoRNC(so({ editarRNCtodas: false, analisarRNC: true }, "u1", "Ana"), rnc(), editada(rnc())), { status: 403 });
});

test("tratamento exige Tratar RNC, em qualquer RNC", () => {
  const capa = r => ({ ...r, w2h: [{ what: "x" }], prazoAC: "2026-12-01", historico: h2 });
  assert.doesNotThrow(() => validarAlteracaoRNC(bruno, rnc(), capa(rnc())));
  assert.throws(() => validarAlteracaoRNC(so({ editarRNCtodas: true }), rnc(), capa(rnc())), { status: 403, message: /w2h/ });
  // campo desconhecido conta como tratamento
  assert.throws(() => validarAlteracaoRNC(so({ editarRNCtodas: true }), rnc(), { ...rnc(), campoNovo: 1 }), { status: 403 });
});

test("status: Eficaz/Ineficaz só quem trata; Encerrada também pela RAC; demais com qualquer ação", () => {
  const st = s => ({ ...rnc(), status: s, historico: h2 });
  const editor = so({ editarRNCtodas: true });
  const rac = so({ gerenciarReunioesRNC: true });
  assert.doesNotThrow(() => validarAlteracaoRNC(editor, rnc(), st("Em andamento")));
  assert.throws(() => validarAlteracaoRNC(editor, rnc(), st("Eficaz")), { status: 403 });
  assert.throws(() => validarAlteracaoRNC(rac, rnc(), st("Ineficaz")), { status: 403 });
  assert.doesNotThrow(() => validarAlteracaoRNC(rac, rnc(), { ...st("Encerrada"), ultimaReuniao: { num: "RAC-1" } }));
  assert.throws(() => validarAlteracaoRNC(so({ criarRNC: true }), rnc(), st("Em andamento")), { status: 403 });
});

test("RAC grava deliberação e novo prazo; vínculo da sucessora exige Criar RNC", () => {
  const rac = so({ gerenciarReunioesRNC: true });
  assert.doesNotThrow(() => validarAlteracaoRNC(rac, rnc(), { ...rnc(), prazoAC: "2027-01-10", ultimaReuniao: { num: "RAC-1" }, historico: h2 }));
  assert.throws(() => validarAlteracaoRNC(so({ analisarRNC: true }), rnc(), { ...rnc(), ultimaReuniao: { num: "RAC-1" } }), { status: 403 });
  const ineficaz = rnc({ status: "Ineficaz" });
  const vinculo = { ...ineficaz, rncSucessora: { id: "r2", num: "NC-2" }, historico: h2 };
  assert.doesNotThrow(() => validarAlteracaoRNC(so({ criarRNC: true }), ineficaz, vinculo));
  assert.throws(() => validarAlteracaoRNC(so({ analisarRNC: true }), ineficaz, vinculo), { status: 403 });
});

test("assinatura do elaborador: só o autor, em nome próprio, sem troca", () => {
  const assinada = (r, uid) => ({ ...r, assinaturaElaborador: { uid, nome: "x" }, historico: h2 });
  assert.doesNotThrow(() => validarAlteracaoRNC(ana, rnc(), assinada(rnc(), "u1")));
  assert.throws(() => validarAlteracaoRNC(rt, rnc(), assinada(rnc(), "u3")), { status: 403 });
  assert.throws(() => validarAlteracaoRNC(ana, rnc(), assinada(rnc(), "u9")), { status: 403 });
  const ja = rnc({ assinaturaElaborador: { uid: "u1" } });
  assert.throws(() => validarAlteracaoRNC(ana, ja, assinada(ja, "u1b")), { status: 409 });
});

test("autoria não muda; admin pode o resto; sem permissão nenhuma nem chega a comparar", () => {
  assert.throws(() => validarAlteracaoRNC(rt, rnc(), { ...rnc(), criadoPor: "Carla" }), { status: 409 });
  assert.doesNotThrow(() => validarAlteracaoRNC(u("admin", {}, "a", "Adm"), rnc(), { ...rnc(), lote: "X", w2h: [1] }));
  assert.throws(() => validarAlteracaoRNC(u("viewer"), rnc(), rnc()), { status: 403 });
  // gravar sem mudar nada (ex.: só reenvio) passa para quem tem alguma permissão
  assert.doesNotThrow(() => validarAlteracaoRNC(bruno, rnc(), { ...rnc() }));
});

test("criação: Criar RNC ou Triar desvio; autoria carimbada pelo servidor", () => {
  assert.doesNotThrow(() => validarCriacaoRNC(ana, {}));
  assert.doesNotThrow(() => validarCriacaoRNC(so({ triarDesvio: true }), {}));
  assert.throws(() => validarCriacaoRNC(so({ analisarRNC: true }), {}), { status: 403 });
  assert.throws(() => validarCriacaoRNC(ana, { assinaturaElaborador: { uid: "u9" } }), { status: 403 });
  assert.deepEqual(
    (({ criadoPor, criadoPorId }) => ({ criadoPor, criadoPorId }))(comAutoria({ criadoPor: "Outro", criadoPorId: "9" }, ana)),
    { criadoPor: "Ana", criadoPorId: "u1" },
  );
});
