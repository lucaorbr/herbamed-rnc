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

import { fmt } from "../../core/utils";
import { novaEvidencia } from "./treinamento";

export const STATUS_SESSAO = { PLANEJADA: "Planejada", REALIZADA: "Realizada" };

// Situação de cada participante na lista. Três estados, não um booleano: "não
// convocado" e "faltou" não podem colapsar no mesmo valor. Quem já está treinado
// e em dia não foi chamado — imprimir "Ausente" no lado dele é afirmar uma falta
// que não houve, e num registro controlado isso é registro errado.
export const SITUACAO = { PRESENTE: "presente", AUSENTE: "ausente", DISPENSADO: "dispensado" };

export const SITUACAO_LABEL = {
  [SITUACAO.PRESENTE]: "Presente",
  [SITUACAO.AUSENTE]: "Ausente",
  [SITUACAO.DISPENSADO]: "Não aplicável",
};

export const MOTIVOS_DISPENSA = [
  "Treinamento válido, em dia",
  "Férias / afastamento",
  "Mudou de cargo ou setor",
  "Não atua na atividade",
];

/** Motivo pré-preenchido de quem já está em dia — carrega até quando o treino vale. */
export function motivoEmDia(venceEm = null) {
  return venceEm ? `Treinamento válido, em dia até ${fmt(venceEm)}` : "Treinamento válido, em dia";
}

/**
 * Situação do participante, tolerando o registro antigo que só tinha o booleano
 * `presente` — sessão já encerrada não se reescreve, então a leitura é que se adapta.
 */
export function situacaoParticipante(p) {
  const sit = p?.situacao;
  if (sit === SITUACAO.PRESENTE || sit === SITUACAO.AUSENTE || sit === SITUACAO.DISPENSADO) return sit;
  return p?.presente ? SITUACAO.PRESENTE : SITUACAO.AUSENTE;
}

/**
 * Troca a situação de um participante. `presente` continua sendo gravado como
 * espelho de `situacao === presente`: é o que a geração de evidência já lê, e
 * mantê-lo evita migrar sessão nenhuma.
 */
export function definirSituacao(p, situacao, motivo = "") {
  const sit = Object.values(SITUACAO).includes(situacao) ? situacao : SITUACAO.AUSENTE;
  return {
    ...p,
    situacao: sit,
    presente: sit === SITUACAO.PRESENTE,
    motivoDispensa: sit === SITUACAO.DISPENSADO ? (motivo || p?.motivoDispensa || "") : "",
  };
}

export function contagemSituacoes(sessao) {
  const ps = sessao?.participantes || [];
  const conta = (sit) => ps.filter(p => situacaoParticipante(p) === sit).length;
  return {
    presente: conta(SITUACAO.PRESENTE),
    ausente: conta(SITUACAO.AUSENTE),
    dispensado: conta(SITUACAO.DISPENSADO),
    total: ps.length,
  };
}

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
 *
 * Quem já tem treinamento válido nasce **dispensado**, com o motivo pré-preenchido
 * (e a validade, quando `validadeTreino` a informa): não foi convocado porque já
 * está em dia, e sair como "ausente" na lista seria registrar uma falta inexistente.
 * `jaTreinado` segue como aviso visual — quem já treinou pode legitimamente assistir
 * de novo (reciclagem, turma de reforço), basta marcar presente, e nesse caso a nova
 * evidência é gravada normalmente e reinicia o relógio da reciclagem.
 */
export function novaSessao({ doc, instrutor, exigidos = [], num, hoje, jaTreinados = [], validadeTreino = {} }) {
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
    participantes: (exigidos || []).map(ex => {
      const emDia = treinados.has(String(ex.userId));
      return definirSituacao({
        userId: String(ex.userId),
        userName: ex.userName || "—",
        cargoNome: ex.cargoNome || "",
        setor: ex.setor || "",
        temLogin: ex.temLogin !== false,
        jaTreinado: emDia,
      }, emDia ? SITUACAO.DISPENSADO : SITUACAO.AUSENTE,
        emDia ? motivoEmDia(validadeTreino?.[String(ex.userId)] || null) : "");
    }),
    status: STATUS_SESSAO.PLANEJADA,
    assinaturaInstrutor: null,
    // Folha de papel assinada de próprio punho, digitalizada e anexada aqui.
    anexos: [],
    historico: [],
  };
}

export function presentesDaSessao(sessao) {
  return (sessao?.participantes || []).filter(p => situacaoParticipante(p) === SITUACAO.PRESENTE);
}

/**
 * A folha física assinada é o registro primário do presencial para quem não tem
 * login. Encerrar sem ela é permitido de propósito (a digitalizadora não está na
 * sala), mas fica pendência visível — mesmo padrão do `recolhaPendente` das cópias
 * controladas: o sistema não trava o fluxo, cobra o que falta.
 */
export function pendenteDigitalizacao(sessao) {
  return sessao?.status === STATUS_SESSAO.REALIZADA && !(sessao?.anexos || []).length;
}

/**
 * Acrescenta anexos à sessão. Em sessão encerrada o anexo é **acréscimo, não
 * alteração**: entra depois do encerramento, sempre carimbado e registrado no
 * histórico, e nunca sai — se anexou o arquivo errado, anexa o certo. Em BPF não
 * se apaga registro.
 */
export function comAnexos(sessao, novos = [], por = "") {
  if (!sessao || !novos?.length) return sessao;
  const agora = new Date().toISOString();
  const carimbados = novos.map(a => ({ ...a, anexadoEm: agora, anexadoPor: por || "" }));
  return {
    ...sessao,
    anexos: [...(sessao.anexos || []), ...carimbados],
    historico: [...(sessao.historico || []), {
      data: agora, por: por || "",
      acao: `Anexou a lista de presença digitalizada: ${carimbados.map(a => a.name || "arquivo").join(", ")}`,
    }],
  };
}

/** Remoção de anexo só antes de assinar — depois do encerramento o registro é imutável. */
export function semAnexo(sessao, indice) {
  if (!sessao || sessao.status === STATUS_SESSAO.REALIZADA) return sessao;
  return { ...sessao, anexos: (sessao.anexos || []).filter((_, i) => i !== indice) };
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
  // Dispensar alguém é decisão registrada, não silêncio: sem motivo, não se sabe
  // depois por que aquela pessoa não foi treinada.
  const semMotivo = (sessao.participantes || []).find(
    p => situacaoParticipante(p) === SITUACAO.DISPENSADO && !String(p?.motivoDispensa || "").trim()
  );
  if (semMotivo) return { ok: false, erro: `Informe o motivo da dispensa de ${semMotivo.userName || "participante"}.` };
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
