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

// ── Faixa de "próxima ação" (entrega 2) ─────────────────────────────────────
// No lugar de até 7 faixas soltas no topo, uma faixa só: a primeira AÇÃO de quem
// está vendo vai em destaque, com os botões; as outras ações e as informações
// (que não pedem nada) vão em linhas curtas logo abaixo, no mesmo quadro.
//
// Ordem: o que trava o fluxo de outras pessoas primeiro (assinar, corrigir a
// recusa), depois o que é só da pessoa (ler), depois a rotina da Qualidade.

/**
 * @returns {{ id: string, tipo: "acao"|"info", tom: "azul"|"vermelho"|"laranja"|"roxo"|"verde" }[]}
 */
export function itensDaFaixa(c = {}) {
  const itens = [];
  const add = (id, tipo, tom) => itens.push({ id, tipo, tom });
  const emRota = ["Em Revisão", "Aguardando Aprovação"].includes(c.status);

  if (c.podeAssAprov) add("assinar_aprovador", "acao", "azul");
  if (c.podeAssRev) add("assinar_revisor", "acao", "azul");
  if (c.apontamentosAbertos > 0 && ["Rascunho", "Em Revisão"].includes(c.status)) add("corrigir_recusa", "acao", "vermelho");
  // Em Revisão também: numa revisão nova o documento nasce "Em Revisão" sem nenhuma assinatura.
  if (c.podeAssElab && ["Rascunho", "Em Revisão"].includes(c.status)) add("assinar_elaborador", "acao", "azul");
  if (c.semRotaAdmin) add("definir_rota", "acao", "laranja");
  if (c.leituraPendente) add("ler", "acao", "azul");
  if (c.podeDistribuir && c.semDistribuicao) add("distribuir", "acao", "laranja");
  if (c.podeDistribuir && c.recolhas > 0) add("recolher", "acao", "vermelho");
  if (c.status === "Vigente" && c.diasRev != null && c.diasRev <= 30 && c.podeIniciarRevisao) add("revisao_periodica", "acao", c.diasRev <= 0 ? "vermelho" : "laranja");

  if (c.recusasAnteriores > 0 && emRota && !(c.apontamentosAbertos > 0)) add("recusas_anteriores", "info", "laranja");
  if (c.status === "Aguardando Vigência" && c.vigenciaAgendada) add("vigencia_agendada", "info", "roxo");
  if (c.status === "Vigente" && c.diasRev != null && c.diasRev <= 90 && !itens.some(i => i.id === "revisao_periodica")) add("revisao_proxima", "info", c.diasRev <= 0 ? "vermelho" : "laranja");
  if (c.status === "Vigente" && c.revisaoRegistrada && (c.diasRev == null || c.diasRev > 30)) add("revisao_registrada", "info", "verde");

  // Ações antes das informações, preservando a ordem de cada grupo.
  return [...itens.filter(i => i.tipo === "acao"), ...itens.filter(i => i.tipo === "info")];
}
