// Recusa de documento na rota de assinatura — quem é avisado, e com que texto.
//
// Até a v3.17.1 a recusa não gerava notificação nenhuma: o elaborador só sabia ao
// abrir o documento e ver a faixa, e o Revisor nunca sabia por que o Aprovador
// recusou — os apontamentos eram apagados quando o elaborador reassinava. Agora:
//   - recusa do APROVADOR avisa o Elaborador e o Revisor (o Revisor assinou uma
//     versão que o Aprovador não aceitou, e vai revisar a correção);
//   - recusa do REVISOR avisa o Elaborador.
// A mensagem leva o motivo (primeiros apontamentos), para quem recebe não precisar
// abrir o documento para saber o que houve.
//
// A recusa é reconhecida por uma entrada nova em `historicoRecusas` (gravado pela
// tela junto com a recusa), não por "voltou para Rascunho" — editar um documento
// assinado também volta para Rascunho e não é recusa.

const MAX_APONTAMENTOS_NA_MENSAGEM = 3;

function resumoDosApontamentos(apontamentos = []) {
  const itens = (apontamentos || []).filter(a => a && a.descricao);
  const mostrados = itens.slice(0, MAX_APONTAMENTOS_NA_MENSAGEM)
    .map(a => `${a.secao && a.secao !== "Geral" ? `[${a.secao}] ` : ""}${a.descricao}`);
  const resto = itens.length - mostrados.length;
  return mostrados.join(" · ") + (resto > 0 ? ` · e mais ${resto} apontamento(s)` : "");
}

/** Recusa nova nesta gravação, ou null. */
function recusaNova(oldData, newData) {
  const antes = (oldData && oldData.historicoRecusas) || [];
  const depois = (newData && newData.historicoRecusas) || [];
  if (depois.length <= antes.length) return null;
  return depois[depois.length - 1];
}

/**
 * Notificações a criar quando a gravação registra uma recusa.
 * Devolve [{ userId, tipo, titulo, mensagem }] — sem duplicar destinatário e
 * sem avisar quem recusou.
 */
function notificacoesDeRecusa(oldData, newData) {
  const recusa = recusaNova(oldData, newData);
  if (!recusa) return [];
  const codigo = newData.codigo || (oldData && oldData.codigo) || "";
  const titulo = newData.titulo || (oldData && oldData.titulo) || "";
  const papel = recusa.autorPapel === "aprovador" ? "Aprovador" : "Revisor";
  const quem = recusa.autor || papel;
  const motivo = resumoDosApontamentos(recusa.apontamentos);
  const motivoFinal = motivo && !/[.!?]$/.test(motivo) ? `${motivo}.` : motivo;
  const base = `${codigo} — ${titulo} foi recusado por ${quem} (${papel}).${motivoFinal ? ` Motivo: ${motivoFinal}` : ""}`;

  const elaboradorId = oldData && oldData.assinaturaElaborador && oldData.assinaturaElaborador.uid;
  const revisorId = (newData.rota && newData.rota.revisorId) || (oldData && oldData.rota && oldData.rota.revisorId);
  const autorId = recusa.autorId ? String(recusa.autorId) : null;

  const destinos = [];
  if (elaboradorId) destinos.push({
    userId: String(elaboradorId), tipo: "documento_recusado",
    titulo: "Documento recusado — corrigir e reassinar",
    mensagem: `${base} Corrija e assine novamente como Elaborador.`,
  });
  if (recusa.autorPapel === "aprovador" && revisorId) destinos.push({
    userId: String(revisorId), tipo: "documento_recusado",
    titulo: "Documento que você revisou foi recusado pelo Aprovador",
    mensagem: `${base} Ele voltará para sua revisão depois da correção.`,
  });

  const vistos = new Set();
  return destinos.filter(d => {
    if (d.userId === autorId || vistos.has(d.userId)) return false;
    vistos.add(d.userId);
    return true;
  });
}

module.exports = { notificacoesDeRecusa, resumoDosApontamentos };
