const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validarGravacaoColecao, validarExclusaoColecao, validarGravacaoRNC, validarExclusaoRNC,
  camposProibidosNoCadastro, precisaDoAnterior,
} = require("./permissoesColecao");

const u = (role, permissoes = {}, id = "u1") => ({ id, role, permissoes });
const viewer = u("viewer"), exec = u("exec"), user = u("user"), rt = u("rt"), admin = u("admin");

test("visualizador e executivo não gravam em coleção nenhuma", () => {
  for (const col of ["desvios", "cq_fichas", "fornecedores", "configuracoes", "gestao_docs", "fmea", "colecao_nova"]) {
    assert.throws(() => validarGravacaoColecao(viewer, col, {}), { status: 403 }, col);
    assert.throws(() => validarGravacaoColecao(exec, col, {}), { status: 403 }, col);
  }
});

test("coleção com permissão na tela exige a mesma permissão", () => {
  assert.doesNotThrow(() => validarGravacaoColecao(user, "desvios", {}));
  assert.throws(() => validarGravacaoColecao(u("user", { criarDesvio: false }), "desvios", {}), { status: 403 });
  assert.doesNotThrow(() => validarGravacaoColecao(u("viewer", { criarDesvio: true }), "desvios", {}));
  assert.throws(() => validarGravacaoColecao(user, "rnc_reunioes", {}), { status: 403 });
  assert.doesNotThrow(() => validarGravacaoColecao(rt, "rnc_reunioes", {}));
});

test("configurações, catálogos e colaboradores só o admin grava", () => {
  for (const col of ["configuracoes", "colaboradores"]) {
    assert.throws(() => validarGravacaoColecao(rt, col, {}), { status: 403 });
    assert.throws(() => validarGravacaoColecao(u("keyuser"), col, {}), { status: 403 });
    assert.doesNotThrow(() => validarGravacaoColecao(admin, col, {}));
  }
});

test("telas sem permissão própria seguem abertas a quem trabalha", () => {
  for (const col of ["cq_fichas", "fornecedores", "auditorias", "ipc_registros", "producao_processos", "colecao_nova"]) {
    assert.doesNotThrow(() => validarGravacaoColecao(user, col, {}), col);
  }
});

test("Li e entendi: sem gerir treinamento, só o próprio registro de leitura", () => {
  const meu = { userId: "u9", modo: "leitura" };
  const leitor = u("viewer", {}, "u9");
  assert.doesNotThrow(() => validarGravacaoColecao(leitor, "treinamentos", meu, null));
  assert.doesNotThrow(() => validarGravacaoColecao(leitor, "leitura_aberturas", { userId: "u9" }, null));
  assert.throws(() => validarGravacaoColecao(leitor, "treinamentos", { userId: "u8", modo: "leitura" }), { status: 403 });
  assert.throws(() => validarGravacaoColecao(leitor, "treinamentos", { userId: "u9", modo: "presencial" }), { status: 403 });
  // não toma o registro de outra pessoa trocando o userId
  assert.throws(() => validarGravacaoColecao(leitor, "treinamentos", meu, { userId: "u8" }), { status: 403 });
  // quem gere treinamento lança para qualquer um
  assert.doesNotThrow(() => validarGravacaoColecao(rt, "treinamentos", { userId: "u8", modo: "presencial" }));
  assert.equal(precisaDoAnterior("treinamentos"), true);
});

test("trilha antiga não recebe gravação pela rota genérica, nem do admin", () => {
  assert.throws(() => validarGravacaoColecao(viewer, "audit_log", { acao: "x" }, null), { status: 403 });
  assert.throws(() => validarGravacaoColecao(admin, "audit_log", { acao: "x" }, null), { status: 403 });
  assert.throws(() => validarGravacaoColecao(admin, "audit_log", { acao: "x" }, { acao: "y" }), { status: 403 });
  assert.throws(() => validarExclusaoColecao(admin, "audit_log"), { status: 403 });
});

test("exclusão de documento exige excluirDocumento; evidência só o admin", () => {
  assert.throws(() => validarExclusaoColecao(rt, "gestao_docs"), { status: 403 });
  assert.doesNotThrow(() => validarExclusaoColecao(u("keyuser"), "gestao_docs"));
  assert.throws(() => validarExclusaoColecao(rt, "treinamentos"), { status: 403 });
  assert.throws(() => validarExclusaoColecao(viewer, "desvios"), { status: 403 });
});

test("RNC: visualizador não grava; exclusão exige excluirRNC", () => {
  assert.throws(() => validarGravacaoRNC(viewer), { status: 403 });
  assert.throws(() => validarGravacaoRNC(exec), { status: 403 });
  assert.doesNotThrow(() => validarGravacaoRNC(user));
  assert.throws(() => validarExclusaoRNC(user), { status: 403 });
  assert.doesNotThrow(() => validarExclusaoRNC(rt));
});

test("cadastro: ninguém se dá permissão nem troca o próprio papel", () => {
  const atual = { role: "user", permissoes: { criarRNC: true, triarDesvio: false } };
  assert.deepEqual(camposProibidosNoCadastro(user, "u1", { online: true }, atual), []);
  assert.deepEqual(camposProibidosNoCadastro(user, "u1", { permissoes: { triarDesvio: true } }, atual), ["permissoes"]);
  assert.deepEqual(camposProibidosNoCadastro(user, "u1", { role: "admin" }, atual), ["role"]);
  // mesmo valor, outra ordem de chaves (o jsonb reordena) — não é alteração
  assert.deepEqual(camposProibidosNoCadastro(user, "u1", { role: "user", permissoes: { triarDesvio: false, criarRNC: true } }, atual), []);
  assert.deepEqual(camposProibidosNoCadastro(user, "u2", { online: true }, atual), ["*"]);
  assert.deepEqual(camposProibidosNoCadastro(admin, "u2", { permissoes: { x: true }, role: "rt" }, atual), []);
});

test("cadastro: nome, e-mail, setor, CRF e cargo só o admin altera", () => {
  const atual = { name: "Ana", email: "ana@x", setor: "Qualidade", crf: "CRF-1", data: { cargo: "Analista", cargoId: "analista" } };
  assert.deepEqual(camposProibidosNoCadastro(user, "u1", { crf: "CRF-2" }, atual), ["crf"]);
  assert.deepEqual(camposProibidosNoCadastro(user, "u1", { cargo: "Farmacêutico RT", cargoId: "rt" }, atual), ["cargo", "cargoId"]);
  assert.deepEqual(camposProibidosNoCadastro(user, "u1", { email: "outro@x", name: "Bia", setor: "Produção" }, atual), ["email", "name", "setor"]);
  // campo que nem existe no cadastro também é do admin
  assert.deepEqual(camposProibidosNoCadastro(user, "u1", { assinatura: { img: "x" } }, atual), ["assinatura"]);
  // reenviar o que já está gravado (coluna ou JSON) não é alteração
  assert.deepEqual(camposProibidosNoCadastro(user, "u1", { crf: "CRF-1", cargo: "Analista", ultimoAcesso: "2026-11-23", online: true }, atual), []);
  assert.deepEqual(camposProibidosNoCadastro(admin, "u1", { crf: "CRF-2", cargo: "RT" }, atual), []);
});
