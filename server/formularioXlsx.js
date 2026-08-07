// Formulário em Excel para o fornecedor — identifica o arquivo fonte .xlsx.
//
// Contexto: alguns documentos controlados são formulários que o fornecedor
// precisa PREENCHER e devolver. Enviar o PDF renderizado não serve (não é
// editável) e enviar o `arquivoFonte` cru também não: ele sai anônimo, sem
// código, sem revisão e sem qualquer marca — o fornecedor recebe uma planilha
// que ninguém consegue amarrar a um documento controlado numa inspeção.
//
// A solução é o análogo do que o /render faz no PDF: pega o arquivo guardado e
// devolve identificado. A identificação entra em três lugares:
//   1. uma ABA DE CAPA, que é a primeira que o Excel abre;
//   2. o CABEÇALHO DE IMPRESSÃO de cada aba do formulário (repete em toda
//      página impressa, como o rodapé do PDF controlado);
//   3. as PROPRIEDADES do arquivo, que sobrevivem a copiar/colar a aba.
//
// ⚠️ POR QUE CAPA, E NÃO LINHAS NO TOPO DO PRÓPRIO FORMULÁRIO
// A primeira implementação inseria linhas com `spliceRows`. Parece o mais
// natural, mas o ExcelJS não move junto o que está ancorado em endereço:
// merges e validações de dados continuam apontando para as linhas antigas, e
// `unMergeCells` não desfaz merge vindo de arquivo carregado (fica preso). O
// resultado era um título mesclado do formulário em cima do carimbo, faixa
// verde cobrindo só a coluna A e listas suspensas deslocadas — ou seja, o
// sistema entregava ao fornecedor um formulário corrompido. Preservar intacto
// o arquivo que a Qualidade desenhou vale mais que a estampa no corpo.

const ExcelJS = require("exceljs");

const VERDE = "FF1A4A2E";       // mesmo verde do cabeçalho dos PDFs
const VERDE_CLARO = "FFEDF2ED";
const CINZA = "FF64748B";
const AMBAR = "FF8A5A00";
const AMBAR_FUNDO = "FFFFF4D6";

const AVISO = "CÓPIA NÃO CONTROLADA — válida apenas para preenchimento e devolução. O documento controlado é o original mantido no SGQ Herbamed.";
const NOME_CAPA = "Identificação";

const txt = (v) => String(v == null ? "" : v);

/** Escapa o `&`, que no cabeçalho de impressão do Excel inicia código de formato. */
const hf = (v) => txt(v).replace(/&/g, "&&");

/**
 * Recebe o buffer do .xlsx fonte e devolve o buffer identificado.
 * O conteúdo original não é alterado — nenhuma célula é movida.
 */
async function carimbarFormularioXlsx(bufferFonte, doc = {}, contexto = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bufferFonte);
  const abasFormulario = [...wb.worksheets];
  if (!abasFormulario.length) throw new Error("Planilha sem abas.");

  const codigo = txt(doc.codigo || "—");
  const versao = txt(doc.versao || "01");
  const titulo = txt(doc.titulo || "Formulário");
  // Vigência é data pura gravada em UTC: formatar no fuso local a faria voltar
  // um dia (01/07 vira 30/06 em UTC-3). `emitidoEm` abaixo é o "agora" e aí sim
  // o fuso local é o certo.
  const vigencia = doc.dataVigencia
    ? new Date(doc.dataVigencia).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "—";
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const emitidoPor = txt(contexto.usuarioNome || "—");
  const primeira = abasFormulario[0].name;

  // ── 1. Aba de capa ──
  const capa = wb.addWorksheet(NOME_CAPA, { views: [{ showGridLines: false }] });
  capa.columns = [{ width: 22 }, { width: 78 }];

  const faixa = capa.addRow(["HERBAMED LABORATÓRIO NUTRACÊUTICO LTDA", ""]);
  capa.mergeCells("A1:B1");
  faixa.getCell(1).font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  faixa.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  faixa.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  faixa.height = 30;

  capa.addRow([]);
  const linhaTitulo = capa.addRow([titulo, ""]);
  capa.mergeCells("A3:B3");
  linhaTitulo.getCell(1).font = { bold: true, size: 14, color: { argb: VERDE } };
  linhaTitulo.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_CLARO } };
  linhaTitulo.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  linhaTitulo.height = 24;

  capa.addRow([]);
  const campos = [
    ["Código", codigo],
    ["Revisão", `Rev. ${versao}`],
    ["Vigente desde", vigencia],
    ["Emitido em", emitidoEm],
    ["Emitido por", emitidoPor],
    ["Preencher na aba", primeira],
  ];
  for (const [rot, val] of campos) {
    const r = capa.addRow([rot, val]);
    r.getCell(1).font = { bold: true, size: 10, color: { argb: CINZA } };
    r.getCell(2).font = { size: 11 };
    r.getCell(1).alignment = { vertical: "middle" };
    r.height = 19;
  }

  capa.addRow([]);
  const aviso = capa.addRow([AVISO, ""]);
  const lAviso = aviso.number;
  capa.mergeCells(`A${lAviso}:B${lAviso}`);
  aviso.getCell(1).font = { bold: true, size: 10, color: { argb: AMBAR } };
  aviso.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBAR_FUNDO } };
  aviso.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  aviso.height = 32;

  capa.addRow([]);
  const instr = capa.addRow([`Preencha a aba "${primeira}" e devolva este arquivo por e-mail, sem renomear.`, ""]);
  capa.mergeCells(`A${instr.number}:B${instr.number}`);
  instr.getCell(1).font = { italic: true, size: 10, color: { argb: CINZA } };
  instr.getCell(1).alignment = { indent: 1 };

  // A capa precisa ser a primeira aba: é a que o Excel mostra ao abrir, e é o
  // que garante que a identificação seja vista antes do preenchimento.
  capa.orderNo = 0;
  abasFormulario.forEach((w, i) => { w.orderNo = i + 1; });

  // ── 2. Cabeçalho e rodapé de impressão nas abas do formulário ──
  // Equivalente ao rodapé que o /render repete em toda página do PDF: se o
  // fornecedor imprimir a planilha, cada folha sai identificada.
  for (const ws of abasFormulario) {
    ws.headerFooter = {
      ...(ws.headerFooter || {}),
      oddHeader: `&L&"Calibri,Bold"${hf(codigo)} · Rev. ${hf(versao)}&C&"Calibri,Bold"${hf(titulo)}&R&"Calibri,Bold"CÓPIA NÃO CONTROLADA`,
      oddFooter: `&L${hf(codigo)} Rev. ${hf(versao)} · emitido em ${hf(emitidoEm)}&RPágina &P de &N`,
    };
  }

  // ── 3. Propriedades do arquivo ──
  wb.creator = "SGQ Herbamed";
  wb.lastModifiedBy = emitidoPor;
  wb.title = `${codigo} Rev.${versao} — ${titulo}`;
  wb.description = `Cópia não controlada emitida em ${emitidoEm} para preenchimento por fornecedor.`;
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

module.exports = { carimbarFormularioXlsx, nomeArquivoFormulario, NOME_CAPA };
