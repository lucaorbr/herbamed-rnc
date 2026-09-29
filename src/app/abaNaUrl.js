// A tela atual do SGQ vive no endereço (?aba=lista) para o navegador saber que houve
// navegação: sem isso o sistema inteiro era uma página só, o Voltar saía do SGQ e o
// F5 jogava de volta para a Home. A Home não leva parâmetro (endereço limpo).
import { montarGrupos } from "../layout/navegacao";

// Telas que abrem por atalho e não estão no menu.
const FORA_DO_MENU = ["home", "config-desvios", "config-revalidacao", "cq"];

function idsDoMenu() {
  const ids = [];
  const coletar = item => { ids.push(item.id); (item.subItems || []).forEach(coletar); };
  // Perfil mais amplo: aqui só se valida que a tela existe. Quem pode ver cada
  // tela continua decidido na renderização (ex.: tab==="admin" && isAdmin).
  montarGrupos({ isAdmin: true }).forEach(g => g.items.forEach(coletar));
  return ids;
}

export const ABAS_VALIDAS = new Set([...idsDoMenu(), ...FORA_DO_MENU]);

/** Tela pedida no endereço; qualquer coisa desconhecida vira Home. */
export function abaDaUrl(search, validas = ABAS_VALIDAS) {
  const aba = new URLSearchParams(search || "").get("aba");
  return aba && validas.has(aba) ? aba : "home";
}

/** Endereço com a tela trocada, preservando o resto (caminho, outros parâmetros, #). */
export function urlComAba(href, aba) {
  const url = new URL(href);
  if (!aba || aba === "home") url.searchParams.delete("aba");
  else url.searchParams.set("aba", aba);
  return url.pathname + url.search + url.hash;
}
