export const STATUS_HOMOLOGACAO = {
  Rascunho: { cor: "#8a94a6", fundo: "#8a94a618" },
  "Em análise": { cor: "#4fc3f7", fundo: "#4fc3f718" },
  "Aguardando aprovação": { cor: "#ffb300", fundo: "#ffb30018" },
  Homologada: { cor: "#2ab84a", fundo: "#2ab84a18" },
  Condicional: { cor: "#ff8c42", fundo: "#ff8c4218" },
  Reprovada: { cor: "#ff4f6a", fundo: "#ff4f6a18" },
};

export const CATEGORIAS_HOMOLOGACAO = [
  "Matéria-prima",
  "Material de embalagem",
  "Insumo",
  "Produto acabado",
  "Serviço",
  "Outro",
];

const DOCS_COMUNS = [
  ["Questionário de qualificação do fornecedor", true],
  ["Licenças e certificados aplicáveis", true],
  ["Dados cadastrais e unidade fabricante", true],
];

const DOCS_POR_CATEGORIA = {
  "Matéria-prima": [
    ["Ficha técnica e especificação", true],
    ["Certificado de análise modelo", true],
    ["FISPQ / SDS, quando aplicável", false],
    ["Declarações de alergênicos, origem e transgênicos", false],
  ],
  "Material de embalagem": [
    ["Ficha técnica e desenho dimensional", true],
    ["Arte aprovada / referência visual", false],
    ["Declaração de composição e contato, quando aplicável", false],
    ["Laudo ou certificado de conformidade modelo", true],
  ],
  Insumo: [
    ["Ficha técnica e especificação", true],
    ["Certificado de análise ou conformidade modelo", true],
    ["FISPQ / SDS, quando aplicável", false],
  ],
  "Produto acabado": [
    ["Especificação do produto", true],
    ["Dossiê técnico / regulatório aplicável", true],
    ["Certificado de análise modelo", true],
    ["Arte e rotulagem aprovadas", false],
  ],
  Serviço: [
    ["Escopo técnico e critérios de aceite", true],
    ["Qualificações da equipe / responsável técnico", false],
    ["Certificados e licenças aplicáveis", false],
    ["Plano de contingência ou continuidade", false],
  ],
  Outro: [["Evidência técnica aplicável", true]],
};

const TECNICOS_COMUNS = [
  "Escopo e finalidade claramente definidos",
  "Capacidade técnica compatível com a necessidade",
  "Rastreabilidade de lote, serviço ou entrega",
  "Critérios de aceitação definidos",
  "Riscos e controles avaliados",
];

export function documentosIniciais(categoria) {
  return [...DOCS_COMUNS, ...(DOCS_POR_CATEGORIA[categoria] || DOCS_POR_CATEGORIA.Outro)]
    .map(([item, obrigatorio], index) => ({ id: `doc-${index + 1}`, item, obrigatorio, situacao: "Pendente", validade: "", obs: "" }));
}

export function checklistTecnicoInicial(categoria) {
  const extra = categoria === "Serviço"
    ? ["Indicadores de desempenho e SLA definidos"]
    : ["Especificação e amostra avaliadas", "Plano de controle / ensaios definido"];
  return [...TECNICOS_COMUNS, ...extra]
    .map((item, index) => ({ id: `tec-${index + 1}`, item, resultado: "", obs: "" }));
}

export function pendenciasSubmissao(registro) {
  const erros = [];
  if (!registro?.fornecedorId) erros.push("Selecione o fornecedor.");
  if (!String(registro?.itemNome || "").trim()) erros.push("Informe o item, material, produto ou serviço.");
  if (!String(registro?.finalidade || "").trim()) erros.push("Informe a finalidade da homologação.");
  if (!registro?.categoria) erros.push("Selecione a categoria.");
  if (!registro?.criticidade) erros.push("Classifique a criticidade.");
  if (!(registro?.documentos || []).length) erros.push("O checklist documental não pode ficar vazio.");
  if (!(registro?.checklistTecnico || []).length) erros.push("O checklist técnico não pode ficar vazio.");
  return erros;
}

export function pendenciasParecer(registro) {
  const erros = [];
  for (const doc of registro?.documentos || []) {
    if (doc.obrigatorio && !["Recebido", "Não aplicável"].includes(doc.situacao)) erros.push(`Documento pendente: ${doc.item}`);
    if (doc.situacao === "Reprovado" && !String(doc.obs || "").trim()) erros.push(`Justifique o documento reprovado: ${doc.item}`);
  }
  for (const item of registro?.checklistTecnico || []) {
    if (!item.resultado) erros.push(`Avalie o item técnico: ${item.item}`);
    if (item.resultado === "Não conforme" && !String(item.obs || "").trim()) erros.push(`Justifique o item não conforme: ${item.item}`);
  }
  return erros;
}

export function statusEfetivo(registro, hoje = new Date()) {
  if (!["Homologada", "Condicional"].includes(registro?.status)) return registro?.status || "Rascunho";
  const validade = registro?.decisaoFinal?.validade;
  if (!validade) return registro.status;
  const limite = new Date(`${validade}T23:59:59`);
  return limite < hoje ? "Vencida" : registro.status;
}

export function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
