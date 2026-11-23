const test = require("node:test");
const assert = require("node:assert");
const { diferencas, entradaDeAuditoria, linhaParaTela } = require("./auditoria");

test("só os campos que mudaram entram, com antes e depois", () => {
  const d = diferencas({ status: "Aberta", sev: "Maior", desc: "x" }, { status: "Em andamento", sev: "Maior", desc: "x" });
  assert.deepStrictEqual(d, [{ campo: "status", antes: "Aberta", depois: "Em andamento" }]);
});

test("lista que só cresceu no fim guarda só o acrescentado", () => {
  const h1 = [{ acao: "Criou" }];
  const h2 = [{ acao: "Criou" }, { acao: "Contenção" }];
  assert.deepStrictEqual(diferencas({ historico: h1 }, { historico: h2 }), [{ campo: "historico", acrescentado: [{ acao: "Contenção" }] }]);
});

test("lista que mudou no meio guarda antes e depois inteiros", () => {
  const d = diferencas({ w2h: [{ s: "A" }] }, { w2h: [{ s: "B" }, { s: "C" }] });
  assert.strictEqual(d[0].campo, "w2h");
  assert.deepStrictEqual(d[0].antes, [{ s: "A" }]);
});

test("ordem das chaves e campos de carimbo não geram diferença", () => {
  assert.deepStrictEqual(diferencas({ a: { x: 1, y: 2 }, updatedAt: 1 }, { a: { y: 2, x: 1 }, updatedAt: 2 }), []);
});

test("criação e exclusão listam os campos do registro", () => {
  const criou = entradaDeAuditoria({ user: { id: 7, name: "Ana", email: "a@x" }, colecao: "desvios", docId: "d1", antes: null, depois: { num: "DV-1", setor: "Envase" } });
  assert.strictEqual(criou.acao, "Criou");
  assert.strictEqual(criou.docNome, "DV-1");
  assert.strictEqual(criou.userId, "7");
  assert.deepStrictEqual(criou.alteracoes.map(a => a.campo), ["num", "setor"]);
  const excluiu = entradaDeAuditoria({ user: { id: 7 }, colecao: "desvios", docId: "d1", antes: { num: "DV-1" }, depois: null });
  assert.strictEqual(excluiu.acao, "Excluiu");
});

test("arquivo embutido vira marcador, não ocupa a trilha", () => {
  const d = diferencas({}, { foto: "data:image/png;base64," + "A".repeat(4000) });
  assert.match(d[0].depois, /^\[arquivo embutido, \d+ KB\]$/);
});

test("quem fez vem do usuário passado (sessão), nunca do registro gravado", () => {
  const e = entradaDeAuditoria({ user: { id: 1, name: "Sessão" }, colecao: "rncs", docId: "r", antes: null, depois: { usuario: "Forjado" } });
  assert.strictEqual(e.usuario, "Sessão");
});

test("linha da tabela mostra o rótulo da tela quando houver", () => {
  const l = linhaParaTela({ id: 3, ts: "10", data: new Date(0), usuario: "A", acao: "Alterou", rotulo: "Assinou como Aprovador", origem: "servidor", alteracoes: [] });
  assert.strictEqual(l.acao, "Assinou como Aprovador");
  assert.strictEqual(l.acaoSistema, "Alterou");
  assert.strictEqual(l.id, "s3");
});

test("objeto alterado lista só os itens que mudaram", () => {
  const d = diferencas({ permissoes: { criarRNC: true, excluirRNC: false } }, { permissoes: { criarRNC: true, excluirRNC: true } });
  assert.deepStrictEqual(d, [{ campo: "permissoes.excluirRNC", antes: false, depois: true }]);
});
