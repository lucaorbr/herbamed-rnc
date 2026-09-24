// Rota de assinatura da Gestão de Documentos — regra validada no SERVIDOR.
//
// Até a v3.5.1 a segregação de funções (Elaborador ≠ Revisor ≠ Aprovador) só
// existia na tela, e o servidor deixava o admin assinar como Revisor/Aprovador
// mesmo sem ser o designado. Aconteceu em produção: um admin assinou um documento
// que estava na rota de outra pessoa. Agora:
//   - Revisor/Aprovador só assina quem foi DESIGNADO na rota — sem exceção para
//     admin. Rota errada se corrige em "Trocar designados" (fica registrado).
//   - A mesma pessoa não assina dois papéis no mesmo documento.
//   - A ordem Elaborador → Revisor → Aprovador vale no servidor.
//
// A regra roda em dois pontos: no pedido da assinatura (/api/auth/signature) e na
// gravação do documento (/api/collections/gestao_docs), senão bastaria gravar o
// JSON com uma assinatura dentro para contornar a primeira.

const PAPEIS = [
  { papel: "Elaborador", campo: "assinaturaElaborador" },
  { papel: "Revisor", campo: "assinaturaRevisor" },
  { papel: "Aprovador", campo: "assinaturaAprovador" },
];

function erro(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const norm = v => String(v ?? "").trim().toLowerCase();

/** A assinatura gravada é desta pessoa? Por id; e-mail/nome só para assinatura antiga sem id. */
function assinadaPor(ass, user) {
  if (!ass || !user) return false;
  const assId = ass.uid ?? ass.userId;
  if (assId !== undefined && assId !== null && assId !== "") return String(assId) === String(user.id);
  if (ass.email && user.email) return norm(ass.email) === norm(user.email);
  return !!ass.nome && norm(ass.nome) === norm(user.name);
}

/**
 * Pode `user` assinar `doc` no `papel` ("Elaborador" | "Revisor" | "Aprovador")?
 * Lança erro com `status` (403/409) quando não pode.
 */
function validarAssinaturaDocumento(user, doc, papel) {
  const idx = PAPEIS.findIndex(p => p.papel === papel);
  if (idx < 0 || !doc) return;
  const { campo } = PAPEIS[idx];

  if (doc[campo]) throw erro(409, `Este documento já foi assinado como ${papel}.`);

  if (idx > 0) {
    const anterior = PAPEIS[idx - 1];
    if (!doc[anterior.campo]) {
      throw erro(409, `O documento ainda não foi assinado pelo ${anterior.papel.toLowerCase()}.`);
    }
    const rota = doc.rota || {};
    const designadoId = papel === "Revisor" ? rota.revisorId : rota.aprovadorId;
    if (!designadoId) {
      throw erro(409, `Nenhum ${papel.toLowerCase()} foi designado na rota deste documento. Um administrador deve definir os designados antes da assinatura.`);
    }
    if (String(designadoId) !== String(user.id)) {
      throw erro(403, `Apenas o ${papel.toLowerCase()} designado na rota pode assinar este documento.`);
    }
  }

  const outro = PAPEIS.find(p => p.campo !== campo && assinadaPor(doc[p.campo], user));
  if (outro) {
    throw erro(403, `Segregação de funções: você já assinou este documento como ${outro.papel}. Elaboração, revisão e aprovação devem ser feitas por pessoas diferentes.`);
  }
}

const mesmaAssinatura = (a, b) =>
  (a.codigoVerificacao || "") === (b.codigoVerificacao || "")
  && String(a.uid ?? a.userId ?? "") === String(b.uid ?? b.userId ?? "");

/**
 * Na gravação do documento: toda assinatura NOVA tem de ser de quem está gravando
 * e passar pela mesma regra, avaliada sobre o estado ANTERIOR do documento (a rota
 * que vale para Revisor/Aprovador é a que já estava gravada). Assinatura já
 * registrada não se troca por outra: anula-se pelos fluxos que existem para isso
 * (recusa, troca de designado, nova revisão), que gravam o campo vazio.
 */
function validarGravacaoDocumento(user, oldData, newData) {
  const antes = oldData || {};
  for (const { papel, campo } of PAPEIS) {
    const nova = newData?.[campo];
    const velha = antes[campo];
    if (!nova || (velha && mesmaAssinatura(velha, nova))) continue;
    if (velha) throw erro(409, `A assinatura de ${papel} já registrada não pode ser substituída.`);
    if (!assinadaPor(nova, user)) {
      throw erro(403, `A assinatura de ${papel} tem de ser feita pelo próprio usuário.`);
    }
    validarAssinaturaDocumento(user, antes, papel);
  }
}

module.exports = { validarAssinaturaDocumento, validarGravacaoDocumento, assinadaPor };
