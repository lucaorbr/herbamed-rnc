// Conversão desvio → RNC: o que o desvio leva para a RNC nova.
// Fotos e documentos anexados ao desvio vão junto (a RNC não precisa de novo upload),
// cada um marcado com o número do desvio de onde veio.

export function anexosParaRnc(desvio) {
  return (desvio?.anexos || []).filter(Boolean).map(a => ({ ...a, origemDesvio: desvio.num || null }));
}
