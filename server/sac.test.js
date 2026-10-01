const test = require("node:test");
const assert = require("node:assert/strict");
const { hasSACPermission, validateSACUpdate, validateSACDelete } = require("./sac");

const user = (role, permissoes = {}) => ({ id: "u1", role, permissoes });
const base = { id: "s1", num: "SAC-2026-0001", status: "Aberto", relato: "Cápsula quebrada", respostas: [] };

test("permissoes por papel aceitam override explicito", () => {
  assert.equal(hasSACPermission(user("user"), "registrarSAC"), true);
  assert.equal(hasSACPermission(user("user"), "tratarSAC"), false);
  assert.equal(hasSACPermission(user("viewer"), "verSAC"), false);
  assert.equal(hasSACPermission(user("viewer", { verSAC: true, registrarSAC: true }), "registrarSAC"), true);
});

test("atendimento novo exige permissao e nasce Aberto", () => {
  assert.doesNotThrow(() => validateSACUpdate(user("user"), null, base));
  assert.throws(() => validateSACUpdate(user("viewer"), null, base), /permissao/i);
  assert.throws(() => validateSACUpdate(user("user"), null, { ...base, status: "Encerrado" }), /Aberto/);
});

test("quem so registra nao classifica nem responde", () => {
  assert.doesNotThrow(() => validateSACUpdate(user("user"), base, { ...base, lote: "L123" }));
  assert.throws(() => validateSACUpdate(user("user"), base, { ...base, classificacao: "Queixa técnica" }), /Qualidade/);
  assert.doesNotThrow(() => validateSACUpdate(user("rt"), base, { ...base, status: "Em análise", classificacao: "Queixa técnica" }));
});

test("relato so cresce no fim", () => {
  assert.doesNotThrow(() => validateSACUpdate(user("user"), base, { ...base, relato: base.relato + "\n\n(acréscimo)" }));
  assert.throws(() => validateSACUpdate(user("rt"), base, { ...base, relato: "Outra coisa" }), /relato/i);
});

test("resposta registrada nao se altera nem some", () => {
  const r = { id: "r1", texto: "Enviamos troca", por: "Ana" };
  const comResposta = { ...base, status: "Em análise", respostas: [r] };
  assert.doesNotThrow(() => validateSACUpdate(user("rt"), comResposta, { ...comResposta, respostas: [r, { id: "r2" }] }));
  assert.throws(() => validateSACUpdate(user("rt"), comResposta, { ...comResposta, respostas: [] }), /Resposta/);
  assert.throws(() => validateSACUpdate(user("rt"), comResposta, { ...comResposta, respostas: [{ ...r, texto: "x" }] }), /Resposta/);
});

test("encerrado e registro fechado", () => {
  assert.throws(() => validateSACUpdate(user("admin"), { ...base, status: "Encerrado" }, { ...base, status: "Encerrado", lote: "x" }), /encerrado/i);
});

test("exclusao so do admin e so antes da triagem", () => {
  assert.doesNotThrow(() => validateSACDelete(user("admin"), base));
  assert.throws(() => validateSACDelete(user("rt"), base), /administrador/);
  assert.throws(() => validateSACDelete(user("admin"), { ...base, status: "Em análise" }), /triado/);
});

test("recepcao registra chegada da amostra, mas nao pede nem avalia", () => {
  const pedida = { ...base, status: "Em análise", amostra: { solicitada: { em: "x", por: "Qual" } } };
  assert.doesNotThrow(() => validateSACUpdate(user("user"), pedida, { ...pedida, amostra: { ...pedida.amostra, recebida: { em: "2026-10-02" } } }));
  assert.throws(() => validateSACUpdate(user("user"), base, { ...base, amostra: { solicitada: { em: "x" } } }), /Qualidade/);
  assert.throws(() => validateSACUpdate(user("user"), base, { ...base, avaliacao: { resultado: "Procedente" } }), /Qualidade/);
});

test("avaliacao e etapas da amostra nao se alteram depois de gravadas", () => {
  const av = { ...base, status: "Em análise", avaliacao: { resultado: "Procedente", parecer: "a" }, amostra: { solicitada: { em: "x" }, recebida: { em: "y" } } };
  assert.throws(() => validateSACUpdate(user("rt"), av, { ...av, avaliacao: { resultado: "Improcedente", parecer: "a" } }), /avaliacao/);
  assert.throws(() => validateSACUpdate(user("rt"), av, { ...av, amostra: { ...av.amostra, recebida: { em: "z" } } }), /recebimento/);
  assert.throws(() => validateSACUpdate(user("rt"), av, { ...av, amostra: { recebida: av.amostra.recebida } }), /pedido/);
});
