// Regras de gravação da RNC no servidor.
//
// PATCH mescla, PUT substitui. A PR #145 (v3.3.x) passou a tratar PATCH na mesma
// condição do PUT, e todo patch parcial do cliente — mudança de status, assinatura,
// Ishikawa, CAPA, eficácia, deliberação da RAC — virou substituição: a RNC ficava só
// com os campos do patch (status + histórico) e perdia número, descrição, prazos.
// A regra mora aqui, isolada e testada, para não voltar a depender da ordem dos `if`.

function erro(status, msg) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

// PATCH: o que veio no corpo sobrescreve só as próprias chaves.
function mesclarPatchRNC(existente, patch, id) {
  return { ...(existente || {}), ...(patch || {}), id };
}

// PUT: substituição do registro inteiro (formulário de edição manda a RNC completa).
// Trava de segurança: gravação que apagaria o número de uma RNC já numerada é
// recusada — um corpo sem `num` é um patch parcial chegando pelo verbo errado, não
// uma edição legítima. Melhor falhar alto do que esvaziar o registro em silêncio.
function validarSubstituicaoRNC(existente, novo) {
  if (!existente?.num) return;
  if (!novo?.num) {
    throw erro(409, `Gravação recusada: apagaria o número da RNC ${existente.num}. Recarregue a página e tente novamente.`);
  }
}

module.exports = { mesclarPatchRNC, validarSubstituicaoRNC };
