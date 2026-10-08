// Página do documento — abas e pendências (regras puras, sem React).
//
// A página juntava ~14 blocos numa coluna só, na ordem em que foram criados.
// Agora são quatro abas por assunto (mesmo desenho da ficha da RNC) e um painel
// de resumo ao lado. A aba mostra um ponto quando tem algo pendente para QUEM
// está vendo, e o documento abre direto na aba onde está a pendência.

export const ABAS_DOCUMENTO = [
  { id: "documento", label: "Documento", icon: "📄" },
  { id: "assinaturas", label: "Assinaturas", icon: "✍️" },
  { id: "distribuicao", label: "Distribuição", icon: "📨" },
  { id: "historico", label: "Histórico", icon: "🕐" },
];

/**
 * O que está pendente em cada aba, para quem está vendo.
 * @param {object} p
 * @param {object} p.doc
 * @param {boolean} p.minhaAssinatura  é a vez desta pessoa assinar como Revisor/Aprovador
 * @param {boolean} p.semRota          assinado pelo Elaborador e sem designados
 * @param {boolean} p.faltaRegistro    formulário sem controle de registro (etapa do elaborador)
 * @param {boolean} p.podeDistribuir
 * @param {boolean} p.semDistribuicao  aprovado e sem destinatários
 */
export function pendenciasPorAba({ doc, minhaAssinatura = false, semRota = false, faltaRegistro = false, podeDistribuir = false, semDistribuicao = false } = {}) {
  const emElaboracao = doc?.status === "Rascunho";
  return {
    documento: emElaboracao && (!doc?.arquivo || faltaRegistro),
    assinaturas: minhaAssinatura || semRota,
    distribuicao: podeDistribuir && (semDistribuicao || (doc?.recolhaPendente || []).length > 0),
    historico: false,
  };
}

/** Aba em que o documento abre: a da assinatura que espera por mim, senão a da distribuição a fazer. */
export function abaInicial(pendencias) {
  if (pendencias?.assinaturas) return "assinaturas";
  if (pendencias?.distribuicao) return "distribuicao";
  return "documento";
}
