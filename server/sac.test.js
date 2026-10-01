const test = require("node:test");
const assert = require("node:assert/strict");
const { hasSACPermission, validateSACUpdate, validateSACDelete } = require("./sac");

const user = (role, permissoes = {}) => ({ id: "u1", role, permissoes });
const base = { id: "s1", num: "SAC-2026-0001", status: "Em aberto", classificacao: "Reclamação", relato: "Cápsula quebrada", respostas: [] };
const duvida = { ...base, classificacao: "Dúvida" };

test("permissoes por papel aceitam override explicito", () => {
  assert.equal(hasSACPermission(user("user"), "registrarSAC"), true);
  assert.equal(hasSACPermission(user("user"), "tratarSAC"), false);
  assert.equal(hasSACPermission(user("viewer"), "verSAC"), false);
  assert.equal(hasSACPermission(user("viewer", { verSAC: true, registrarSAC: true }), "registrarSAC"), true);
});

test("atendimento novo nasce em aberto/andamento; recepcao so nasce finalizado se for simples", () => {
  assert.doesNotThrow(() => validateSACUpdate(user("user"), null, base));
  assert.doesNotThrow(() => validateSACUpdate(user("user"), null, { ...base, status: "Em andamento" }));
  assert.throws(() => validateSACUpdate(user("viewer"), null, base), /permissao/i);
  assert.doesNotThrow(() => validateSACUpdate(user("user"), null, { ...duvida, status: "Finalizado" }));
  assert.throws(() => validateSACUpdate(user("user"), null, { ...base, status: "Finalizado" }), /Qualidade/);
  assert.throws(() => validateSACUpdate(user("user"), null, { ...duvida, teveReacao: "Sim", status: "Finalizado" }), /Qualidade/);
});

test("recepcao responde, encaminha e anda o status, mas nao muda tipo nem decide", () => {
  assert.doesNotThrow(() => validateSACUpdate(user("user"), base, { ...base, status: "Em andamento", respostas: [{ id: "r1" }], encaminhamentos: [{ id: "e1", setor: "Financeiro", retorno: null }] }));
  assert.throws(() => validateSACUpdate(user("user"), base, { ...base, classificacao: "Dúvida" }), /Qualidade/);
  assert.throws(() => validateSACUpdate(user("user"), base, { ...base, avaliacao: { resultado: "Procedente" } }), /Qualidade/);
  assert.throws(() => validateSACUpdate(user("user"), base, { ...base, status: "Finalizado", solucao: "Reembolso" }), /Qualidade/);
  assert.doesNotThrow(() => validateSACUpdate(user("user"), duvida, { ...duvida, status: "Finalizado", solucao: "Orientação prestada" }));
  assert.throws(() => validateSACUpdate(user("user"), base, { ...base, solucao: "Reembolso" }), /encerramento/);
  assert.doesNotThrow(() => validateSACUpdate(user("rt"), base, { ...base, classificacao: "Reação adversa", status: "Finalizado" }));
});

test("relato so cresce no fim", () => {
  assert.doesNotThrow(() => validateSACUpdate(user("user"), base, { ...base, relato: base.relato + "\n\n(acréscimo)" }));
  assert.throws(() => validateSACUpdate(user("rt"), base, { ...base, relato: "Outra coisa" }), /relato/i);
});

test("resposta registrada nao se altera nem some", () => {
  const r = { id: "r1", texto: "Enviamos troca", por: "Ana" };
  const comResposta = { ...base, status: "Em andamento", respostas: [r] };
  assert.doesNotThrow(() => validateSACUpdate(user("rt"), comResposta, { ...comResposta, respostas: [r, { id: "r2" }] }));
  assert.throws(() => validateSACUpdate(user("rt"), comResposta, { ...comResposta, respostas: [] }), /Resposta/);
  assert.throws(() => validateSACUpdate(user("rt"), comResposta, { ...comResposta, respostas: [{ ...r, texto: "x" }] }), /Resposta/);
});

test("encaminhamento nao some e o retorno entra uma vez", () => {
  const e = { id: "e1", setor: "Financeiro", data: "2026-10-01", retorno: null };
  const a = { ...base, status: "Em andamento", encaminhamentos: [e] };
  const comRetorno = { ...a, encaminhamentos: [{ ...e, retorno: { texto: "Reembolso feito" } }] };
  assert.doesNotThrow(() => validateSACUpdate(user("user"), a, comRetorno));
  assert.throws(() => validateSACUpdate(user("rt"), comRetorno, { ...a, encaminhamentos: [{ ...e, retorno: { texto: "outro" } }] }), /retorno/);
  assert.throws(() => validateSACUpdate(user("rt"), a, { ...a, encaminhamentos: [{ ...e, setor: "Comercial" }] }), /Encaminhamento/);
  assert.throws(() => validateSACUpdate(user("rt"), a, { ...a, encaminhamentos: [] }), /removido/);
});

test("recepcao registra chegada da amostra, mas nao pede", () => {
  const pedida = { ...base, status: "Em andamento", amostra: { solicitada: { em: "x", por: "Qual" } } };
  assert.doesNotThrow(() => validateSACUpdate(user("user"), pedida, { ...pedida, amostra: { ...pedida.amostra, recebida: { em: "2026-10-02" } } }));
  assert.throws(() => validateSACUpdate(user("user"), base, { ...base, amostra: { solicitada: { em: "x" } } }), /Qualidade/);
});

test("avaliacao e etapas da amostra nao se alteram depois de gravadas", () => {
  const av = { ...base, status: "Em andamento", avaliacao: { resultado: "Procedente", parecer: "a" }, amostra: { solicitada: { em: "x" }, recebida: { em: "y" } } };
  assert.throws(() => validateSACUpdate(user("rt"), av, { ...av, avaliacao: { resultado: "Improcedente", parecer: "a" } }), /avaliacao/);
  assert.throws(() => validateSACUpdate(user("rt"), av, { ...av, amostra: { ...av.amostra, recebida: { em: "z" } } }), /recebimento/);
  assert.throws(() => validateSACUpdate(user("rt"), av, { ...av, amostra: { recebida: av.amostra.recebida } }), /pedido/);
});

test("finalizado e registro fechado", () => {
  assert.throws(() => validateSACUpdate(user("admin"), { ...base, status: "Finalizado" }, { ...base, status: "Finalizado", lote: "x" }), /finalizado/i);
});

test("exclusao so do admin e so em aberto", () => {
  assert.doesNotThrow(() => validateSACDelete(user("admin"), base));
  assert.throws(() => validateSACDelete(user("rt"), base), /administrador/);
  assert.throws(() => validateSACDelete(user("admin"), { ...base, status: "Em andamento" }), /Em aberto/);
});
