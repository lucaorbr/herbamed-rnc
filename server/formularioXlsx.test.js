const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("path");
const ExcelJS = require("exceljs");
const { carimbarFormularioXlsx, nomeArquivoFormulario, LINHAS_TOPO, LINHAS_FAIXA } = require("./formularioXlsx");

const DOC = {
  codigo: "FO-SGQ-004",
  versao: "02",
  titulo: "Avaliação de Fornecedor",
  status: "Vigente",
  dataVigencia: "2026-07-01T00:00:00.000Z",
};
const LOGO = path.join(__dirname, "..", "public", "logo-herbamed.png");

/**
 * Fonte realista: título mesclado na L1, lista suspensa num campo, imagem
 * própria e estilo — tudo que o `spliceRows` deixa para trás se não tratarmos.
 */
async function fonteDeTeste({ comImagem = true } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Formulário");
  ws.columns = [{ width: 42 }, { width: 16 }, { width: 30 }];
  ws.addRow(["AVALIAÇÃO DE FORNECEDOR"]);
  ws.mergeCells("A1:C1");
  ws.addRow(["Item avaliado", "Conforme?", "Observações"]);
  ws.getCell("A2").font = { bold: true };
  ws.addRow(["Certificado de análise", "", ""]);
  ws.addRow(["Prazo de entrega", "", ""]);
  ws.getCell("B3").dataValidation = { type: "list", allowBlank: true, formulae: ['"Sim,Não"'] };
  if (comImagem) {
    const id = wb.addImage({ filename: LOGO, extension: "png" });
    ws.addImage(id, { tl: { col: 2.1, row: 0.1 }, ext: { width: 60, height: 16 } });
  }
  return wb.xlsx.writeBuffer();
}

async function carimbada(doc = DOC, ctx = { usuarioNome: "Lucas Ribeiro" }, fonte) {
  const out = await carimbarFormularioXlsx(fonte || await fonteDeTeste(), doc, ctx);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out);
  return wb;
}

const L = (n) => n + LINHAS_TOPO; // linha do formulário depois do carimbo

test("não cria capa — o arquivo abre direto no formulário", async () => {
  const wb = await carimbada();
  assert.equal(wb.worksheets.length, 1);
  assert.equal(wb.worksheets[0].name, "Formulário");
});

test("formulário desce inteiro, com estilo", async () => {
  const ws = (await carimbada()).worksheets[0];
  assert.equal(ws.getCell(`A${L(1)}`).value, "AVALIAÇÃO DE FORNECEDOR");
  assert.equal(ws.getCell(`A${L(2)}`).value, "Item avaliado");
  assert.equal(ws.getCell(`A${L(3)}`).value, "Certificado de análise");
  assert.equal(ws.getCell(`A${L(2)}`).font?.bold, true, "o negrito do cabeçalho deveria acompanhar");
});

test("merge do formulário acompanha — senão o título cobre o carimbo", async () => {
  const ws = (await carimbada()).worksheets[0];
  assert.deepEqual(ws.model.merges.map(String), [`A${L(1)}:C${L(1)}`]);
});

test("lista suspensa continua no campo certo", async () => {
  const ws = (await carimbada()).worksheets[0];
  const refs = Object.keys(ws.dataValidations?.model || {});
  assert.deepEqual(refs, [`B${L(3)}`], "a suspensa deveria ter descido junto com o campo");
});

test("imagem própria do formulário desce — e só uma vez", async () => {
  const ws = (await carimbada()).worksheets[0];
  const doFonte = ws.getImages().find(i => Math.round(i.range.tl.col) === 2);
  assert.ok(doFonte, "a imagem do formulário sumiu");
  assert.equal(doFonte.range.tl.nativeRow, LINHAS_TOPO,
    "âncora deslocada em dobro: `row` e `nativeRow` apontam para a mesma linha");
});

test("faixa verde no topo, com título e código", async () => {
  const ws = (await carimbada()).worksheets[0];
  const nCols = 4; // mínimo aplicado pelo módulo
  assert.equal(ws.getCell(1, 1).fill?.fgColor?.argb, "FF1A4A2E");
  assert.equal(ws.getCell(LINHAS_FAIXA, 1).fill?.fgColor?.argb, "FF1A4A2E");
  assert.equal(ws.getCell(1, nCols).value, "Avaliação de Fornecedor");
  assert.match(String(ws.getCell(2, nCols).value), /FO-SGQ-004 · Rev\. 02/);
  assert.match(String(ws.getCell(2, nCols).value), /Vigente desde 01\/07\/2026/); // UTC, não 30/06
});

test("logo entra como imagem no topo", async () => {
  const ws = (await carimbada()).worksheets[0];
  const logo = ws.getImages().find(i => i.range.tl.nativeRow === 0);
  assert.ok(logo, "o logo deveria estar ancorado na primeira linha");
});

test("faixa de rodapé fecha o conteúdo, com código e emissão", async () => {
  const ws = (await carimbada()).worksheets[0];
  // conteúdo original terminava na linha 4 → rodapé duas linhas depois do fim
  const linha = 4 + LINHAS_TOPO + 2;
  assert.equal(ws.getCell(linha, 1).fill?.fgColor?.argb, "FFEDF2ED");
  const texto = String(ws.getCell(linha, 1).value);
  assert.match(texto, /FO-SGQ-004 Rev\. 02/);
  assert.match(texto, /Lucas Ribeiro/);
  assert.match(texto, /SGQ Herbamed/);
});

test("rodapé de impressão traz código e paginação, sem marca d'água", async () => {
  const ws = (await carimbada()).worksheets[0];
  assert.match(ws.headerFooter.oddFooter, /FO-SGQ-004 Rev\. 02/);
  assert.match(ws.headerFooter.oddFooter, /Página &P de &N/);
  assert.ok(!/CÓPIA NÃO CONTROLADA/.test(ws.headerFooter.oddFooter));
});

test("faixa se repete no topo de cada página impressa", async () => {
  const ws = (await carimbada()).worksheets[0];
  assert.equal(ws.pageSetup.printTitlesRow, `1:${LINHAS_FAIXA}`);
});

test("carimbo fica congelado ao rolar", async () => {
  const ws = (await carimbada()).worksheets[0];
  assert.equal(ws.views[0].state, "frozen");
  assert.equal(ws.views[0].ySplit, LINHAS_TOPO);
});

test("'&' no título não vira código de formatação no rodapé impresso", async () => {
  const ws = (await carimbada({ ...DOC, codigo: "FO&SGQ" })).worksheets[0];
  assert.match(ws.headerFooter.oddFooter, /FO&&SGQ/);
});

test("documento sem vigência não deixa texto pela metade", async () => {
  const ws = (await carimbada({ ...DOC, dataVigencia: null })).worksheets[0];
  assert.equal(String(ws.getCell(2, 4).value), "FO-SGQ-004 · Rev. 02");
});

test("formulário sem imagem nenhuma não quebra", async () => {
  const ws = (await carimbada(DOC, {}, await fonteDeTeste({ comImagem: false }))).worksheets[0];
  assert.equal(ws.getCell(`A${L(1)}`).value, "AVALIAÇÃO DE FORNECEDOR");
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
