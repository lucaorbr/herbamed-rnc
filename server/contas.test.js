const test = require("node:test");
const assert = require("node:assert");
const {
  MAX_TENTATIVAS, gerarSenhaTemporaria, bloqueadaAte, aposSenhaErrada, tokenValidoParaConta, podeExcluirConta,
} = require("./contas");

test("senha temporária é aleatória, legível e tem letras e dígitos", () => {
  const a = gerarSenhaTemporaria();
  const b = gerarSenhaTemporaria();
  assert.notStrictEqual(a, b);
  assert.match(a, /^[A-Za-z]{4}-[2-9]{4}-[A-Za-z]{4}$/);
  assert.doesNotMatch(a, /[0O1lI]/);
});

test("bloqueia na 5ª senha errada e zera o contador", () => {
  let row = { tentativas_falhas: 0 };
  for (let i = 1; i < MAX_TENTATIVAS; i++) {
    const r = aposSenhaErrada(row, 0);
    assert.strictEqual(r.bloquearAte, null);
    row = { tentativas_falhas: r.tentativas };
  }
  const ultimo = aposSenhaErrada(row, 0);
  assert.ok(ultimo.bloquearAte instanceof Date);
  assert.strictEqual(ultimo.tentativas, 0);
});

test("bloqueio só vale até a hora gravada", () => {
  const row = { bloqueado_ate: new Date(10_000) };
  assert.ok(bloqueadaAte(row, 5_000));
  assert.strictEqual(bloqueadaAte(row, 20_000), null);
  assert.strictEqual(bloqueadaAte({}, 0), null);
});

test("token cai com conta desativada ou sessões encerradas", () => {
  const ativa = { ativo: true, sessao_versao: 2 };
  assert.ok(tokenValidoParaConta({ sv: 2 }, ativa));
  assert.ok(!tokenValidoParaConta({ sv: 1 }, ativa));
  assert.ok(!tokenValidoParaConta({ sv: 2 }, { ...ativa, ativo: false }));
  // token emitido antes desta versão (sem sv) vale para conta que nunca encerrou sessões
  assert.ok(tokenValidoParaConta({}, { ativo: true, sessao_versao: 0 }));
});

test("só exclui quem nunca entrou", () => {
  assert.ok(podeExcluirConta({ ultimo_acesso: null }));
  assert.ok(!podeExcluirConta({ ultimo_acesso: new Date() }));
});
