const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validarGravacaoColecao, validarExclusaoColecao, validarExclusaoRNC,
  camposProibidosNoCadastro, precisaDoAnterior, validarLeituraColecao, filtrarLeituraColecao,
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
  for (const col of ["cq_fichas", "fmea", "producao_processos", "colecao_nova"]) {
    assert.doesNotThrow(() => validarGravacaoColecao(user, col, {}), col);
  }
});

test("fornecedores e IPC: cada um com a própria permissão; excluir fornecedor só o admin", () => {
  // Usuário: padrão sem editarFornecedores e sem catálogo IPC, mas lança IPC.
  assert.throws(() => validarGravacaoColecao(user, "fornecedores", {}), { status: 403 });
  assert.doesNotThrow(() => validarGravacaoColecao(rt, "fornecedores", {}));
  assert.doesNotThrow(() => validarGravacaoColecao(u("user", { editarFornecedores: true }), "fornecedores", {}));
  assert.throws(() => validarExclusaoColecao(rt, "fornecedores"), { status: 403 });
  assert.doesNotThrow(() => validarExclusaoColecao(admin, "fornecedores"));

  assert.doesNotThrow(() => validarGravacaoColecao(user, "ipc_registros", {}));
  assert.doesNotThrow(() => validarExclusaoColecao(user, "ipc_registros"));
  assert.throws(() => validarGravacaoColecao(u("user", { editarIPC: false }), "ipc_registros", {}), { status: 403 });

  assert.throws(() => validarGravacaoColecao(user, "ipc_produtos", {}), { status: 403 });
  assert.throws(() => validarGravacaoColecao(rt, "ipc_produtos", {}), { status: 403 });
  assert.doesNotThrow(() => validarGravacaoColecao(u("keyuser"), "ipc_produtos", {}));
  assert.throws(() => validarExclusaoColecao(user, "ipc_produtos"), { status: 403 });
});

test("auditorias e clientes: cada um com a própria permissão; excluir só o admin", () => {
  // Usuário: padrão sem criarAuditorias e sem editarClientes.
  for (const [col, perm] of [["auditorias", "criarAuditorias"], ["clientes_terceiros", "editarClientes"]]) {
    assert.throws(() => validarGravacaoColecao(user, col, {}), { status: 403 }, col);
    assert.doesNotThrow(() => validarGravacaoColecao(rt, col, {}), col);
    assert.doesNotThrow(() => validarGravacaoColecao(u("user", { [perm]: true }), col, {}), col);
    assert.throws(() => validarGravacaoColecao(u("rt", { [perm]: false }), col, {}), { status: 403 }, col);
    assert.throws(() => validarExclusaoColecao(u("keyuser"), col), { status: 403 }, col);
    assert.doesNotThrow(() => validarExclusaoColecao(admin, col), col);
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

test("RNC: exclusão exige excluirRNC (gravação em regrasRNC.test.js)", () => {
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

test("leitura: permissão 'Visualizar' desmarcada barra a coleção", () => {
  const semDesvios = u("user", { verDesvios: false });
  assert.throws(() => validarLeituraColecao(semDesvios, "desvios"), { status: 403 });
  assert.doesNotThrow(() => validarLeituraColecao(user, "desvios"));
  assert.doesNotThrow(() => validarLeituraColecao(u("user", { verDesvios: false, triarDesvio: true }), "desvios"));
  assert.throws(() => validarLeituraColecao(u("user", { verRevalidacao: false, criarRevalidacao: false }), "revalidacoes"), { status: 403 });
  assert.throws(() => validarLeituraColecao(u("user", { verDocumentos: false }), "gestao_docs"), { status: 403 });
  // o painel do Executivo conta documentos, mesmo sem a área de documentos
  assert.doesNotThrow(() => validarLeituraColecao(exec, "gestao_docs"));
  // coleção fora do mapa segue aberta a quem está logado
  assert.doesNotThrow(() => validarLeituraColecao(viewer, "fornecedores"));
});

test("leitura: trilha antiga só para o admin", () => {
  assert.throws(() => validarLeituraColecao(rt, "audit_log"), { status: 403 });
  assert.doesNotThrow(() => validarLeituraColecao(admin, "audit_log"));
});

test("leitura: acesso restrito a vigentes só recebe documento Vigente", () => {
  const docs = [{ id: "a", status: "Vigente" }, { id: "b", status: "Rascunho" }, { id: "c", status: "Obsoleto" }];
  assert.deepEqual(filtrarLeituraColecao(viewer, "gestao_docs", docs).map(d => d.id), ["a"]);
  assert.equal(filtrarLeituraColecao(user, "gestao_docs", docs).length, 3);
  assert.equal(filtrarLeituraColecao(u("admin", { acessoRestritoVigente: true }), "gestao_docs", docs).length, 3);
  assert.equal(filtrarLeituraColecao(viewer, "desvios", docs).length, 3);
});
