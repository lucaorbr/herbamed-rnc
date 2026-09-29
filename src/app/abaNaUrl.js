// A tela atual do SGQ vive no endereço (?aba=lista) para o navegador saber que houve
// navegação: sem isso o sistema inteiro era uma página só, o Voltar saía do SGQ e o
// F5 jogava de volta para a Home. A Home não leva parâmetro (endereço limpo).
// A ficha de uma RNC leva também qual RNC e qual etapa: ?aba=rnc&rnc=<id>&etapa=causa.
import { montarGrupos } from "../layout/navegacao";

// Telas que abrem por atalho e não estão no menu.
const FORA_DO_MENU = ["home", "config-desvios", "config-revalidacao", "cq", "rnc"];

function idsDoMenu() {
  const ids = [];
  const coletar = item => { ids.push(item.id); (item.subItems || []).forEach(coletar); };
  // Perfil mais amplo: aqui só se valida que a tela existe. Quem pode ver cada
  // tela continua decidido na renderização (ex.: tab==="admin" && isAdmin).
  montarGrupos({ isAdmin: true }).forEach(g => g.items.forEach(coletar));
  return ids;
}

export const ABAS_VALIDAS = new Set([...idsDoMenu(), ...FORA_DO_MENU]);

const ETAPAS_FICHA = new Set(["resumo", "registro", "contencao", "causa", "capa", "eficacia", "historico"]);

/** Tela pedida no endereço; qualquer coisa desconhecida vira Home. A ficha exige a RNC. */
export function abaDaUrl(search, validas = ABAS_VALIDAS) {
  const p = new URLSearchParams(search || "");
  const aba = p.get("aba");
  if (aba === "rnc" && !p.get("rnc")) return "home";
  return aba && validas.has(aba) ? aba : "home";
}

/** Qual RNC e qual etapa da ficha o endereço pede (etapa inválida vira "resumo"). */
export function fichaDaUrl(search) {
  const p = new URLSearchParams(search || "");
  const etapa = p.get("etapa");
  return { rnc: p.get("rnc") || null, etapa: ETAPAS_FICHA.has(etapa) ? etapa : "resumo" };
}

/**
 * Endereço com a tela trocada, preservando o resto (caminho, outros parâmetros, #).
 * `rnc`/`etapa` só existem na ficha: fora dela saem do endereço.
 */
export function urlComAba(href, aba, { rnc = null, etapa = null } = {}) {
  const url = new URL(href);
  url.searchParams.delete("rnc");
  url.searchParams.delete("etapa");
  if (!aba || aba === "home") url.searchParams.delete("aba");
  else url.searchParams.set("aba", aba);
  if (aba === "rnc" && rnc) {
    url.searchParams.set("rnc", rnc);
    if (etapa && etapa !== "resumo") url.searchParams.set("etapa", etapa);
  }
  return url.pathname + url.search + url.hash;
}

/** O endereço já representa este estado? (compara os parâmetros crus) */
export function enderecoCorresponde(search, aba, { rnc = null, etapa = null } = {}) {
  const p = new URLSearchParams(search || "");
  const abaEsperada = aba === "home" ? null : aba;
  if (p.get("aba") !== abaEsperada) return false;
  if (aba !== "rnc") return !p.get("rnc") && !p.get("etapa");
  return p.get("rnc") === rnc && (p.get("etapa") || "resumo") === (etapa || "resumo");
}
