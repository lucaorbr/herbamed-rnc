/**
 * Gerador do Formulário de Resposta de RNC para Fornecedores (Excel)
 * SGQ Herbamed — alternativa offline ao link público enquanto a TI libera o acesso externo.
 *
 * Espelha os campos de src/features/rnc/SupplierRNCPage.jsx:
 *   - Dados da NC (preenchido pela Herbamed)
 *   - Análise de Causa: 5 Porquês + Causa raiz
 *   - Plano de Ação 5W2H
 *   - Observações / Evidências
 *
 * Uso:  node scripts/gerar-formulario-rnc.cjs
 * Saída: modelos/Formulario_Resposta_RNC_Fornecedor.xlsx
 */
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

// ---- Paleta da marca (alinhada ao SupplierRNCPage) ----
const VERDE = "FF1A7A3C";        // verde Herbamed
const VERDE_ESC = "FF14532D";    // verde escuro
const VERDE_CLARO = "FFE8F5E9";  // verde bem claro (faixas de seção)
const CINZA_FIXO = "FFEEF2EE";   // campos preenchidos pela Herbamed (não alterar)
const AMARELO_IN = "FFFFFDF0";   // campos a preencher pelo fornecedor
const BORDA = "FFD0DDD2";        // borda suave
const TXT = "FF1A2E1E";          // texto principal
const TXT_FRACO = "FF6B8A6F";    // texto auxiliar
const VERMELHO = "FFC62828";     // obrigatório / alerta

const thin = { style: "thin", color: { argb: BORDA } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

const wb = new ExcelJS.Workbook();
wb.creator = "SGQ Herbamed";
wb.created = new Date();
wb.title = "Formulário de Resposta de RNC — Fornecedor";

const ws = wb.addWorksheet("Resposta RNC", {
  properties: { defaultRowHeight: 16, tabColor: { argb: VERDE } },
  pageSetup: {
    paperSize: 9,            // A4
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

// Larguras (A spacer, B..H conteúdo)
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

// ----------------- helpers -----------------
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

// Faixa de título de seção
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

// Campo: label à esquerda, área de input mergeada à direita
const campo = (label, { fixo = false, altura = 18, obrig = false, placeholder = "" } = {}) => {
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
  const inp = setCell(`C${r}`, placeholder || "", {
    font: { name: "Calibri", size: 10, color: { argb: placeholder ? TXT_FRACO : TXT }, italic: !!placeholder },
    fill: fixo ? CINZA_FIXO : AMARELO_IN,
    align: { vertical: "middle", horizontal: "left", indent: 1, wrapText: true },
    border: allBorders,
  });
  inp.protection = { locked: fixo }; // fornecedor só edita os não-fixos
  const row = r;
  r++;
  return { row, inputAddr: `C${row}`, cell: inp };
};

// ===================================================================
// CABEÇALHO (faixa verde)
// ===================================================================
ws.getRow(1).height = 30;
ws.getRow(2).height = 18;
mergeRange("B1:B2");
setCell("B1", "", {
  fill: VERDE,
  align: { vertical: "middle", horizontal: "center" },
});
// Logo da empresa (public/logornc.jpg) por cima da célula B1:B2
const logoPath = path.join(__dirname, "..", "public", "logornc.jpg");
if (fs.existsSync(logoPath)) {
  const logoId = wb.addImage({ buffer: fs.readFileSync(logoPath), extension: "jpeg" });
  ws.addImage(logoId, {
    tl: { col: 1.15, row: 0.12 }, // dentro da célula B, com pequena margem
    ext: { width: 52, height: 52 },
    editAs: "oneCell",
  });
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
// faixa fina escura
ws.getRow(3).height = 4;
mergeRange("B3:H3");
setCell("B3", "", { fill: VERDE_ESC });
r = 4;

// Legenda / instruções rápidas
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
r++; // respiro

// ===================================================================
// SEÇÃO 1 — DADOS DA NÃO-CONFORMIDADE (preenchido pela Herbamed)
// ===================================================================
secao("①", "DADOS DA NÃO-CONFORMIDADE", "Preenchido pela Herbamed — confira os dados antes de responder.");
campo("Nº da RNC", { fixo: true, placeholder: "ex.: RNC-2026-001" });
campo("Data de abertura", { fixo: true, placeholder: "" });
campo("Produto / Material", { fixo: true });
campo("Lote", { fixo: true });
campo("Fornecedor", { fixo: true });
campo("Qtd. afetada", { fixo: true });
campo("Descrição da não-conformidade", { fixo: true, altura: 48 });
campo("Ação de contenção (Herbamed)", { fixo: true, altura: 32 });
const prazoCampo = campo("Prazo para resposta", { fixo: true, placeholder: "dd/mm/aaaa" });
r++;

// ===================================================================
// SEÇÃO 2 — ANÁLISE DE CAUSA (5 PORQUÊS)
// ===================================================================
secao("②", "ANÁLISE DE CAUSA — 5 PORQUÊS", 'Pergunte "Por quê?" repetidamente até chegar à causa raiz. Aprofunde cada resposta na anterior.');
campo("1º Por quê?  (Por que o problema ocorreu?)", { altura: 30 });
campo("2º Por quê?", { altura: 30 });
campo("3º Por quê?", { altura: 30 });
campo("4º Por quê?", { altura: 30 });
campo("5º Por quê?", { altura: 30 });
const causaRaiz = campo("CAUSA RAIZ identificada", { altura: 40, obrig: true });
// destaque na causa raiz
causaRaiz.cell.border = {
  top: { style: "medium", color: { argb: VERDE } },
  left: { style: "medium", color: { argb: VERDE } },
  bottom: { style: "medium", color: { argb: VERDE } },
  right: { style: "medium", color: { argb: VERDE } },
};
r++;

// ===================================================================
// SEÇÃO 3 — PLANO DE AÇÃO 5W2H (tabela com várias ações)
// ===================================================================
secao("③", "PLANO DE AÇÃO — 5W2H", "Descreva as ações corretivas para eliminar a causa raiz. Use uma linha por ação.");

// Cabeçalho da tabela 5W2H
const headerRow = r;
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

// 5 linhas de ação
const acaoRows = [];
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
  // validação de data na coluna "Quando"
  ws.getCell(`G${r}`).numFmt = "dd/mm/yyyy";
  ws.getCell(`G${r}`).dataValidation = {
    type: "date",
    operator: "greaterThanOrEqual",
    allowBlank: true,
    formulae: [new Date(2026, 0, 1)],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: "Data do prazo",
    error: "Informe a data no formato dd/mm/aaaa (igual ou posterior a hoje).",
  };
  acaoRows.push(r);
  r++;
}
r++;

// ===================================================================
// SEÇÃO 4 — OBSERVAÇÕES / EVIDÊNCIAS
// ===================================================================
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

// ===================================================================
// SEÇÃO 5 — IDENTIFICAÇÃO DO RESPONSÁVEL
// ===================================================================
secao("⑤", "IDENTIFICAÇÃO DO RESPONSÁVEL PELA RESPOSTA");
campo("Nome completo", { obrig: true });
campo("Cargo / Função", {});
campo("Empresa / Departamento", {});
campo("E-mail de contato", {});
campo("Telefone", {});
campo("Data de preenchimento", { placeholder: "dd/mm/aaaa" });

// linha de assinatura
ws.getRow(r).height = 40;
mergeRange(`B${r}:H${r}`);
setCell(`B${r}`, "", {
  fill: AMARELO_IN,
  align: { vertical: "bottom", horizontal: "center" },
  border: allBorders,
}).value = {
  richText: [{ text: "\n_______________________________________________\nAssinatura do responsável", font: { size: 9, color: { argb: TXT_FRACO } } }],
};
ws.getCell(`B${r}`).alignment = { vertical: "bottom", horizontal: "center", wrapText: true };
ws.getCell(`B${r}`).protection = { locked: false };
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

// ---- Proteção da planilha (campos fixos travados, demais editáveis) ----
ws.protect("", {
  selectLockedCells: true,
  selectUnlockedCells: true,
  formatCells: false,
  insertRows: false,
  deleteRows: false,
  sort: false,
});

// área de impressão
ws.pageSetup.printArea = `A1:I${r}`;

// ---- salvar ----
const outDir = path.join(__dirname, "..", "modelos");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "Formulario_Resposta_RNC_Fornecedor.xlsx");
wb.xlsx.writeFile(outFile).then(() => {
  console.log("OK ->", outFile);
});
