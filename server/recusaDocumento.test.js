const test = require("node:test");
const assert = require("node:assert/strict");
const { notificacoesDeRecusa, resumoDosApontamentos } = require("./recusaDocumento");

const antes = {
  codigo: "PO-SGQ-001", titulo: "Controle", status: "Aguardando Aprovação",
  rota: { revisorId: "2", aprovadorId: "3" },
  assinaturaElaborador: { uid: "1" }, assinaturaRevisor: { uid: "2" },
  historicoRecusas: [],
};
const recusa = (autorPapel, autorId, apontamentos = [{ secao: "Geral", descricao: "Falta a referência" }]) =>
  ({ ...antes, status: "Rascunho", assinaturaElaborador: null, assinaturaRevisor: null,
     historicoRecusas: [{ id: "r1", versao: "01", autor: "Pessoa " + autorId, autorId, autorPapel, data: "2026-10-08", apontamentos }] });

test("recusa do Aprovador avisa Elaborador e Revisor, com o motivo", () => {
  const n = notificacoesDeRecusa(antes, recusa("aprovador", "3"));
  assert.deepEqual(n.map(x => x.userId), ["1", "2"]);
  assert.match(n[0].mensagem, /Motivo: Falta a referência. Corrija/);
  assert.match(n[1].titulo, /Aprovador/);
});

test("recusa do Revisor avisa só o Elaborador", () => {
  const n = notificacoesDeRecusa({ ...antes, status: "Em Revisão", assinaturaRevisor: null }, recusa("revisor", "2"));
  assert.deepEqual(n.map(x => x.userId), ["1"]);
});

test("sem recusa nova não avisa ninguém (editar documento assinado também volta a Rascunho)", () => {
  assert.deepEqual(notificacoesDeRecusa(antes, { ...antes, status: "Rascunho", assinaturaElaborador: null }), []);
  const jaRecusado = recusa("aprovador", "3");
  assert.deepEqual(notificacoesDeRecusa(jaRecusado, { ...jaRecusado, titulo: "outro" }), []);
});

test("não avisa quem recusou nem repete destinatário", () => {
  const mesmo = { ...antes, rota: { revisorId: "1", aprovadorId: "3" } };
  const n = notificacoesDeRecusa(mesmo, { ...recusa("aprovador", "3"), rota: mesmo.rota });
  assert.deepEqual(n.map(x => x.userId), ["1"]);
});

test("motivo resume até 3 apontamentos", () => {
  const ap = [1, 2, 3, 4, 5].map(i => ({ secao: i === 1 ? "Objetivo" : "Geral", descricao: `item ${i}` }));
  assert.equal(resumoDosApontamentos(ap), "[Objetivo] item 1 · item 2 · item 3 · e mais 2 apontamento(s)");
});
