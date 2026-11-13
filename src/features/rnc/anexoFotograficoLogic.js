// Anexo fotográfico do PDF da RNC.
//
// As fotos anexadas em qualquer etapa (registro, investigação, reuniões, CAPA,
// eficácia, resposta do fornecedor) saem no fim do PDF, numeradas como
// "Figura N" e agrupadas pela etapa de origem. No corpo do relatório, onde o
// anexo aparece pelo nome, entra a referência "(Figura N)".
//
// A ordem e a etapa vêm de `evidenciasDaRnc` — a mesma lista da aba Evidências.
// Só imagens entram; PDF/Word/Excel seguem só pelo nome.

import { evidenciasDaRnc } from "./tipoRncLogic";

const EXT_IMAGEM = /\.(png|jpe?g|gif|webp|bmp)$/i;

export function ehImagem(anexo = {}) {
  const tipo = String(anexo.type || "");
  if (tipo) return /^image\//i.test(tipo) && !/svg/i.test(tipo);
  return EXT_IMAGEM.test(String(anexo.name || anexo.nome || ""));
}

// Mesma foto pode estar em dois lugares (ex.: anexo copiado do desvio) — conta uma vez.
const chave = a => a?.url || a?.id || a?.name || "";

export function figurasDaRnc(rnc) {
  const figuras = [];
  const vistos = new Set();
  for (const ev of evidenciasDaRnc(rnc)) {
    if (!ehImagem(ev.anexo)) continue;
    const k = chave(ev.anexo);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    figuras.push({ n: figuras.length + 1, anexo: ev.anexo, etapa: ev.etapa, por: ev.por, data: ev.data });
  }
  return figuras;
}

// Grupos por etapa, na ordem em que a etapa aparece pela primeira vez.
export function gruposPorEtapa(figuras) {
  const grupos = [];
  for (const f of figuras) {
    let g = grupos.find(x => x.etapa === f.etapa);
    if (!g) { g = { etapa: f.etapa, figuras: [] }; grupos.push(g); }
    g.figuras.push(f);
  }
  return grupos;
}

// "foto.jpg (Figura 2), laudo.pdf" — para a linha de anexos no corpo.
export function nomesComFigura(lista, figuras) {
  const porChave = new Map(figuras.map(f => [chave(f.anexo), f.n]));
  return (lista || []).filter(Boolean).map(a => {
    const n = porChave.get(chave(a));
    const nome = a.name || a.nome || "arquivo";
    return n ? `${nome} (Figura ${n})` : nome;
  }).join(", ");
}
