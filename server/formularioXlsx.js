// Formulário em Excel para o fornecedor — estampa o arquivo fonte .xlsx com a
// mesma identidade do PDF "modelo Formulário" (tipo com semCapa + semMarcaDagua).
//
// Contexto: alguns documentos controlados são formulários que o fornecedor
// precisa PREENCHER e devolver. Enviar o PDF renderizado não serve (não é
// editável) e enviar o `arquivoFonte` cru também não: ele sai anônimo, sem
// código, sem revisão e sem marca nenhuma — o fornecedor recebe uma planilha
// que ninguém consegue amarrar a um documento controlado numa inspeção.
//
// O resultado espelha o formulário sem capa e sem marca d'água do /render:
//   • faixa verde no topo, com logo Herbamed + título + código/revisão;
//   • faixa fina ao final do conteúdo, com código, revisão e emissão;
//   • rodapé de impressão "CÓDIGO Rev. XX · Página N de M";
//   • sem capa e sem marca d'água.
//
// ⚠️ O FORMULÁRIO NÃO PODE SER CORROMPIDO — três armadilhas do ExcelJS
// `spliceRows` move o conteúdo das células mas NÃO move o que está ancorado em
// endereço. Sem tratar, o fornecedor recebe um formulário quebrado:
//   1. MERGES ficam na linha antiga. `unMergeCells` não desfaz merge vindo de
//      arquivo carregado (fica preso) — a correção é reescrever `model.merges`.
//   2. VALIDAÇÕES DE DADOS idem: a lista suspensa apareceria deslocada do campo.
//      Correção: reescrever `dataValidations.model`.
//   3. IMAGENS do próprio formulário idem. E a âncora tem DOIS campos que
//      apontam para a mesma linha (`row` e `nativeRow`): deslocar os dois soma
//      em dobro — mexe-se em `nativeRow` apenas.
// Há teste cobrindo os três casos; não "simplificar" nada disso.

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const VERDE = "FF1A4A2E";        // idêntico ao verde do cabeçalho do PDF
const VERDE_TEXTO = "FFD9E8DD";  // texto secundário sobre o verde
const CINZA_FAIXA = "FFEDF2ED";  // faixa fina do rodapé, igual ao buildPDFShell
const CINZA_TEXTO = "FF64748B";

const LOGO_PATH = path.join(__dirname, "..", "public", "logo-herbamed.png");

/** Linhas ocupadas pelo carimbo: 3 de faixa + 1 de respiro antes do formulário. */
const LINHAS_TOPO = 4;
const LINHAS_FAIXA = 3;

const txt = (v) => String(v == null ? "" : v);
/** Escapa `&`, que no rodapé de impressão do Excel inicia código de formato. */
const hf = (v) => txt(v).replace(/&/g, "&&");
/** "B2" / "B2:D9" → mesmas células N linhas abaixo. */
const deslocarRef = (ref, n) => String(ref).replace(/([A-Z]+)(\d+)/g, (_, c, l) => `${c}${Number(l) + n}`);

/** Última linha que tem alguma célula preenchida — onde o rodapé vai depois. */
function ultimaLinhaComConteudo(ws) {
  let ultima = 0;
  ws.eachRow({ includeEmpty: false }, (row) => { if (row.actualCellCount > 0) ultima = row.number; });
  return ultima;
}

/**
 * Abre espaço no topo preservando tudo que está ancorado em endereço.
 * (ver o bloco de armadilhas no cabeçalho do arquivo)
 */
function abrirEspacoNoTopo(ws, n) {
  const merges = [...((ws.model && ws.model.merges) || [])];
  const validacoes = { ...((ws.dataValidations && ws.dataValidations.model) || {}) };

  ws.spliceRows(1, 0, ...Array.from({ length: n }, () => []));

  if (merges.length) ws.model.merges = merges.map(ref => deslocarRef(ref, n));
  if (ws.dataValidations) {
    const novo = {};
    for (const [ref, regra] of Object.entries(validacoes)) novo[deslocarRef(ref, n)] = regra;
    ws.dataValidations.model = novo;
  }
  for (const img of ws.getImages() || []) {
    if (img?.range?.tl) img.range.tl.nativeRow = (img.range.tl.nativeRow || 0) + n;
    if (img?.range?.br) img.range.br.nativeRow = (img.range.br.nativeRow || 0) + n;
  }
}

/**
 * Recebe o buffer do .xlsx fonte e devolve o buffer estampado.
 * O formulário desce `LINHAS_TOPO` linhas, sem perder nada.
 */
async function carimbarFormularioXlsx(bufferFonte, doc = {}, contexto = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bufferFonte);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Planilha sem abas.");

  const codigo = txt(doc.codigo || "—");
  const versao = txt(doc.versao || "01");
  const titulo = txt(doc.titulo || "Formulário");
  // Data pura gravada em UTC: formatar no fuso local a faria voltar um dia.
  const vigencia = doc.dataVigencia ? new Date(doc.dataVigencia).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "";
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const emitidoPor = txt(contexto.usuarioNome || "");

  // Largura da faixa: acompanha as colunas usadas pelo formulário, com limites
  // para não ficar espremida nem pintar meia tela à toa.
  const nCols = Math.max(4, Math.min(ws.columnCount || 6, 15));
  const ultimaAntes = ultimaLinhaComConteudo(ws);

  abrirEspacoNoTopo(ws, LINHAS_TOPO);

  // ── Faixa verde (linhas 1-3) ──
  const alturas = { 1: 30, 2: 14, 3: 5 };
  for (let l = 1; l <= LINHAS_FAIXA; l++) {
    ws.getRow(l).height = alturas[l];
    for (let c = 1; c <= nCols; c++) {
      ws.getCell(l, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    }
  }
  // Sem mesclar: merge criado depois de um `load` não sobrevive à gravação
  // (verificado). Como a faixa inteira está pintada, alinhar à direita produz o
  // mesmo resultado visual do cabeçalho do PDF — logo à esquerda, texto à direita.
  const cTitulo = ws.getCell(1, nCols);
  cTitulo.value = titulo;
  cTitulo.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  cTitulo.alignment = { vertical: "middle", horizontal: "right", indent: 1 };

  const cCodigo = ws.getCell(2, nCols);
  cCodigo.value = [`${codigo} · Rev. ${versao}`, vigencia && `Vigente desde ${vigencia}`].filter(Boolean).join(" · ");
  cCodigo.font = { size: 8, color: { argb: VERDE_TEXTO } };
  cCodigo.alignment = { vertical: "middle", horizontal: "right", indent: 1 };

  // Logo como imagem flutuante: não ocupa célula e não desloca nada.
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const idLogo = wb.addImage({ filename: LOGO_PATH, extension: "png" });
      ws.addImage(idLogo, { tl: { col: 0.15, row: 0.2 }, ext: { width: 132, height: 27 } });
    }
  } catch (e) {
    console.warn("Logo não pôde ser embutido no formulário:", e.message);
  }

  // ── Faixa fina de rodapé, no fim do conteúdo ──
  // O PDF fecha toda página com uma faixa clara; na planilha o equivalente é
  // fechar o conteúdo, para quem preenche na tela ver a identificação sem
  // precisar entrar no modo de impressão.
  const linhaRodape = (ultimaAntes || 1) + LINHAS_TOPO + 2;
  ws.getRow(linhaRodape).height = 16;
  for (let c = 1; c <= nCols; c++) {
    ws.getCell(linhaRodape, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_FAIXA } };
  }
  const cRodape = ws.getCell(linhaRodape, 1);
  cRodape.value = [
    `${codigo} Rev. ${versao}`,
    emitidoPor ? `Emitido por ${emitidoPor} em ${emitidoEm}` : `Emitido em ${emitidoEm}`,
    "SGQ Herbamed",
  ].join("  ·  ");
  cRodape.font = { size: 8, color: { argb: CINZA_TEXTO } };
  cRodape.alignment = { vertical: "middle", indent: 1 };

  // ── Impressão ──
  // A faixa se repete no topo de cada página, como o cabeçalho do PDF. O logo
  // não acompanha: o ExcelJS não implementa imagem em cabeçalho de impressão.
  ws.pageSetup = { ...(ws.pageSetup || {}), printTitlesRow: `1:${LINHAS_FAIXA}` };
  ws.headerFooter = {
    ...(ws.headerFooter || {}),
    oddFooter: `&L${hf(codigo)} Rev. ${hf(versao)}&RPágina &P de &N`,
  };

  // Rolar a planilha não faz a identificação sumir.
  const view = (ws.views && ws.views[0]) || {};
  ws.views = [{ ...view, state: "frozen", xSplit: view.xSplit || 0, ySplit: LINHAS_TOPO }];

  wb.creator = "SGQ Herbamed";
  wb.lastModifiedBy = emitidoPor || "SGQ Herbamed";
  wb.title = `${codigo} Rev.${versao} — ${titulo}`;
  wb.description = `Formulário emitido em ${emitidoEm} para preenchimento por fornecedor.`;
  wb.company = "Herbamed Laboratório Nutracêutico LTDA";

  return wb.xlsx.writeBuffer();
}

/** Nome do arquivo entregue — código e revisão à frente, para não se perder. */
function nomeArquivoFormulario(doc = {}) {
  const limpo = (v) => txt(v).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
  const base = [limpo(doc.codigo || "FORMULARIO"), `Rev.${limpo(doc.versao || "01")}`, limpo(doc.titulo || "")]
    .filter(Boolean).join("_").replace(/_+/g, "_").slice(0, 120);
  return `${base}.xlsx`;
}

module.exports = { carimbarFormularioXlsx, nomeArquivoFormulario, LINHAS_TOPO, LINHAS_FAIXA };
