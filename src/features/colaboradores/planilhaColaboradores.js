// Modelo de planilha para cadastro de colaboradores — geração e leitura (.xlsx).
//
// Por que existe, sendo que já havia "Modelo CSV": o RH preenche no Excel. Salvar
// como CSV no Excel pt-BR grava em ANSI com `;`, e a acentuação chega quebrada
// ("Produção" → "Produ��o") — o nome do cargo deixa de casar com o catálogo e a
// linha inteira é barrada na importação, sem que ninguém entenda o motivo.
// Lendo o .xlsx direto, o texto vem em Unicode e o problema desaparece.
//
// O modelo também é gerado A PARTIR DOS CATÁLOGOS ATIVOS do sistema: as colunas
// Cargo e Setor viram listas suspensas com os valores exatos que o importador
// reconhece. É a diferença entre "digite o cargo e torça" e "escolha da lista" —
// cargo que não casa com o catálogo barra a linha (regra da Fase 6).

import ExcelJS from "exceljs";
import { cargosAtivos } from "../admin/cargos";
import { opcoesDeLocal, linhasDeMatrizColaboradores } from "./colaboradores";

const VERDE = "FF1A4A2E";     // mesmo verde do cabeçalho dos PDFs (buildPDFShell)
const VERDE_CLARO = "FFEDF2ED";
const CINZA = "FF64748B";

/** Nomes exatos das colunas que o importador entende. Não traduzir. */
export const COLUNAS_MODELO = [
  { chave: "nome",      titulo: "Nome completo",   largura: 34, obrigatorio: true },
  { chave: "matricula", titulo: "Matrícula",       largura: 14 },
  { chave: "cargo",     titulo: "Cargo",           largura: 32, obrigatorio: true },
  { chave: "setor",     titulo: "Setor",           largura: 32 },
  { chave: "admissao",  titulo: "Data de admissão", largura: 18 },
];

const LINHAS_PREENCHIVEIS = 300;

/**
 * Gera e baixa o modelo .xlsx, já com as listas do sistema embutidas.
 *
 * Três abas: a de preenchimento, uma de instruções e uma auxiliar ("Listas")
 * que alimenta as suspensas — esta fica visível de propósito, porque planilha
 * oculta some quando o usuário salva em outro formato e leva a validação junto.
 */
export async function baixarModeloColaboradores({ catalogoCargos = [], catalogoAreas = [] } = {}) {
  const cargos = cargosAtivos(catalogoCargos).map(c => c.nome).filter(Boolean);
  const locais = opcoesDeLocal(catalogoAreas).map(o => o.rotulo);
  // A suspensa oferece o rótulo hierárquico ("Produção › Encapsulamento"), mas o
  // importador resolve o setor pelo NOME dele. Guardamos o nome puro na lista.
  const setores = opcoesDeLocal(catalogoAreas).map(o => o.rotulo.split("›").pop().trim().replace(/\(área inteira\)$/i, "").trim()).filter(Boolean);

  const wb = new ExcelJS.Workbook();
  wb.creator = "SGQ Herbamed";
  wb.created = new Date();

  // ── Aba 1: preenchimento ──
  const ws = wb.addWorksheet("Colaboradores", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUNAS_MODELO.map(c => ({ header: c.titulo, key: c.chave, width: c.largura }));
  const head = ws.getRow(1);
  head.height = 24;
  head.eachCell(c => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    c.alignment = { vertical: "middle", horizontal: "left" };
    c.border = { bottom: { style: "thin", color: { argb: VERDE } } };
  });

  // Uma linha de exemplo, marcada como tal para não virar cadastro sem querer.
  const exemplo = ws.addRow({
    nome: "Adriana Moreira (EXEMPLO — apague esta linha)",
    matricula: "1001",
    cargo: cargos[0] || "Operador de Encapsulamento",
    setor: setores[0] || "Encapsulamento",
    admissao: "05/03/2024",
  });
  exemplo.eachCell(c => { c.font = { italic: true, color: { argb: CINZA }, size: 10 }; });

  // Coluna de data como texto dd/mm/aaaa: o importador aceita os dois, e texto
  // não sofre com a diferença de formato regional entre máquinas.
  ws.getColumn("admissao").numFmt = "@";

  for (let l = 2; l <= LINHAS_PREENCHIVEIS; l++) {
    ws.getRow(l).height = 18;
    if (cargos.length) {
      ws.getCell(`C${l}`).dataValidation = {
        type: "list", allowBlank: false, formulae: [`=Listas!$A$2:$A$${cargos.length + 1}`],
        showErrorMessage: true, errorStyle: "error",
        errorTitle: "Cargo fora do catálogo",
        error: "Escolha um cargo da lista. Cargo que não existe no sistema faz a linha ser recusada na importação.",
      };
    }
    if (setores.length) {
      ws.getCell(`D${l}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [`=Listas!$B$2:$B$${setores.length + 1}`],
        showErrorMessage: true, errorStyle: "warning",
        errorTitle: "Setor fora do catálogo",
        error: "Escolha um setor da lista. Setor desconhecido não barra a linha, mas a pessoa entra sem vínculo de setor.",
      };
    }
  }

  // ── Aba 2: instruções ──
  const wi = wb.addWorksheet("Instruções");
  wi.columns = [{ width: 4 }, { width: 96 }];
  const titulo = wi.addRow(["", "Como preencher e importar"]);
  titulo.getCell(2).font = { bold: true, size: 14, color: { argb: VERDE } };
  wi.addRow([]);
  [
    ["1.", "Preencha uma pessoa por linha na aba \"Colaboradores\". Apague a linha de exemplo."],
    ["2.", "Nome completo e Cargo são obrigatórios. Linha sem nome é ignorada; cargo fora do catálogo faz a linha ser recusada — por isso use a lista suspensa."],
    ["3.", "Matrícula é opcional, mas é o que identifica a pessoa numa reimportação: com matrícula, importar de novo ATUALIZA o cadastro em vez de duplicar."],
    ["4.", "Setor é opcional. Sem setor, a pessoa não é alcançada por documento que exige treinamento por setor."],
    ["5.", "Data de admissão no formato dd/mm/aaaa. Ela evita que recém-contratado apareça como treinamento atrasado."],
    ["6.", "Salve o arquivo como .xlsx mesmo (não converta para CSV) e importe em Admin → Colaboradores → \"Importar planilha\"."],
    ["7.", "A importação mostra uma prévia antes de gravar: o que será criado, o que será atualizado e o que foi recusado."],
  ].forEach(([n, txt]) => {
    const r = wi.addRow([n, txt]);
    r.getCell(1).font = { bold: true, color: { argb: VERDE } };
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    r.height = 30;
  });
  wi.addRow([]);
  const obs = wi.addRow(["", "Quem NÃO tem login no sistema também deve ser cadastrado: é o caso da maioria dos operadores. Eles não confirmam leitura sozinhos — são treinados pela lista de presença assinada pelo instrutor."]);
  obs.getCell(2).font = { italic: true, color: { argb: CINZA }, size: 10 };
  obs.getCell(2).alignment = { wrapText: true, vertical: "top" };
  obs.height = 32;

  // ── Aba 3: listas que alimentam as suspensas ──
  const wl = wb.addWorksheet("Listas");
  wl.columns = [{ header: "Cargos", key: "cargo", width: 36 }, { header: "Setores", key: "setor", width: 36 }, { header: "Referência (hierarquia)", key: "ref", width: 42 }];
  wl.getRow(1).eachCell(c => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  });
  const maxLinhas = Math.max(cargos.length, setores.length);
  for (let i = 0; i < maxLinhas; i++) {
    wl.addRow({ cargo: cargos[i] || "", setor: setores[i] || "", ref: locais[i] || "" });
  }
  wl.getColumn("ref").font = { color: { argb: CINZA }, size: 10 };
  wl.eachRow((r, n) => { if (n > 1) r.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_CLARO } }; });

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-colaboradores.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Lê um .xlsx preenchido e devolve as linhas no mesmo formato do CSV — daí para
 * frente o fluxo (prévia, conflitos, gravação) é exatamente o mesmo.
 * Usa a primeira aba, não a de nome fixo: o usuário pode ter renomeado.
 */
export async function lerPlanilhaColaboradores(arquivo) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await arquivo.arrayBuffer());
  const ws = wb.worksheets.find(w => /colaborador/i.test(w.name)) || wb.worksheets[0];
  if (!ws) return [];
  const matriz = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const valores = [];
    // `row.values` é 1-based e traz um buraco na posição 0.
    for (let i = 1; i <= ws.columnCount; i++) valores.push(row.getCell(i).value);
    matriz.push(valores);
  });
  return linhasDeMatrizColaboradores(matriz)
    // A linha de exemplo do próprio modelo nunca deve virar cadastro.
    .filter(l => !/\(EXEMPLO/i.test(l.nome));
}
