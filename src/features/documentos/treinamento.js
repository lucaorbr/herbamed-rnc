// Treinamento e leitura obrigatória — regras puras, sem React.
//
// Princípio (SE Suite / BPF): confirmação de leitura e registro de treinamento
// valem para UMA versão do documento. Nova revisão reabre a exigência; a evidência
// da versão anterior não é apagada, é arquivada no histórico de revisões.

/**
 * Reabre a leitura obrigatória para uma nova revisão do documento.
 * Mantém os mesmos designados e zera as confirmações — quem confirmou a versão
 * anterior não pode seguir exibido como confirmado numa versão que não leu.
 *
 * @param {object|null} leitura  o `doc.leituraObrigatoria` da versão que está sendo arquivada
 * @param {{novaVersao:string, hoje:string, por:string}} ctx
 * @returns {object|null} o novo `leituraObrigatoria` (ou o valor original, se não havia atribuição)
 */
export function reabrirLeitura(leitura, { novaVersao, hoje, por } = {}) {
  if (!leitura?.atribuido) return leitura || null;
  return {
    ...leitura,
    designados: (leitura.designados || []).map(d => ({ ...d, confirmou: false, confirmedoEm: null })),
    reabertoEm: hoje,
    reabertoPor: por || "",
    reabertoNaVersao: novaVersao,
  };
}

/**
 * Um registro de treinamento só comprova treinamento no documento vigente se foi
 * feito na versão vigente. Registros sem `versao` são anteriores ao carimbo de
 * versão (v2.28.1) e não podem ser presumidos atuais.
 */
export function treinoAtual(treino, versaoDoc) {
  return !!treino?.versao && String(treino.versao) === String(versaoDoc);
}

/** Quantos designados ainda não confirmaram a leitura da versão vigente. */
export function pendentesLeitura(leitura) {
  if (!leitura?.atribuido) return 0;
  return (leitura.designados || []).filter(d => !d.confirmou).length;
}
