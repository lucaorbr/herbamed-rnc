// "O que precisa de mim agora?" — a pergunta que a tela inicial passa a responder.
//
// Por que existe: o sistema já calculava tudo isto (prazo de RNC vencido, desvio
// parado na triagem, laudo esperando o RT, treinamento atrasado), mas espalhado —
// um pedaço no sino de notificações, outro no card "Saúde do sistema", outro só
// dentro do próprio módulo. A tela inicial mostrava "Ações rápidas" e um banner no
// espaço nobre, e reservava o maior painel para dizer que a fila estava vazia.
//
// Aqui as fontes são reunidas num formato único e ordenadas por quem precisa agir
// primeiro. Regras puras, sem React e sem acesso a banco: o que entra é dado já
// carregado pela App, o que sai é lista pronta para desenhar.

import { rncAtiva } from "../../core/status";

export const URGENCIA = { CRITICO: "critico", ATENCAO: "atencao" };

// Meta de triagem de desvio — mesma fonte única usada pelos indicadores (7 dias).
export const META_TRIAGEM_PADRAO = 7;

const diasEntre = (de, ate) => {
  if (!de || !ate) return 0;
  const ms = new Date(`${String(ate).slice(0, 10)}T12:00:00`) - new Date(`${String(de).slice(0, 10)}T12:00:00`);
  return Math.max(0, Math.floor(ms / 86400000));
};

const item = (o) => ({ minha: false, dias: 0, urgencia: URGENCIA.ATENCAO, ...o });

/** RNC com prazo de ação corretiva estourado, e as que estão comigo. */
export function pendenciasDeRNC({ rncs = [], userName = "", hoje }) {
  const out = [];
  for (const r of rncs) {
    if (!rncAtiva(r?.status)) continue;
    const minha = !!userName && r.resp === userName;
    const vencida = r.prazoAC && r.prazoAC < hoje;
    if (vencida) {
      out.push(item({
        id: `rnc-venc-${r.id}`, fonte: "rnc", tab: "lista", minha,
        titulo: `${r.num} — prazo da ação corretiva vencido`,
        detalhe: r.desc || "", dias: diasEntre(r.prazoAC, hoje), urgencia: URGENCIA.CRITICO,
      }));
    } else if (minha && r.status === "Aberta") {
      // Atribuída a mim e ainda sem nenhum ato de tratamento.
      out.push(item({
        id: `rnc-minha-${r.id}`, fonte: "rnc", tab: "lista", minha: true,
        titulo: `${r.num} — aguardando seu tratamento`,
        detalhe: r.desc || "", dias: r.data ? diasEntre(r.data, hoje) : 0,
      }));
    }
  }
  return out;
}

/** Desvio parado na triagem. Estourou a meta, vira crítico. */
export function pendenciasDeDesvio({ desvios = [], hoje, meta = META_TRIAGEM_PADRAO, podeVerDesvios = true }) {
  if (!podeVerDesvios) return [];
  return (desvios || [])
    .filter(d => d?.status === "Registrado")
    .map(d => {
      // ⚠️ O desvio NÃO tem campo `data` — tem `dataRegistro` (quando foi registrado,
      // que é o que a triagem cobra) e `dataOcorrencia`. Mesma leitura de
      // `triagemStatus` em DesviosTabs, para as duas telas nunca discordarem de
      // quantos dias o desvio está parado.
      const dias = diasEntre(d.dataRegistro || d.dataOcorrencia, hoje);
      return item({
        id: `desvio-${d.id}`, fonte: "desvio", tab: "desvios",
        titulo: `${d.num || "Desvio"} — aguardando triagem`,
        detalhe: d.desc || d.descricao || "",
        dias, urgencia: dias > meta ? URGENCIA.CRITICO : URGENCIA.ATENCAO,
      });
    });
}

/** Laudo emitido esperando a assinatura do RT — só aparece para quem assina. */
export function pendenciasDeLaudo({ laudos = [], podeAssinar = false }) {
  if (!podeAssinar) return [];
  // A assinatura do RT só é possível DEPOIS da do analista (LaudosTab: podeAssinarRT
  // exige assinaturaAnalista). Sem esse filtro a home cobrava do RT um laudo que ele
  // ainda não tinha como assinar.
  const esperando = (laudos || []).filter(l => l && l.assinaturaAnalista && !l.assinaturaRT && l.status !== "Rascunho");
  if (!esperando.length) return [];
  return [item({
    id: "laudos-rt", fonte: "laudo", tab: "laudos", minha: true,
    titulo: `${esperando.length} laudo(s) aguardando sua assinatura`,
    detalhe: esperando.slice(0, 3).map(l => l.num || l.produto || "—").join(", "),
  })];
}

/** Liberação de IPC pendente. */
// Sem gate de permissão de propósito: a aba de IPC também não tem um no App.jsx
// (`tab==="ipc" && <IPCTab/>`), então esta pendência nunca leva a uma tela vazia.
// Se um dia o IPC ganhar permissão própria, ela tem de chegar aqui junto.
export function pendenciasDeIPC({ ipc = [] }) {
  const pendentes = (ipc || []).filter(r => r?.status === "Pendente");
  if (!pendentes.length) return [];
  return [item({
    id: "ipc-pendentes", fonte: "ipc", tab: "ipc",
    titulo: `${pendentes.length} liberação(ões) de IPC pendente(s)`,
    detalhe: "Controle de processo aguardando liberação",
  })];
}

/**
 * Treinamento obrigatório do próprio usuário. Recebe o resultado de
 * `pendentesDoUsuario` já calculado — a regra de quem deve treinar mora em
 * `treinamento.js` e não se reimplementa aqui.
 */
export function pendenciasDeTreinamento({ pendentesTreino = [] }) {
  return (pendentesTreino || []).map(p => item({
    id: `treino-${p.doc?.id}`, fonte: "treinamento", tab: "gestao-docs", minha: true,
    titulo: `${p.doc?.codigo || "Documento"} — ${p.status === "vencido" ? "reciclagem vencida" : "treinamento pendente"}`,
    detalhe: p.doc?.titulo || "",
    dias: p.dias || 0,
    urgencia: (p.status === "vencido" || p.status === "atrasado") ? URGENCIA.CRITICO : URGENCIA.ATENCAO,
  }));
}

/** Notificações de documento endereçadas a mim (rota de assinatura, vigência…). */
export function pendenciasDeDocumento({ docNotifs = [], hoje }) {
  return (docNotifs || [])
    .filter(n => n && !n.lida)
    .map(n => item({
      id: `doc-${n.id}`, fonte: "documento", tab: "gestao-docs", minha: true,
      titulo: n.titulo || "Documento",
      detalhe: n.mensagem || "",
      dias: n.criada_em ? diasEntre(n.criada_em, hoje) : 0,
    }));
}

/**
 * Ordem de atendimento: primeiro o que é meu (a tela responde "precisa de MIM"),
 * depois o que é crítico, e dentro disso o que espera há mais tempo. Empate
 * resolvido pelo id, para a lista não dançar entre renders.
 */
export function ordenarPendencias(lista = []) {
  const peso = (p) => (p.urgencia === URGENCIA.CRITICO ? 0 : 1);
  return [...lista].sort((a, b) =>
    (Number(b.minha) - Number(a.minha)) ||
    (peso(a) - peso(b)) ||
    ((b.dias || 0) - (a.dias || 0)) ||
    String(a.id).localeCompare(String(b.id))
  );
}

export function montarPendencias(ctx = {}) {
  return ordenarPendencias([
    ...pendenciasDeRNC(ctx),
    ...pendenciasDeDesvio(ctx),
    ...pendenciasDeLaudo(ctx),
    ...pendenciasDeIPC(ctx),
    ...pendenciasDeTreinamento(ctx),
    ...pendenciasDeDocumento(ctx),
  ]);
}

/** Resumo para o cabeçalho da tela. */
export function resumoPendencias(lista = []) {
  return {
    total: lista.length,
    criticas: lista.filter(p => p.urgencia === URGENCIA.CRITICO).length,
    minhas: lista.filter(p => p.minha).length,
  };
}
