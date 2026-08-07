const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const { carimbarFormularioXlsx, nomeArquivoFormulario, NOME_CAPA } = require("./formularioXlsx");

const DOC = {
  codigo: "FO-SGQ-004",
  versao: "02",
  titulo: "Avaliação de Fornecedor",
  status: "Vigente",
  dataVigencia: "2026-07-01T00:00:00.000Z",
};

/** Uma planilha-fonte como a Qualidade desenharia no Excel. */
async function fonteDeTeste() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Formulário");
  ws.columns = [{ width: 42 }, { width: 16 }, { width: 40 }];
  ws.addRow(["AVALIAÇÃO DE FORNECEDOR"]);
  ws.mergeCells("A1:C1");
  ws.addRow(["Item avaliado", "Conforme?", "Observações"]);
  ws.addRow(["Certificado de análise", "", ""]);
  ws.addRow(["Prazo de entrega", "", ""]);
  ws.getCell("B3").dataValidation = { type: "list", allowBlank: true, formulae: ['"Sim,Não"'] };
  return wb.xlsx.writeBuffer();
}

async function carimbada(doc = DOC, ctx = { usuarioNome: "Lucas Ribeiro" }, fonte) {
  const out = await carimbarFormularioXlsx(fonte || await fonteDeTeste(), doc, ctx);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out);
  return wb;
}

const textoDa = (ws) => ws.getSheetValues().flat().filter(v => typeof v === "string").join(" | ");

test("o formulário é entregue INTACTO — é o ponto do desenho", async () => {
  const ws = (await carimbada()).getWorksheet("Formulário");
  // Nenhuma linha deslocada
  assert.equal(ws.getCell("A1").value, "AVALIAÇÃO DE FORNECEDOR");
  assert.equal(ws.getCell("A2").value, "Item avaliado");
  assert.equal(ws.getCell("A3").value, "Certificado de análise");
  // Merge original preservado
  assert.ok(ws.model.merges.map(String).includes("A1:C1"), `merges: ${ws.model.merges}`);
  // Lista suspensa continua no campo certo
  assert.ok(ws.dataValidations?.model?.["B3"], "a suspensa de B3 deveria continuar em B3");
});

test("capa é a PRIMEIRA aba — é a que o Excel abre", async () => {
  const wb = await carimbada();
  assert.equal(wb.worksheets[0].name, NOME_CAPA);
  assert.equal(wb.worksheets[1].name, "Formulário");
});

test("capa identifica o documento", async () => {
  const capa = (await carimbada()).getWorksheet(NOME_CAPA);
  const texto = textoDa(capa);
  assert.match(texto, /FO-SGQ-004/);
  assert.match(texto, /Rev\. 02/);
  assert.match(texto, /Avaliação de Fornecedor/);
  assert.match(texto, /01\/07\/2026/);          // vigência
  assert.match(texto, /Lucas Ribeiro/);          // quem emitiu
  assert.match(texto, /CÓPIA NÃO CONTROLADA/);
});

test("capa diz em qual aba preencher e pede para não renomear o arquivo", async () => {
  const texto = textoDa((await carimbada()).getWorksheet(NOME_CAPA));
  assert.match(texto, /Preencher na aba \| Formulário|aba "Formulário"/);
  assert.match(texto, /sem renomear/);
});

test("cabeçalho de impressão identifica cada página, como o rodapé do PDF", async () => {
  const ws = (await carimbada()).getWorksheet("Formulário");
  assert.match(ws.headerFooter.oddHeader, /FO-SGQ-004/);
  assert.match(ws.headerFooter.oddHeader, /CÓPIA NÃO CONTROLADA/);
  assert.match(ws.headerFooter.oddFooter, /Página &P de &N/);
});

test("'&' no título não vira código de formatação no cabeçalho impresso", async () => {
  const ws = (await carimbada({ ...DOC, titulo: "Pesagem & Envase" })).getWorksheet("Formulário");
  assert.match(ws.headerFooter.oddHeader, /Pesagem && Envase/);
});

test("todas as abas do formulário recebem o cabeçalho, não só a primeira", async () => {
  const wb0 = new ExcelJS.Workbook();
  wb0.addWorksheet("Parte 1").addRow(["a"]);
  wb0.addWorksheet("Parte 2").addRow(["b"]);
  const wb = await carimbada(DOC, {}, await wb0.xlsx.writeBuffer());
  assert.equal(wb.worksheets.map(w => w.name).join(","), `${NOME_CAPA},Parte 1,Parte 2`);
  for (const nome of ["Parte 1", "Parte 2"]) {
    assert.match(wb.getWorksheet(nome).headerFooter.oddHeader, /FO-SGQ-004/, `aba ${nome} sem cabeçalho`);
  }
});

test("documento sem data de vigência não quebra a capa", async () => {
  const texto = textoDa((await carimbada({ ...DOC, dataVigencia: null })).getWorksheet(NOME_CAPA));
  assert.match(texto, /Vigente desde \| —/);
});

test("planilha sem abas é recusada com mensagem, não com stack", async () => {
  const wb = new ExcelJS.Workbook();
  const vazio = await wb.xlsx.writeBuffer();
  await assert.rejects(() => carimbarFormularioXlsx(vazio, DOC), /Planilha sem abas/);
});

test("nome do arquivo leva código e revisão à frente", () => {
  assert.equal(nomeArquivoFormulario(DOC), "FO-SGQ-004_Rev.02_Avaliacao_de_Fornecedor.xlsx");
});

test("nome do arquivo tolera documento sem código e sem título", () => {
  const nome = nomeArquivoFormulario({});
  assert.match(nome, /^FORMULARIO_Rev\.01.*\.xlsx$/);
  assert.ok(!/[/\\:*?"<>|]/.test(nome), "não pode conter caractere inválido para nome de arquivo");
});
