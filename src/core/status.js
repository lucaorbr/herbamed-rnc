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

// Taxa de eficácia das RNCs — fonte única (antes eram três contas diferentes).
// Denominador = RNCs ENCERRADAS (os três terminais). Dividir pelo total punia o
// período recente, cujas RNCs ainda nem chegaram à verificação. "Encerrada" (por
// disposição) fica no denominador sem contar como eficaz, para não inflar a taxa
// (decisão da v2.23.0). Nenhuma encerrada → taxa null ("—" na tela, não 0%).
export function taxaEficaciaRNC(rncs = []) {
  const eficazes = rncs.filter(r => r.status === "Eficaz").length;
  const encerradas = rncs.filter(r => rncEncerrada(r.status)).length;
  return { eficazes, encerradas, taxa: encerradas > 0 ? Math.round(eficazes / encerradas * 100) : null };
}

// Disposição do material/lote (padrão farma / SE Suite). `libera` marca as decisões que
// liberam material NÃO CONFORME para uso — por isso exigem assinatura do RT (segregação:
// quem libera NC ≠ quem detectou). As demais gravam só justificativa + autor.
// Decisões de disposição do material. Desde a v3.27.0 (reunião de 11/11/2026):
// - "liberar" (uso normal) saiu das opções; fica na lista só para as RNCs antigas
//   que a registraram continuarem mostrando o rótulo (`retirada: true`).
// - nenhuma decisão exige mais assinatura do RT (concessão inclusive); a assinatura
//   gravada nas disposições antigas continua sendo exibida.
// - "outros" exige a descrição da decisão em texto livre (`disposicao.outro`).
export const DISPOSICOES = [
  { key: "liberar",    label: "Liberar (uso normal)",    cor: "#2ab84a", retirada: true },
  { key: "concessao",  label: "Liberar sob concessão",   cor: "#ffd166" },
  { key: "segregar",   label: "Segregar / Quarentena",   cor: "#4fc3f7" },
  { key: "retrabalho", label: "Retrabalho / Reprocesso", cor: "#a78bfa" },
  { key: "reprovar",   label: "Reprovar / Descartar",    cor: "#ff4f6a" },
  { key: "devolver",   label: "Devolver ao fornecedor",  cor: "#ff8c42" },
  { key: "outros",     label: "Outros",                  cor: "#94a3b8", pedeTexto: true },
];
export const dispMeta = (key) => DISPOSICOES.find(d => d.key === key) || null;
// Opções oferecidas numa disposição nova (sem as retiradas).
export const DISPOSICOES_ATIVAS = DISPOSICOES.filter(d => !d.retirada);
// Rótulo para exibir uma disposição gravada: "Outros — <texto>" quando houver texto.
export const rotuloDisposicao = (disposicao) => {
  const dec = disposicao?.decisao;
  if (!dec) return "";
  const label = dispMeta(dec)?.label || dec;
  const outro = (disposicao.outro || "").trim();
  return dec === "outros" && outro ? `${label} — ${outro}` : label;
};
// Erros de uma disposição a registrar (lista vazia = pode gravar).
export const errosDisposicao = ({ decisao, justificativa, outro }) => {
  const erros = [];
  const meta = dispMeta(decisao);
  if (!decisao || !meta || meta.retirada) erros.push("Selecione a decisão de disposição.");
  if (meta?.pedeTexto && !(outro || "").trim()) erros.push("Descreva a decisão em \"Outros\".");
  if (!(justificativa || "").trim()) erros.push("A justificativa técnica da disposição é obrigatória.");
  return erros;
};

// Severidades oferecidas numa RNC. Desde a v3.28.0 só Maior e Menor: "Crítica" saiu
// (e com ela a aprovação do RT e a entrada na pauta da RAC que dependiam dela).
// SEVMETA mantém "Crítica" só para as RNCs antigas que a registraram seguirem exibindo.
export const SEVERIDADES_RNC = ["Maior", "Menor"];

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
