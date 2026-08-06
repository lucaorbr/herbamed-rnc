// Sessões de treinamento presencial — lista de presença assinada pelo instrutor.
//
// Por que existe: até aqui o presencial era lançado UMA pessoa por vez, sem
// instrutor explícito, sem carga horária, sem conteúdo e sem assinatura. Numa
// inspeção BPF a lista de presença é o registro primário do treinamento
// presencial — quem ministrou, o que foi ministrado, quanto durou e quem esteve
// presente, com a assinatura de quem atesta.
//
// Princípio mantido das fases anteriores: FONTE ÚNICA. A sessão não é um registro
// paralelo de "quem treinou" — ela é a memória do evento. Quem treinou continua
// sendo a evidência na coleção `treinamentos`, gerada a partir dos presentes no
// momento em que a lista é assinada.

import { novaEvidencia } from "./treinamento";

export const STATUS_SESSAO = { PLANEJADA: "Planejada", REALIZADA: "Realizada" };

/**
 * Próximo número da sessão no ano: TRN-2026-01, TRN-2026-02...
 * A numeração é por ano — vira o ano, recomeça em 01.
 */
export function proxNumSessao(sessoes = [], ano = new Date().getFullYear()) {
  const pre = `TRN-${ano}-`;
  const usados = (sessoes || [])
    .map(s => String(s?.num || ""))
    .filter(n => n.startsWith(pre))
    .map(n => parseInt(n.slice(pre.length), 10))
    .filter(n => Number.isFinite(n));
  const prox = (usados.length ? Math.max(...usados) : 0) + 1;
  return `${pre}${String(prox).padStart(2, "0")}`;
}

/**
 * Rascunho de uma sessão, com os participantes já pré-carregados a partir de quem
 * o documento exige (`exigidosDoDocumento`) — o instrutor não monta a lista à mão.
 *
 * Ninguém entra marcado como presente: presença se confere na sala, não se presume.
 * `jaTreinado` é só um aviso visual — quem já treinou pode legitimamente assistir
 * de novo (reciclagem, turma de reforço), e nesse caso a nova evidência é gravada
 * normalmente e reinicia o relógio da reciclagem.
 */
export function novaSessao({ doc, instrutor, exigidos = [], num, hoje, jaTreinados = [] }) {
  const treinados = new Set((jaTreinados || []).map(String));
  return {
    id: `sess-${Date.now()}`,
    num: num || proxNumSessao([], new Date(hoje || Date.now()).getFullYear()),
    docId: String(doc?.id ?? ""),
    docCodigo: doc?.codigo || "",
    docTitulo: doc?.titulo || "",
    versao: doc?.versao || "01",
    data: hoje || "",
    cargaHoraria: "",
    local: "",
    // Pré-preenchido com o documento: o conteúdo ministrado é, por padrão, ele mesmo.
    conteudo: doc?.codigo ? `${doc.codigo} — ${doc.titulo || ""}`.trim() : "",
    instrutor: instrutor
      ? { userId: String(instrutor.id ?? instrutor.uid ?? ""), nome: instrutor.name || "", cargo: instrutor.cargo || "" }
      : null,
    participantes: (exigidos || []).map(ex => ({
      userId: String(ex.userId),
      userName: ex.userName || "—",
      cargoNome: ex.cargoNome || "",
      setor: ex.setor || "",
      presente: false,
      jaTreinado: treinados.has(String(ex.userId)),
    })),
    status: STATUS_SESSAO.PLANEJADA,
    assinaturaInstrutor: null,
    historico: [],
  };
}

export function presentesDaSessao(sessao) {
  return (sessao?.participantes || []).filter(p => p.presente);
}

/**
 * Travas antes de assinar. A lista de presença é registro controlado: não se
 * assina sem saber quando, quanto tempo, o que foi ministrado e por quem.
 */
export function podeEncerrar(sessao) {
  if (!sessao) return { ok: false, erro: "Sessão inexistente." };
  if (sessao.status === STATUS_SESSAO.REALIZADA) return { ok: false, erro: "Esta sessão já foi encerrada." };
  if (!sessao.data) return { ok: false, erro: "Informe a data do treinamento." };
  if (!String(sessao.cargaHoraria || "").trim()) return { ok: false, erro: "Informe a carga horária." };
  if (!sessao.instrutor?.nome) return { ok: false, erro: "Sessão sem instrutor definido." };
  if (!String(sessao.conteudo || "").trim()) return { ok: false, erro: "Descreva o conteúdo ministrado." };
  if (!presentesDaSessao(sessao).length) return { ok: false, erro: "Marque ao menos um participante presente." };
  return { ok: true, erro: "" };
}

/**
 * As evidências que a sessão grava ao ser assinada — uma por presente.
 *
 * Idempotência em duas camadas, para que reencerrar não duplique registro:
 *  1. pula quem já tem evidência gravada POR ESTA sessão (`sessaoId`);
 *  2. o id da evidência é determinístico (`<sessaoId>-<userId>`), então um
 *     eventual regravar sobrescreve o mesmo registro em vez de criar outro.
 *
 * Note que a trava é por SESSÃO, não por (documento, versão, pessoa): quem está
 * com a reciclagem vencida treinou na mesma versão e precisa de evidência nova —
 * barrar por chave lógica quebraria justamente a reciclagem da Fase 4.
 */
export function evidenciasDaSessao({ sessao, doc, evidenciasExistentes = [], registradoPor = "" }) {
  const jaGravadas = new Set(
    (evidenciasExistentes || [])
      .filter(e => e?.sessaoId && String(e.sessaoId) === String(sessao?.id))
      .map(e => String(e.userId))
  );
  const detalhe = [
    sessao?.num,
    sessao?.instrutor?.nome ? `instrutor ${sessao.instrutor.nome}` : "",
    sessao?.cargaHoraria ? `${sessao.cargaHoraria}h` : "",
    sessao?.local || "",
  ].filter(Boolean).join(" · ");

  return presentesDaSessao(sessao)
    .filter(p => !jaGravadas.has(String(p.userId)))
    .map(p => ({
      ...novaEvidencia({
        doc,
        user: { id: p.userId, name: p.userName },
        cargoNome: p.cargoNome,
        modo: "presencial",
        dataRealizacao: sessao.data,
        obs: detalhe,
        registradoPor,
        origem: "sessao",
      }),
      id: `${sessao.id}-${p.userId}`,
      sessaoId: String(sessao.id),
      sessaoNum: sessao.num || "",
      instrutor: sessao?.instrutor?.nome || "",
    }));
}

/** Sessões de um documento — opcionalmente só as da versão informada. */
export function sessoesDoDocumento(sessoes = [], docId, versao = null) {
  return (sessoes || [])
    .filter(s => String(s?.docId) === String(docId))
    .filter(s => versao == null || String(s?.versao) === String(versao))
    .sort((a, b) => String(b?.num || "").localeCompare(String(a?.num || "")));
}
