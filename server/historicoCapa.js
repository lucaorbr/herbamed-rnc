// Tabela "Histórico de Revisão" da capa do documento renderizado.
//
// Cada entrada de `historicoRevisoes` é gravada ao clicar em "Nova revisão" e
// descreve a TRANSIÇÃO: `versao` é a versão que foi arquivada e `versaoAlvo` a
// que começou. A capa, porém, lista VERSÕES — uma linha por revisão do documento.
//
// Dois cuidados que esta função existe para garantir:
//  1. A primeira linha é a versão com que o documento entrou no sistema, que nem
//     sempre é a 00 (documento migrado do papel já entra como Rev.01, Rev.03...).
//     Inventar uma "Rev.00 | Emissão inicial" apagava essa revisão da tabela.
//  2. A data de cada linha é a da APROVAÇÃO/VIGÊNCIA daquela versão. A entrada de
//     transição guarda em `data` a última alteração da versão que SAIU; usar essa
//     data na linha da versão nova mostrava a revisão de hoje com a data de meses atrás.

const APROVADO = new Set(["Vigente", "Aguardando Vigência", "Obsoleto"]);

const numerica = (v) => /^\d+$/.test(String(v ?? "").trim());
const pad = (v) => String(parseInt(v, 10)).padStart(2, "0");

// Versão que a transição abriu. Entradas antigas sem `versaoAlvo` seguem a regra
// de antes (versão arquivada + 1).
function versaoAberta(h) {
  if (h.versaoAlvo || h.revisao) return String(h.versaoAlvo || h.revisao);
  return numerica(h.versao) ? pad(parseInt(h.versao, 10) + 1) : String(h.versao || "");
}

function linhasHistoricoCapa(doc) {
  const historico = Array.isArray(doc?.historicoRevisoes) ? doc.historicoRevisoes : [];
  const versaoAtual = String(doc?.versao || "00");
  const atualAprovada = APROVADO.has(doc?.status);

  // Entrada que arquivou a versão v (é ela que guarda como aquela versão terminou).
  const arquivamento = (v) => historico.find((h) => String(h.versao) === String(v));

  const dataDaVersao = (v, emAndamento) => {
    if (String(v) === versaoAtual) {
      if (!atualAprovada) return emAndamento;
      // Documento aprovado antes de existir data de vigência: vale a assinatura do Aprovador.
      const aprovadoEm = doc?.dataVigencia || doc?.assinaturaAprovador?.timestamp;
      if (aprovadoEm) return aprovadoEm;
    }
    const arq = arquivamento(v);
    return arq?.vigenciaVersao || arq?.data || arq?.atualizadoEm || "";
  };

  const primeira = historico.length ? String(historico[0].versao || "00") : versaoAtual;
  const rows = [{
    versao: primeira,
    data: dataDaVersao(primeira, "Em elaboração") || doc?.criadoEm || "",
    item: "Documento completo",
    descricao: primeira === "00" ? "Emissão inicial" : "Primeira versão registrada no sistema",
  }];

  historico.forEach((h) => {
    const versao = versaoAberta(h);
    const item = h.itemModificado || h.item || h.secao || h.motivo || "";
    const descricao = h.descricao || h.alteracao || h.motivo || "";
    if (!versao && !item && !descricao) return;
    rows.push({
      versao,
      data: dataDaVersao(versao, "Em revisão"),
      item: item || "Não informado",
      descricao: descricao || "Não informado",
    });
  });

  const vistos = new Set();
  return rows.filter((row) => {
    const key = `${row.versao}|${row.data}|${row.item}|${row.descricao}`;
    if (vistos.has(key)) return false;
    vistos.add(key);
    return true;
  });
}

module.exports = { linhasHistoricoCapa };
