// Distribuição eletrônica de documento — regras puras, sem React.
//
// Depois da aprovação, a Qualidade (ou quem tem `iniciarRevisao`) escolhe QUEM
// recebe o documento, pessoa por pessoa, entre os usuários com login. Cada
// destinatário confirma a leitura ("Li e entendi") ao abrir o documento.
//
// Independe da Matriz de Treinamento (que está desligada): os destinatários
// são uma lista nominal gravada no documento, não derivada de cargo/setor.
//
// ⚠️ A confirmação é gravada como EVIDÊNCIA na coleção `treinamentos`, no mesmo
// formato da matriz (`novaEvidencia`, modo "leitura", carimbada com a versão).
// Assim, quando a matriz for ligada, as leituras já feitas contam lá sem migrar
// nada — e não existem dois controles paralelos de leitura.
//
// Como a evidência é por versão, nova revisão reabre a leitura sozinha para os
// mesmos destinatários: a confirmação da Rev.01 não responde pela Rev.02.
//
// "Li e entendi" só é liberado depois que a pessoa ABRE o documento (botão Ver).
// A abertura é gravada na coleção `leitura_aberturas`, uma por pessoa e versão
// (id determinístico, fica a primeira). Não prova leitura — nada prova —, mas
// registra que o documento esteve na tela antes da confirmação.

import { chaveEvidencia, diasEntre, indexarEvidencias, novaEvidencia } from "./treinamento";

/** Status em que a distribuição pode ser definida. */
export const STATUS_DISTRIBUIVEL = ["Aguardando Vigência", "Vigente"];

export const destinatariosDoDoc = (doc) => doc?.distribuicaoEletronica?.destinatarios || [];

export const podeDefinirDistribuicao = (doc) => STATUS_DISTRIBUIVEL.includes(doc?.status);

/** Documento vigente ou agendado ainda sem ninguém para receber. */
export const semDistribuicao = (doc) => podeDefinirDistribuicao(doc) && destinatariosDoDoc(doc).length === 0;

/** Desde quando a leitura desta versão está pendente para o destinatário. */
function pendenteDesde(doc, dest) {
  const datas = [dest?.incluidoEm, doc?.dataVigencia].filter(Boolean).sort();
  return datas[datas.length - 1] || null;
}

/** Id da abertura: uma por documento, versão e pessoa. */
export const idAbertura = (docId, versao, userId) => `${docId}|${versao || "01"}|${userId}`;

/** Registro gravado quando a pessoa abre o documento. */
export function novaAbertura(doc, user, agora = new Date()) {
  const userId = String(user?.uid || user?.id || "");
  return {
    id: idAbertura(String(doc.id), doc.versao, userId),
    docId: String(doc.id), docCodigo: doc.codigo || "", versao: doc.versao || "01",
    userId, userName: user?.name || "",
    abertoEm: agora.toISOString(), ts: agora.getTime(),
  };
}

/** Quando a pessoa abriu esta versão do documento (ISO), ou null. */
export function abriuEm(doc, userId, aberturas = []) {
  const id = idAbertura(String(doc?.id), doc?.versao, String(userId));
  return (aberturas || []).find((a) => a?.id === id)?.abertoEm || null;
}

/** Linha por destinatário: abriu, confirmou a versão atual, e há quantos dias espera. */
export function situacaoDaDistribuicao(doc, evidencias = [], hoje, aberturas = []) {
  const indice = evidencias instanceof Map ? evidencias : indexarEvidencias(evidencias);
  const linhas = destinatariosDoDoc(doc).map((dest) => {
    const ev = indice.get(chaveEvidencia(String(doc.id), doc.versao || "01", String(dest.userId)));
    const desde = pendenteDesde(doc, dest);
    return {
      ...dest,
      abertoEm: ev?.abertoEm || abriuEm(doc, dest.userId, aberturas),
      confirmado: !!ev,
      confirmadoEm: ev?.ts ? new Date(ev.ts).toISOString() : null,
      dias: !ev && desde && hoje ? Math.max(0, diasEntre(desde, hoje)) : 0,
    };
  });
  return {
    linhas,
    total: linhas.length,
    confirmados: linhas.filter((l) => l.confirmado).length,
  };
}

/** Leitura que o usuário ainda deve: só documento Vigente (agendado não se lê ainda). */
export function leiturasPendentesDoUsuario({ docs = [], evidencias = [], userId, hoje }) {
  if (!userId) return [];
  const indice = indexarEvidencias(evidencias);
  const saida = [];
  for (const doc of docs || []) {
    if (doc?.status !== "Vigente") continue;
    const dest = destinatariosDoDoc(doc).find((x) => String(x.userId) === String(userId));
    if (!dest) continue;
    if (indice.has(chaveEvidencia(String(doc.id), doc.versao || "01", String(userId)))) continue;
    const desde = pendenteDesde(doc, dest);
    saida.push({ doc, dias: desde && hoje ? Math.max(0, diasEntre(desde, hoje)) : 0 });
  }
  return saida.sort((a, b) => b.dias - a.dias);
}

/**
 * Nova lista de destinatários a partir dos ids escolhidos. Quem já estava
 * mantém a data em que foi incluído; quem entra agora ganha a data de hoje.
 * Devolve também quem entrou e quem saiu, para auditoria e para o aviso por e-mail.
 */
export function comDestinatarios(doc, idsEscolhidos = [], users = [], { por = "", hoje } = {}) {
  const atuais = destinatariosDoDoc(doc);
  const porId = new Map(atuais.map((d) => [String(d.userId), d]));
  const escolhidos = [...new Set((idsEscolhidos || []).map(String))];
  const destinatarios = [];
  const incluidos = [];
  for (const id of escolhidos) {
    if (porId.has(id)) { destinatarios.push(porId.get(id)); continue; }
    const u = (users || []).find((x) => String(x.id) === id);
    if (!u) continue;
    const novo = { userId: id, nome: u.name || "—", email: u.email || "", setor: u.setor || "", incluidoPor: por, incluidoEm: hoje };
    destinatarios.push(novo);
    incluidos.push(novo);
  }
  const removidos = atuais.filter((d) => !escolhidos.includes(String(d.userId)));
  return {
    doc: {
      ...doc,
      distribuicaoEletronica: {
        ...(doc?.distribuicaoEletronica || {}),
        destinatarios,
        atualizadaPor: por,
        atualizadaEm: hoje,
      },
    },
    incluidos,
    removidos,
  };
}

/** Evidência de leitura gravada quando o destinatário clica em "Li e entendi". */
export function evidenciaDeLeitura(doc, user, hoje, abertoEm = null) {
  const id = String(user?.uid || user?.id || "");
  const ev = novaEvidencia({
    doc,
    user: { id, name: user?.name },
    cargoNome: user?.cargo || "",
    modo: "leitura",
    dataRealizacao: hoje,
    obs: "Leitura confirmada pelo destinatário da distribuição",
    registradoPor: user?.name || "",
    origem: "distribuicao",
  });
  return abertoEm ? { ...ev, abertoEm } : ev;
}

/** Usuários agrupados pelo setor do cadastro (texto livre), para a escolha na tela. */
export function usuariosPorSetor(users = [], busca = "") {
  const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const termos = norm(busca).split(/\s+/).filter(Boolean);
  const grupos = new Map();
  for (const u of users || []) {
    const alvo = norm(`${u.name} ${u.email} ${u.setor} ${u.cargo}`);
    if (!termos.every((t) => alvo.includes(t))) continue;
    const setor = String(u.setor || "").trim() || "Sem setor informado";
    if (!grupos.has(setor)) grupos.set(setor, []);
    grupos.get(setor).push(u);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === "Sem setor informado") - (b === "Sem setor informado") || a.localeCompare(b, "pt-BR"))
    .map(([setor, lista]) => ({ setor, usuarios: lista.sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR")) }));
}
