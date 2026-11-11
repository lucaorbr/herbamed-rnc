// Nova RNC a partir de uma RNC Ineficaz (v3.31.0, sessão 6 do plano da reunião de 11/11).
// Ineficaz = o problema persistiu. Modelo SE Suite: a nova NÃO abre sozinha; quem trata
// decide, por um botão na RNC ineficaz, e as duas ficam ligadas — a nova diz de onde veio
// e a antiga ganha a sucessora no histórico. A antiga está encerrada: recebe só o vínculo.

import { tipoRnc } from "./tipoRncLogic";

const cheio = v => typeof v === "string" && v.trim() !== "";
const dataBr = iso => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? iso.slice(0, 10).split("-").reverse().join("/") : iso || "");

/** Só RNC Ineficaz que ainda não tem sucessora. */
export function podeAbrirVinculada(r) {
  return r?.status === "Ineficaz" && !r?.rncSucessora?.id;
}

/** Data em que foi declarada ineficaz (eficácia ou verificação no recebimento). */
const dataIneficaz = r => r?.verificacaoRecebimento?.data || r?.eficacia?.data || r?.eficacia?.registradoEm || "";

/** Por que foi ineficaz, nas palavras de quem verificou. */
function motivoIneficaz(r) {
  const v = r?.verificacaoRecebimento;
  if (v?.resultado === "Não conforme") return [v.lote ? `Recebimento seguinte (lote ${v.lote}) não conforme` : "Recebimento seguinte não conforme", v.obs].filter(cheio).join(": ");
  return [r?.eficacia?.obs, r?.eficacia?.evidencias].filter(cheio).join(" — ");
}

/** O que o formulário da nova RNC já traz preenchido. Tudo editável antes de salvar. */
export function prefillDaIneficaz(r) {
  const quando = dataBr(dataIneficaz(r));
  const motivo = motivoIneficaz(r);
  const desc = [
    `Reincidência: a RNC ${r.num} foi encerrada como Ineficaz${quando ? ` em ${quando}` : ""} — o problema persistiu.`,
    motivo ? `Resultado da verificação: ${motivo}` : "",
    r.ishikawa?.root ? `Causa raiz tratada na ${r.num}: ${r.ishikawa.root}` : "",
    "",
    `Não conformidade original (${r.num}):`,
    String(r.desc || "").trim(),
  ].filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
  return {
    tipoRnc: tipoRnc(r),
    tipo: r.tipo || "",
    tipoOutros: r.tipoOutros || "",
    produto: r.produto || "",
    fornecedor: r.fornecedor || "",
    lote: r.lote || "",
    nf: r.nf || "",
    setor: r.setor || "",
    sev: r.sev || "",
    desc,
    origemRnc: r.id,
    origemRncNum: r.num,
    origemRncDoc: r,
  };
}

/** Entrada de histórico da nova RNC, dizendo de onde veio. */
export function historicoDaNova(origem, autor, data, hora) {
  return { data, hora, acao: `Aberta a partir da RNC ${origem.num} (ineficaz)`, resp: autor, tipo: "vinculo" };
}

/** Patch da RNC antiga: registra a sucessora e acrescenta ao histórico. Nada mais muda. */
export function patchSucessora(antiga, nova, autor, data, hora) {
  return {
    rncSucessora: { id: nova.id, num: nova.num, em: data, por: autor },
    historico: [...(antiga.historico || []), { data, hora, acao: `Nova RNC ${nova.num} aberta a partir desta (ineficaz)`, resp: autor, tipo: "vinculo" }],
  };
}
