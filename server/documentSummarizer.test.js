const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDocumentSourceHash,
  cleanText,
  createLocalSummary,
  extractSection,
} = require("./documentSummarizer");

const POP_TEXT = `
1. OBJETIVO
Padronizar a limpeza da linha de envase para evitar contaminação cruzada.
2. ALCANCE
Aplica-se aos operadores e líderes da área de produção.
3. RESPONSABILIDADES
O operador deve executar a limpeza e registrar o resultado. O líder deve conferir o registro.
5. PROCEDIMENTO
1. Desligar e bloquear o equipamento.
2. Utilizar os EPIs obrigatórios.
3. Higienizar todas as superfícies e verificar a ausência de resíduos.
7. REGISTROS
Preencher o formulário FO-PRO-001 após a execução.
`;

test("remove HTML e preserva separação legível", () => {
  assert.equal(cleanText("<p>Primeiro</p><ul><li>Segundo</li></ul>"), "Primeiro\n\n- Segundo");
});

test("encontra seções numeradas de um POP", () => {
  assert.equal(extractSection(POP_TEXT, ["objetivo"]), "Padronizar a limpeza da linha de envase para evitar contaminação cruzada.");
  assert.match(extractSection(POP_TEXT, ["procedimento"]), /Desligar e bloquear/);
});

test("gera resumo estruturado apenas com conteúdo presente no POP", () => {
  const summary = createLocalSummary({
    id: "123",
    codigo: "PO-PRO-001",
    versao: "03",
    titulo: "Limpeza da linha de envase",
  }, POP_TEXT, { source: "PDF oficial" });

  assert.equal(summary.hasContent, true);
  assert.equal(summary.fonte, "PDF oficial");
  assert.match(summary.visaoGeral, /Padronizar a limpeza/);
  assert.deepEqual(summary.aplicacao, ["Aplica-se aos operadores e líderes da área de produção."]);
  assert.equal(summary.passos.length, 3);
  assert.match(summary.passos[0], /Desligar e bloquear/);
  assert.match(summary.registros[0], /FO-PRO-001/);
  assert.ok(summary.pontosAtencao.some(item => /EPI|deve/i.test(item)));
});

test("usa os subtítulos do procedimento e ignora marcas repetidas do PDF", () => {
  const noisyText = `
CÓPIA NÃO CONTROLADA
1.0 OBJETIVO
Controlar o processo de limpeza.
CÓPIA NÃO CONTROLADA
2.0 ALCANCE
Aplica-se à área produtiva.
CÓPIA NÃO CONTROLADA
3.0 RESPONSABILIDADES
3.1 Produção: Executar a limpeza e registrar o resultado;
3.2 Qualidade: Verificar o registro e liberar a linha.
5.0 PROCEDIMENTO
5.1 Preparação da área
5.1.1 O operador deve usar os EPIs obrigatórios.
5.2 Execução da limpeza
5.2.1 Higienizar as superfícies conforme o formulário.
5.3 Liberação da linha
5.3.1 A Qualidade deve verificar a ausência de resíduos.
8.0 ANEXOS
FOR-PRO-001 Registro de Limpeza
`;
  const summary = createLocalSummary({ id:"2", codigo:"POP-PRO-001", versao:"00", titulo:"Limpeza" }, noisyText);

  assert.deepEqual(summary.passos, ["Preparação da área", "Execução da limpeza", "Liberação da linha"]);
  assert.match(summary.responsaveis[0], /Produção: Executar a limpeza/);
  assert.ok(summary.pontosAtencao.every(item => !/^CÓPIA NÃO CONTROLADA$/i.test(item)));
});

test("invalida o cache quando o conteúdo ou arquivo muda", () => {
  const doc = { id: "1", versao: "01", titulo: "POP", objetivo: "Texto A" };
  const initial = buildDocumentSourceHash(doc, ["arquivo-a"]);
  assert.notEqual(initial, buildDocumentSourceHash({ ...doc, objetivo: "Texto B" }, ["arquivo-a"]));
  assert.notEqual(initial, buildDocumentSourceHash(doc, ["arquivo-b"]));
});
