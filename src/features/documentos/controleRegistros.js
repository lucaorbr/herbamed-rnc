// Controle de registros — regras puras, sem React.
//
// Lista de Controle de Registros (ISO 9001 7.5.3 / BPF): para cada formulário,
// onde o registro preenchido fica guardado, quem o recupera, por quanto tempo é
// retido e como é descartado.
//
// Não é uma planilha à parte: a regra mora no próprio formulário controlado
// (`doc.controleRegistro`), e a lista é DERIVADA dos documentos. Formulário
// novo entra sozinho, obsoleto sai sozinho — e ninguém redigita código e título.
//
// Sem cadastro antecipado: enquanto ninguém revisou a regra de um formulário,
// vale o PADRÃO abaixo, e a lista marca a linha como "padrão" para a Qualidade
// conferir. O sistema não conta os anos de cada folha preenchida (não sabe a
// data de cada folha física): guarda a REGRA, e o descarte segue sendo decisão
// de quem cuida do arquivo.

/** Tipos de documento que geram registro preenchido. */
export const TIPOS_COM_REGISTRO = ["FO"];

export const ARMAZENAMENTOS = [
  { id: "fisico", label: "Físico" },
  { id: "eletronico", label: "Eletrônico" },
  { id: "ambos", label: "Físico e eletrônico" },
];

export const DESCARTES = [
  { id: "destruicao", label: "Destruição" },
  { id: "exclusao", label: "Exclusão" },
  { id: "na", label: "Não se aplica" },
];

export const REGRA_PADRAO = Object.freeze({
  armazenamento: "fisico",
  retencaoAnos: 5,
  indeterminado: false,
  descarte: "destruicao",
});

/** Status em que o formulário aparece na lista. Obsoleto entra só se pedido. */
const STATUS_NA_LISTA = ["Vigente", "Aguardando Vigência", "Em Revisão", "Aguardando Aprovação"];

export const geraRegistro = (doc) => TIPOS_COM_REGISTRO.includes(doc?.tipo);

const rotulo = (lista, id) => lista.find((x) => x.id === id)?.label || "—";
export const rotuloArmazenamento = (id) => rotulo(ARMAZENAMENTOS, id);
export const rotuloDescarte = (id) => rotulo(DESCARTES, id);

export function textoRetencao(regra) {
  if (regra?.indeterminado) return "Indeterminado";
  const n = Number(regra?.retencaoAnos);
  return n > 0 ? `${n} ano${n === 1 ? "" : "s"}` : "—";
}

/**
 * Regra vigente do formulário: a gravada ou, na falta dela, o padrão.
 * O setor responsável padrão é o departamento do próprio documento.
 */
export function regraDoRegistro(doc) {
  const gravada = doc?.controleRegistro;
  return {
    ...REGRA_PADRAO,
    recuperacao: doc?.depto || "",
    ...(gravada || {}),
    definida: !!gravada,
  };
}

/** Erros do formulário de edição da regra; lista vazia = pode salvar. */
export function errosDaRegra(regra) {
  const erros = [];
  if (!ARMAZENAMENTOS.some((a) => a.id === regra?.armazenamento)) erros.push("Escolha onde o registro fica armazenado.");
  if (!String(regra?.recuperacao || "").trim()) erros.push("Informe o setor responsável.");
  if (!regra?.indeterminado) {
    const n = Number(regra?.retencaoAnos);
    if (!Number.isInteger(n) || n < 1 || n > 100) erros.push("Tempo de retenção deve ser um número inteiro de anos (1 a 100), ou marque Indeterminado.");
  }
  if (!DESCARTES.some((d) => d.id === regra?.descarte)) erros.push("Escolha a forma de descarte.");
  return erros;
}

/** O que gravar no documento ao salvar a regra. */
export function novaRegra(regra, { por = "", hoje } = {}) {
  return {
    armazenamento: regra.armazenamento,
    recuperacao: String(regra.recuperacao || "").trim(),
    indeterminado: !!regra.indeterminado,
    retencaoAnos: regra.indeterminado ? null : Number(regra.retencaoAnos),
    descarte: regra.descarte,
    obs: String(regra.obs || "").trim(),
    atualizadoPor: por,
    atualizadoEm: hoje,
  };
}

/** Linhas da Lista de Controle de Registros, por código. */
export function listaControleRegistros(docs = [], { incluirObsoletos = false } = {}) {
  return (docs || [])
    .filter(geraRegistro)
    .filter((d) => STATUS_NA_LISTA.includes(d.status) || (incluirObsoletos && d.status === "Obsoleto"))
    .map((d) => ({ doc: d, regra: regraDoRegistro(d) }))
    .sort((a, b) => String(a.doc.codigo || "").localeCompare(String(b.doc.codigo || ""), "pt-BR"));
}

/** Contagem para o cabeçalho da lista. */
export function resumoControleRegistros(linhas = []) {
  return {
    total: linhas.length,
    definidas: linhas.filter((l) => l.regra.definida).length,
    noPadrao: linhas.filter((l) => !l.regra.definida).length,
  };
}

// ── Etapa obrigatória do elaborador ─────────────────────────────────────────
// Formulário (FO) só é assinado pelo Elaborador com a regra definida: Revisor e
// Aprovador recebem a definição pronta e assinam sobre ela.

/** Formulário sem regra gravada — trava a assinatura do Elaborador. */
export const faltaControleRegistro = (doc) => geraRegistro(doc) && !doc?.controleRegistro;

/** Campos editáveis da regra, para o formulário de criação/edição do documento. */
export function camposDaRegra(doc) {
  const r = regraDoRegistro(doc);
  return {
    armazenamento: r.armazenamento,
    recuperacao: r.recuperacao,
    retencaoAnos: r.retencaoAnos ?? "",
    indeterminado: !!r.indeterminado,
    descarte: r.descarte,
    obs: r.obs || "",
  };
}

/** A regra mudou em relação à gravada? (não conta quem/quando) */
export function regraMudou(gravada, campos) {
  if (!gravada) return true;
  const norm = (r) => JSON.stringify([
    r.armazenamento, String(r.recuperacao || "").trim(), !!r.indeterminado,
    r.indeterminado ? null : Number(r.retencaoAnos), r.descarte, String(r.obs || "").trim(),
  ]);
  return norm(gravada) !== norm(campos);
}

/** Normaliza para busca: sem acento e sem caixa. */
export const normBusca = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
