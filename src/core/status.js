export const SMETA = {
  "Aberta":              { c: "#ff4f6a", bg: "#ff4f6a18", dot: "#ff4f6a" },
  "Em andamento":        { c: "#ffd166", bg: "#ffd16618", dot: "#ffd166" },
  "Pendente verificação":{ c: "#4fc3f7", bg: "#4fc3f718", dot: "#4fc3f7" },
  "Eficaz":              { c: "#2ab84a", bg: "#2ab84a18", dot: "#2ab84a" },
  "Ineficaz":            { c: "#ff4f6a", bg: "#ff4f6a18", dot: "#ff4f6a" },
  "Encerrada":           { c: "#94a3b8", bg: "#94a3b818", dot: "#94a3b8" },
};

// Estados terminais de uma RNC (encerradas — não entram em "aberta / vencida / pauta").
// "Eficaz"/"Ineficaz" fecham pelo ciclo de eficácia; "Encerrada" fecha por disposição
// do material (resolvida sem CAPA formal). Fonte única — todo filtro de "RNC ativa"
// deve usar rncAtiva() em vez de comparar status soltos.
export const RNC_TERMINAIS = ["Eficaz", "Ineficaz", "Encerrada"];
export const rncEncerrada = (st) => RNC_TERMINAIS.includes(st);
export const rncAtiva = (st) => !RNC_TERMINAIS.includes(st);

export const SEVMETA = {
  "Crítica": { c: "#ff4f6a", bg: "#ff4f6a18" },
  "Maior":   { c: "#ff8c42", bg: "#ff8c4218" },
  "Menor":   { c: "#a78bfa", bg: "#a78bfa18" },
};

export const TIPOC = {
  "Matéria-prima":       "#4fc3f7",
  "Material de embalagem":"#22d3ee",
  "Insumo":              "#818cf8",
  "Produto acabado":     "#2ab84a",
  "Processo":            "#ffd166",
  "Equipamento":         "#ff8c42",
  "Documentação":        "#a78bfa",
  "Ambiental":           "#5dd4b0",
  "Outros":              "#94a3b8",
};

// Ordem fixa que indexa TIPOC <-> T.dataviz — "Outros" fica de fora de propósito
// (cai no cinza neutro do fallback, correto para uma categoria catch-all).
const TIPO_ORDEM = Object.keys(TIPOC).filter(t => t !== "Outros");

// Cor de um tipo de RNC no tema ativo. Cada tema pode declarar `dataviz` (paleta
// categórica própria, tunada pro fundo dele) — mesma posição na lista = mesma
// categoria em qualquer tela (tabela, dashboard "Por Tipo"). Sem tema ou tema sem
// `dataviz`, cai no TIPOC fixo de sempre (zero mudança pros temas que não o declaram).
export function tipoCor(tipo, T) {
  const i = TIPO_ORDEM.indexOf(tipo);
  if (T?.dataviz && i >= 0 && T.dataviz[i]) return T.dataviz[i];
  return TIPOC[tipo] || T?.accent || "#94a3b8";
}
