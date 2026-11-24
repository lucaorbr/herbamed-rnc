// O que a pessoa pode fazer numa RNC — espelho, na tela, de server/regrasRNC.js
// (o servidor confere campo a campo; aqui só se decide o que aparece).
//   - registro (Editar registro, contenção): "Editar qualquer RNC", ou "Editar RNC
//     própria" quando foi ela quem registrou (ou consta como quem detectou);
//   - tratamento (investigação, causa, CAPA, eficácia, disposição, etapas da externa):
//     "Tratar RNC".

const mesmo = (a, b) => a != null && b != null && String(a).trim() !== "" && String(a) === String(b);

/** A RNC é da pessoa: foi ela quem registrou ou consta como quem detectou. */
export function rncPropria(rnc, user) {
  if (!rnc || !user) return false;
  if (mesmo(rnc.criadoPorId, user.id ?? user.uid)) return true;
  return mesmo(rnc.criadoPor, user.name) || mesmo(rnc.detector, user.name);
}

/** { registro, tratamento } — `perm(chave)` é o do App. */
export function acoesNaRnc(rnc, user, { perm, isAdmin = false, isViewer = false } = {}) {
  if (isViewer || !user) return { registro: false, tratamento: false };
  if (isAdmin) return { registro: true, tratamento: true };
  const p = k => !!perm?.(k);
  return {
    registro: p("editarRNCtodas") || (p("editarRNCpropria") && rncPropria(rnc, user)),
    tratamento: p("analisarRNC"),
  };
}
