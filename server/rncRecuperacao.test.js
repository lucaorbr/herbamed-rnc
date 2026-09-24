const test = require("node:test");
const assert = require("node:assert/strict");
const { rncDanificada, repararJsonTruncado, reconstruirRNC } = require("./rncRecuperacao");

test("JSON completo passa direto", () => {
  assert.deepEqual(repararJsonTruncado('{"a":1}'), { valor: { a: 1 }, truncado: false });
});

test("corte no meio de string de 1º nível descarta só a chave cortada", () => {
  const txt = JSON.stringify({ desc: "Cápsula amassada", sev: "Maior", obs: "texto longo" }).slice(0, 52);
  const r = repararJsonTruncado(txt);
  assert.equal(r.truncado, true);
  assert.deepEqual(r.valor, { desc: "Cápsula amassada", sev: "Maior" });
});

test("corte dentro de array aninhado descarta a chave inteira (sem histórico pela metade)", () => {
  const obj = { desc: "x", sev: "Menor", historico: [{ acao: "RNC aberta" }, { acao: "Assinatura do elaborador" }] };
  const txt = JSON.stringify(obj).slice(0, 55);
  const r = repararJsonTruncado(txt);
  assert.deepEqual(r.valor, { desc: "x", sev: "Menor" });
});

test("vírgula e chave dentro de string não confundem o corte", () => {
  const obj = { desc: 'a, b} "c" [d', sev: "Maior", resp: "Fulano" };
  const txt = JSON.stringify(obj).slice(0, JSON.stringify(obj).length - 3);
  assert.deepEqual(repararJsonTruncado(txt).valor, { desc: 'a, b} "c" [d', sev: "Maior" });
});

test("lixo ilegível devolve null", () => {
  assert.equal(repararJsonTruncado('"abc'), null);
  assert.equal(repararJsonTruncado(""), null);
});

test("rncDanificada reconhece o registro esvaziado", () => {
  assert.equal(rncDanificada({ id: "r1", status: "Em andamento", historico: [] }), true);
  assert.equal(rncDanificada({ id: "r1", num: "2209261", desc: "x", sev: "Maior" }), false);
});

// Cenário da tela de 22/09: criada (auditoria cortada, sem o num no fim), patch de
// assinatura, depois patch "encaminhado ao fornecedor" que esvaziou o registro.
test("reconstrói a RNC esvaziada a partir da auditoria", () => {
  const criada = {
    id: "r1", tipo: "Fornecedor", desc: "Cápsula amassada no lote 123", sev: "Maior",
    resp: "Lucas", fornecedor: "ACME", prazoAC: "", justificativaPrazo: "Será enviado ao fornecedor",
    historico: [{ acao: "RNC aberta" }], num: "2209261",
  };
  const txtCriada = JSON.stringify(criada).slice(0, JSON.stringify(criada).length - 12); // perde o num
  const historicoFinal = [{ acao: "RNC aberta" }, { acao: "Assinatura" }, { acao: "Status -> Em andamento" }];
  const atual = { id: "r1", status: "Em andamento", historico: historicoFinal };
  const auditoria = [
    { ts: 1000, acao: "Criou RNC", docNome: "2209261", dadosDepois: txtCriada },
    { ts: 2000, acao: "Editou RNC", docNome: "r1", dadosDepois: JSON.stringify({ assinaturaElaborador: { nome: "Lucas" }, historico: historicoFinal.slice(0, 2) }) },
    { ts: 3000, acao: "Status: Em andamento", docNome: "r1", dadosDepois: JSON.stringify({ status: "Em andamento", historico: historicoFinal }) },
  ];
  const { rnc, recuperados, aindaDanificada } = reconstruirRNC({ atual, auditoria });
  assert.equal(rnc.num, "2209261");
  assert.equal(rnc.desc, "Cápsula amassada no lote 123");
  assert.equal(rnc.sev, "Maior");
  assert.equal(rnc.fornecedor, "ACME");
  assert.deepEqual(rnc.assinaturaElaborador, { nome: "Lucas" });
  assert.equal(rnc.status, "Em andamento");
  assert.deepEqual(rnc.historico, historicoFinal, "histórico atual é o mais completo e prevalece");
  assert.equal(aindaDanificada, false);
  assert.ok(recuperados.includes("desc") && recuperados.includes("num"));
  assert.ok(!recuperados.includes("status"));
});

test("patches aplicados em ordem cronológica, backup como base", () => {
  const atual = { id: "r1", status: "Pendente verificação", historico: [1, 2, 3] };
  const backup = { updatedAt: 500, data: { id: "r1", num: "0109261", desc: "d", sev: "Menor", prazoAC: "2026-09-01", status: "Aberta" } };
  const auditoria = [
    { ts: 2000, acao: "Editou RNC", dadosDepois: JSON.stringify({ prazoAC: "2026-10-30" }) },
    { ts: 1000, acao: "Editou RNC", dadosDepois: JSON.stringify({ prazoAC: "2026-10-15" }) },
  ];
  const { rnc } = reconstruirRNC({ atual, auditoria, backup });
  assert.equal(rnc.prazoAC, "2026-10-30");
  assert.equal(rnc.num, "0109261");
  assert.equal(rnc.status, "Pendente verificação");
});

test("dadosAntes desatualizado preenche lacuna mas não reverte patch posterior", () => {
  const atual = { id: "r1", status: "Em andamento", historico: [] };
  const auditoria = [
    { ts: 1000, acao: "Ishikawa atualizado", dadosDepois: JSON.stringify({ ishikawa: { efeito: "novo" } }) },
    // antes "congelado" no carregamento da página: ishikawa velho, mas tem desc/sev
    { ts: 2000, acao: "Status: Em andamento", dadosAntes: JSON.stringify({ desc: "d", sev: "Maior", num: "1", ishikawa: { efeito: "velho" } }), dadosDepois: JSON.stringify({ status: "Em andamento" }) },
  ];
  const { rnc } = reconstruirRNC({ atual, auditoria });
  assert.deepEqual(rnc.ishikawa, { efeito: "novo" });
  assert.equal(rnc.desc, "d");
});

test("número vem de fonte externa quando a auditoria não tem", () => {
  const { rnc } = reconstruirRNC({ atual: { id: "r1" }, auditoria: [{ ts: 1, acao: "Status: X", docNome: "r1" }], numsExternos: ["2209262"] });
  assert.equal(rnc.num, "2209262");
});

test("sem fonte nenhuma continua marcada como danificada (não inventa dado)", () => {
  const r = reconstruirRNC({ atual: { id: "r1", status: "Em andamento" } });
  assert.equal(r.aindaDanificada, true);
  assert.equal(r.rnc.num, undefined);
});
