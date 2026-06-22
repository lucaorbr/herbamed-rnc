/**
 * Formulário de Resposta de RNC para Fornecedores (Excel) — gerado pré-preenchido.
 *
 * Alternativa offline ao link público (SupplierRNCPage) enquanto o acesso externo
 * não está liberado pela TI: a Herbamed exporta este .xlsx já com os dados da RNC,
 * anexa ao e-mail e o fornecedor preenche a análise (5 Porquês + 5W2H) e devolve.
 *
 * Espelha os campos de src/features/rnc/SupplierRNCPage.jsx.
 */
import ExcelJS from "exceljs";
import { fmt } from "../../core/utils";

// ---- Paleta da marca (alinhada ao SupplierRNCPage) ----
const VERDE = "FF1A7A3C";
const VERDE_ESC = "FF14532D";
const VERDE_CLARO = "FFE8F5E9";
const CINZA_FIXO = "FFEEF2EE"; // campos preenchidos pela Herbamed (não alterar)
const AMARELO_IN = "FFFFFDF0"; // campos a preencher pelo fornecedor
const BORDA = "FFD0DDD2";
const TXT = "FF1A2E1E";
const TXT_FRACO = "FF6B8A6F";
const VERMELHO = "FFC62828";

const thin = { style: "thin", color: { argb: BORDA } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

export async function exportFormularioFornecedor(rnc) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SGQ Herbamed";
  wb.created = new Date();
  wb.title = `Formulário de Resposta — RNC ${rnc?.num || ""}`;

  const ws = wb.addWorksheet("Resposta RNC", {
    properties: { defaultRowHeight: 16, tabColor: { argb: VERDE } },
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });

  ws.headerFooter.oddFooter =
    "&L&8Herbamed Laboratório Nutracêutico — SGQ&C&8Formulário de Resposta de RNC&R&8Pág. &P de &N";

  ws.getColumn("A").width = 2.2;
  ws.getColumn("B").width = 22;
  ws.getColumn("C").width = 16;
  ws.getColumn("D").width = 14;
  ws.getColumn("E").width = 14;
  ws.getColumn("F").width = 14;
  ws.getColumn("G").width = 14;
  ws.getColumn("H").width = 14;
  ws.getColumn("I").width = 2.2;

  let r = 1;

  const setCell = (addr, value, opts = {}) => {
    const c = ws.getCell(addr);
    if (value !== undefined) c.value = value;
    if (opts.font) c.font = opts.font;
    if (opts.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
    if (opts.align) c.alignment = opts.align;
    if (opts.border) c.border = opts.border;
    if (opts.numFmt) c.numFmt = opts.numFmt;
    return c;
  };
  const mergeRange = (range) => ws.mergeCells(range);

  const secao = (numero, titulo, subtitulo) => {
    ws.getRow(r).height = 22;
    mergeRange(`B${r}:H${r}`);
    setCell(`B${r}`, `${numero}  ${titulo}`, {
      font: { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } },
      fill: VERDE,
      align: { vertical: "middle", horizontal: "left", indent: 1 },
    });
    r++;
    if (subtitulo) {
      ws.getRow(r).height = 15;
      mergeRange(`B${r}:H${r}`);
      setCell(`B${r}`, subtitulo, {
        font: { name: "Calibri", size: 9, italic: true, color: { argb: TXT_FRACO } },
        align: { vertical: "middle", horizontal: "left", indent: 1 },
      });
      r++;
    }
  };

  // Campo label + input. `valor` (string) pré-preenche; `fixo` trava a célula.
  const campo = (label, { fixo = false, altura = 18, obrig = false, valor = "", placeholder = "" } = {}) => {
    ws.getRow(r).height = altura;
    const lblCell = setCell(`B${r}`, "", {
      font: { name: "Calibri", size: 10, bold: true, color: { argb: TXT } },
      fill: VERDE_CLARO,
      align: { vertical: "middle", horizontal: "left", indent: 1, wrapText: true },
      border: allBorders,
    });
    lblCell.value = obrig
      ? { richText: [{ text: label, font: { bold: true, color: { argb: TXT } } }, { text: "  *", font: { bold: true, color: { argb: VERMELHO } } }] }
      : label;

    mergeRange(`C${r}:H${r}`);
    const temValor = valor !== undefined && valor !== null && String(valor).trim() !== "";
    const inp = setCell(`C${r}`, temValor ? valor : placeholder || "", {
      font: { name: "Calibri", size: 10, color: { argb: temValor ? TXT : TXT_FRACO }, italic: !temValor && !!placeholder },
      fill: fixo ? CINZA_FIXO : AMARELO_IN,
      align: { vertical: "middle", horizontal: "left", indent: 1, wrapText: true },
      border: allBorders,
    });
    inp.protection = { locked: fixo };
    const row = r;
    r++;
    return { row, inputAddr: `C${row}`, cell: inp };
  };

  // ============ CABEÇALHO ============
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 18;
  mergeRange("B1:B2");
  setCell("B1", "", { fill: VERDE, align: { vertical: "middle", horizontal: "center" } });
  // Logo (public/logornc.jpg) — via fetch no browser
  try {
    const resp = await fetch("/logornc.jpg");
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      const logoId = wb.addImage({ buffer: buf, extension: "jpeg" });
      ws.addImage(logoId, {
        tl: { col: 1.15, row: 0.12 },
        ext: { width: 52, height: 52 },
        editAs: "oneCell",
      });
    }
  } catch {
    setCell("B1", "H", { font: { name: "Calibri", size: 26, bold: true, color: { argb: "FFFFFFFF" } }, fill: VERDE, align: { vertical: "middle", horizontal: "center" } });
  }
  mergeRange("C1:H1");
  setCell("C1", "HERBAMED LABORATÓRIO NUTRACÊUTICO", {
    font: { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } },
    fill: VERDE,
    align: { vertical: "middle", horizontal: "left", indent: 1 },
  });
  mergeRange("C2:H2");
  setCell("C2", "Sistema de Gestão da Qualidade  ·  Formulário de Resposta a Não-Conformidade (RNC)", {
    font: { name: "Calibri", size: 10, color: { argb: "FFD7EEDC" } },
    fill: VERDE,
    align: { vertical: "middle", horizontal: "left", indent: 1 },
  });
  ws.getRow(3).height = 4;
  mergeRange("B3:H3");
  setCell("B3", "", { fill: VERDE_ESC });
  r = 4;

  // Legenda
  ws.getRow(r).height = 34;
  mergeRange(`B${r}:H${r}`);
  setCell(`B${r}`, "", {
    fill: "FFFFFDF0",
    align: { vertical: "middle", horizontal: "left", indent: 1, wrapText: true },
    border: allBorders,
  }).value = {
    richText: [
      { text: "Como preencher:  ", font: { bold: true, size: 9.5, color: { argb: VERDE_ESC } } },
      { text: "células ", font: { size: 9.5, color: { argb: TXT } } },
      { text: "amarelas", font: { size: 9.5, bold: true, color: { argb: "FFB58900" } } },
      { text: " são para o fornecedor preencher;  células ", font: { size: 9.5, color: { argb: TXT } } },
      { text: "cinzas", font: { size: 9.5, bold: true, color: { argb: TXT_FRACO } } },
      { text: " já vêm preenchidas pela Herbamed (não alterar).  Campos com ", font: { size: 9.5, color: { argb: TXT } } },
      { text: "*", font: { size: 9.5, bold: true, color: { argb: VERMELHO } } },
      { text: " são obrigatórios.  Anexe evidências (laudos, fotos, certificados) ao responder o e-mail.", font: { size: 9.5, color: { argb: TXT } } },
    ],
  };
  r++;
  r++;

  // ============ ① DADOS DA NÃO-CONFORMIDADE (pré-preenchido) ============
  secao("①", "DADOS DA NÃO-CONFORMIDADE", "Preenchido pela Herbamed — confira os dados antes de responder.");
  campo("Nº da RNC", { fixo: true, valor: rnc?.num || "" });
  campo("Data de abertura", { fixo: true, valor: fmt(rnc?.data) || "" });
  campo("Produto / Material", { fixo: true, valor: rnc?.produto || "" });
  campo("Lote", { fixo: true, valor: rnc?.lote || "" });
  campo("Fornecedor", { fixo: true, valor: rnc?.fornecedor || "" });
  campo("Qtd. afetada", { fixo: true, valor: rnc?.qtd || "" });
  campo("Descrição da não-conformidade", { fixo: true, altura: 48, valor: rnc?.desc || "" });
  campo("Ação de contenção (Herbamed)", { fixo: true, altura: 32, valor: rnc?.contencao || "" });
  campo("Prazo para resposta", { fixo: true, valor: fmt(rnc?.prazoAC) || "", placeholder: "dd/mm/aaaa" });
  r++;

  // ============ ② ANÁLISE DE CAUSA — 5 PORQUÊS ============
  secao("②", "ANÁLISE DE CAUSA — 5 PORQUÊS", 'Pergunte "Por quê?" repetidamente até chegar à causa raiz. Aprofunde cada resposta na anterior.');
  campo("1º Por quê?  (Por que o problema ocorreu?)", { altura: 30 });
  campo("2º Por quê?", { altura: 30 });
  campo("3º Por quê?", { altura: 30 });
  campo("4º Por quê?", { altura: 30 });
  campo("5º Por quê?", { altura: 30 });
  const causaRaiz = campo("CAUSA RAIZ identificada", { altura: 40, obrig: true });
  causaRaiz.cell.border = {
    top: { style: "medium", color: { argb: VERDE } },
    left: { style: "medium", color: { argb: VERDE } },
    bottom: { style: "medium", color: { argb: VERDE } },
    right: { style: "medium", color: { argb: VERDE } },
  };
  r++;

  // ============ ③ PLANO DE AÇÃO — 5W2H ============
  secao("③", "PLANO DE AÇÃO — 5W2H", "Descreva as ações corretivas para eliminar a causa raiz. Use uma linha por ação.");
  ws.getRow(r).height = 30;
  const cols5w2h = [
    ["B", "O QUÊ? *\n(What)"],
    ["C", "POR QUÊ?\n(Why)"],
    ["D", "COMO?\n(How)"],
    ["E", "QUEM? *\n(Who)"],
    ["F", "ONDE?\n(Where)"],
    ["G", "QUANDO? *\n(When)"],
    ["H", "QUANTO?\n(How much)"],
  ];
  cols5w2h.forEach(([col, txt]) => {
    setCell(`${col}${r}`, txt, {
      font: { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
      fill: VERDE,
      align: { vertical: "middle", horizontal: "center", wrapText: true },
      border: allBorders,
    });
  });
  r++;
  for (let i = 0; i < 5; i++) {
    ws.getRow(r).height = 34;
    ["B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
      const c = setCell(`${col}${r}`, "", {
        font: { name: "Calibri", size: 9, color: { argb: TXT } },
        fill: AMARELO_IN,
        align: { vertical: "middle", horizontal: col === "G" ? "center" : "left", indent: col === "G" ? 0 : 1, wrapText: true },
        border: allBorders,
      });
      c.protection = { locked: false };
    });
    ws.getCell(`G${r}`).numFmt = "dd/mm/yyyy";
    ws.getCell(`G${r}`).dataValidation = {
      type: "date",
      operator: "greaterThanOrEqual",
      allowBlank: true,
      formulae: [new Date(2026, 0, 1)],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Data do prazo",
      error: "Informe a data no formato dd/mm/aaaa.",
    };
    r++;
  }
  r++;

  // ============ ④ OBSERVAÇÕES / EVIDÊNCIAS ============
  secao("④", "OBSERVAÇÕES ADICIONAIS / EVIDÊNCIAS", "Relatórios internos, referências, nº de laudo. Lembre-se de anexar os arquivos de evidência ao e-mail.");
  ws.getRow(r).height = 70;
  mergeRange(`B${r}:H${r}`);
  const obs = setCell(`B${r}`, "", {
    font: { name: "Calibri", size: 10, color: { argb: TXT } },
    fill: AMARELO_IN,
    align: { vertical: "top", horizontal: "left", indent: 1, wrapText: true },
    border: allBorders,
  });
  obs.protection = { locked: false };
  r++;
  r++;

  // ============ ⑤ IDENTIFICAÇÃO DO RESPONSÁVEL ============
  secao("⑤", "IDENTIFICAÇÃO DO RESPONSÁVEL PELA RESPOSTA");
  campo("Nome completo", { obrig: true });
  campo("Cargo / Função", {});
  campo("Empresa / Departamento", { valor: rnc?.fornecedor || "" });
  campo("E-mail de contato", {});
  campo("Telefone", {});
  campo("Data de preenchimento", { placeholder: "dd/mm/aaaa" });

  ws.getRow(r).height = 40;
  mergeRange(`B${r}:H${r}`);
  const assina = setCell(`B${r}`, "", {
    fill: AMARELO_IN,
    align: { vertical: "bottom", horizontal: "center", wrapText: true },
    border: allBorders,
  });
  assina.value = { richText: [{ text: "\n_______________________________________________\nAssinatura do responsável", font: { size: 9, color: { argb: TXT_FRACO } } }] };
  assina.protection = { locked: false };
  r++;
  r++;

  // Rodapé interno
  ws.getRow(r).height = 26;
  mergeRange(`B${r}:H${r}`);
  setCell(`B${r}`, "Documento gerado pelo SGQ Herbamed · Devolva este formulário preenchido respondendo ao e-mail da RNC, com as evidências anexadas. Em caso de dúvidas, contate a Garantia da Qualidade.", {
    font: { name: "Calibri", size: 8.5, italic: true, color: { argb: TXT_FRACO } },
    align: { vertical: "middle", horizontal: "center", wrapText: true },
  });
  r++;

  // Proteção: campos fixos travados, demais editáveis
  ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    insertRows: false,
    deleteRows: false,
    sort: false,
  });
  ws.pageSetup.printArea = `A1:I${r}`;

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const nomeArq = (rnc?.num || "RNC").toString().replace(/[^\w-]+/g, "-");
  link.download = `Formulario-Resposta-${nomeArq}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
