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

// Os erros carregam o campo/linha a que pertencem para a tela poder destacar
// onde falta preencher, em vez de despejar a lista inteira num alerta.
export function pendenciasSubmissao(registro) {
  const erros = [];
  if (!registro?.fornecedorId) erros.push({ campo: "fornecedorId", msg: "Selecione o fornecedor." });
  if (!registro?.categoria) erros.push({ campo: "categoria", msg: "Selecione a categoria." });
  if (!String(registro?.itemNome || "").trim()) erros.push({ campo: "itemNome", msg: "Informe o item, material, produto ou serviço." });
  if (!registro?.criticidade) erros.push({ campo: "criticidade", msg: "Classifique a criticidade." });
  // Motivo deixou de nascer respondido ("Produto novo" vinha pré-selecionado e
  // era gravado como se alguém tivesse escolhido), então passa a ser pedido.
  if (!registro?.motivo) erros.push({ campo: "motivo", msg: "Informe por que esta homologação está sendo aberta." });
  if (!String(registro?.finalidade || "").trim()) erros.push({ campo: "finalidade", msg: "Informe a finalidade da homologação." });
  if (!(registro?.documentos || []).length) erros.push({ campo: "categoria", msg: "O checklist documental não pode ficar vazio." });
  if (!(registro?.checklistTecnico || []).length) erros.push({ campo: "categoria", msg: "O checklist técnico não pode ficar vazio." });
  return erros;
}

// "Não aplicável" dispensa o documento/item da avaliação, então precisa de
// justificativa pelo mesmo motivo que "Reprovado" e "Não conforme" precisam:
// é uma decisão técnica que a inspeção vai querer ler.
export function pendenciasParecer(registro) {
  const erros = [];
  for (const doc of registro?.documentos || []) {
    if (doc.obrigatorio && !["Recebido", "Não aplicável"].includes(doc.situacao)) {
      erros.push({ tipo: "documento", id: doc.id, msg: "Documento obrigatório ainda pendente." });
    }
    if (["Reprovado", "Não aplicável"].includes(doc.situacao) && !String(doc.obs || "").trim()) {
      erros.push({ tipo: "documento", id: doc.id, msg: `Justifique por que este documento está "${doc.situacao}".` });
    }
  }
  for (const item of registro?.checklistTecnico || []) {
    if (!item.resultado) erros.push({ tipo: "tecnico", id: item.id, msg: "Avalie este item." });
    if (["Não conforme", "Não aplicável"].includes(item.resultado) && !String(item.obs || "").trim()) {
      erros.push({ tipo: "tecnico", id: item.id, msg: `Justifique por que este item está "${item.resultado}".` });
    }
  }
  return erros;
}

// Indexa os erros por campo (submissão) ou por linha (parecer) para a tela
// consultar sem varrer a lista a cada render.
export function erroPorChave(erros, chave) {
  return (erros || []).find(e => (e.campo || e.id) === chave)?.msg || "";
}

// O fluxo passa por três pessoas diferentes por segregação de funções, e isso
// não aparecia em lugar nenhum da tela — quem abria a solicitação não sabia o
// que aconteceria depois nem de quem estava esperando.
export const ETAPAS_FLUXO = [
  { id: "solicitacao", label: "Solicitação", quem: "Solicitante" },
  { id: "analise", label: "Análise técnica", quem: "Qualidade" },
  { id: "aprovacao", label: "Aprovação", quem: "Aprovador" },
  { id: "decisao", label: "Decisão", quem: "Registrada" },
];

const ETAPA_POR_STATUS = {
  Rascunho: 0,
  "Em análise": 1,
  "Aguardando aprovação": 2,
  Homologada: 3,
  Condicional: 3,
  Reprovada: 3,
  Vencida: 3,
};

export function etapaAtual(status) {
  return ETAPA_POR_STATUS[status] ?? 0;
}

// Frase única sobre de quem o registro está esperando agora. O aprovador não
// pode ser o solicitante nem o parecerista, então o texto diz "outra pessoa".
export function proximoPasso(status) {
  switch (status) {
    case "Rascunho": return "Enquanto for rascunho, só você enxerga. Ao enviar, a Qualidade recebe para análise.";
    case "Em análise": return "Aguardando o parecer técnico da Qualidade — quem avalia não pode ser quem solicitou.";
    case "Aguardando aprovação": return "Aguardando a decisão final, que é assinada por outra pessoa (nem o solicitante, nem quem deu o parecer).";
    case "Homologada": return "Homologada. Vale até a data de validade registrada na decisão.";
    case "Condicional": return "Homologada com condições. Vale enquanto o fornecedor cumprir o que foi registrado.";
    case "Reprovada": return "Reprovada. Para tentar de novo, abra uma nova homologação.";
    case "Vencida": return "A validade venceu. É preciso abrir uma nova homologação para voltar a usar este item.";
    default: return "";
  }
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
