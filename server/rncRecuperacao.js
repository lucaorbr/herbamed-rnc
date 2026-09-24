// Reconstrução de RNCs esvaziadas pelo bug do PATCH (PR #145 → corrigido na v3.6.1).
//
// O bug substituía a RNC pelo corpo do patch: sobravam status, histórico e o que mais
// o patch trouxesse; sumiam número, descrição, severidade, prazos, assinaturas.
// O que ainda existe para remontar o registro:
//   - log de auditoria (`generic_documents`, coleção `audit_log`): "Criou RNC"/"Editou RNC"
//     guardam a RNC inteira em `dadosDepois` (e a anterior em `dadosAntes`), mas cortada em
//     2000 caracteres; as demais entradas guardam o patch que foi enviado;
//   - `docNome` da auditoria, que é o número da RNC mesmo quando o JSON foi cortado
//     (o servidor devolve `{ ...corpo, id, num }`, então `num` é a última chave e a
//     primeira a ser perdida no corte);
//   - opcionalmente, a linha da RNC num backup restaurado (pg_dump), completa.
// Tudo aqui é puro: nada grava. Quem grava é `recuperarRNCs.js`, e só com --aplicar.

const ACOES_SNAPSHOT = new Set(["Criou RNC", "Editou RNC"]);
const BASE = 1e15; // desloca as camadas-base para antes de qualquer timestamp real

// Campos sem os quais a RNC não se sustenta na tela nem no PDF.
function rncDanificada(d) {
  return !d || !d.num || !String(d.desc || "").trim() || !d.sev;
}

// JSON.stringify(...).slice(0, 2000) → objeto com tudo que estava completo antes do
// corte. Corta na última vírgula/fechamento fora de string e fecha o que ficou aberto.
// A chave de 1º nível que estava sendo escrita no corte é descartada inteira: metade
// de um histórico ou de uma assinatura não pode passar por registro completo.
function repararJsonTruncado(txt) {
  if (txt == null || txt === "") return null;
  if (typeof txt === "object") return { valor: txt, truncado: false };
  try { return { valor: JSON.parse(txt), truncado: false }; } catch { /* segue */ }

  const pilha = [];
  let emString = false, escape = false, corte = -1, pilhaNoCorte = [];
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (emString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') emString = false;
      continue;
    }
    if (c === '"') emString = true;
    else if (c === "{" || c === "[") pilha.push(c);
    else if (c === "}" || c === "]") { pilha.pop(); corte = i + 1; pilhaNoCorte = [...pilha]; }
    else if (c === ",") { corte = i; pilhaNoCorte = [...pilha]; }
  }
  if (corte < 0 || pilhaNoCorte[0] !== "{") return null;

  let s = txt.slice(0, corte);
  for (let k = pilhaNoCorte.length - 1; k >= 0; k--) s += pilhaNoCorte[k] === "{" ? "}" : "]";
  let valor;
  try { valor = JSON.parse(s); } catch { return null; }
  // Corte dentro de um valor aninhado: a última chave de 1º nível está incompleta.
  if (pilhaNoCorte.length > 1) {
    const chaves = Object.keys(valor);
    delete valor[chaves[chaves.length - 1]];
  }
  return { valor, truncado: true };
}

// Número de RNC plausível (o docNome cai no id quando a RNC já não tinha número).
function numValido(n, id) {
  return typeof n === "string" && n.trim() !== "" && n !== id && n !== "—";
}

// auditoria: entradas do audit_log desta RNC (objetos `data` da coleção).
// backup: { data, updatedAt } da mesma RNC num backup restaurado, se houver.
// numsExternos: números vistos em email_log / rnc_supplier_tokens.
function reconstruirRNC({ atual, auditoria = [], backup = null, numsExternos = [] }) {
  const id = atual?.id;
  const camadas = [];
  const fontes = [];

  if (backup?.data) {
    camadas.push({ ts: Number(backup.updatedAt) || 0, dados: backup.data, origem: "backup" });
  }
  for (const e of [...auditoria].sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
    if (e.acao === "Excluiu RNC") continue;
    const ts = Number(e.ts) || 0;
    const antes = repararJsonTruncado(e.dadosAntes);
    const depois = repararJsonTruncado(e.dadosDepois);
    // `dadosAntes` só serve de BASE (preenche lacuna, nunca sobrepõe): até a v3.6.1 o
    // doUpdateRNC tinha useCallback com dependências vazias e gravava aqui o estado do
    // carregamento da página, que pode ser mais velho que patches já aplicados.
    if (antes?.valor) camadas.push({ ts: ts - BASE, dados: antes.valor, origem: `auditoria:${e.acao} (antes)`, truncado: antes.truncado });
    if (depois?.valor) {
      const tipo = ACOES_SNAPSHOT.has(e.acao) ? "" : " (patch)";
      camadas.push({ ts, dados: depois.valor, origem: `auditoria:${e.acao}${tipo}`, truncado: depois.truncado });
    }
  }
  camadas.sort((a, b) => a.ts - b.ts);

  let rnc = {};
  for (const c of camadas) {
    rnc = { ...rnc, ...c.dados };
    fontes.push(c.origem + (c.truncado ? " [cortado]" : ""));
  }
  // O estado atual por cima: é o mais recente para tudo que ele ainda tem (status,
  // histórico — todo patch leva o histórico inteiro).
  rnc = { ...rnc, ...(atual || {}), id };

  if (!numValido(rnc.num, id)) {
    const candidatos = [
      ...auditoria.map(e => e.docNome),
      ...numsExternos,
    ].filter(n => numValido(n, id));
    if (candidatos.length) {
      rnc.num = candidatos[0];
      fontes.push("número: docNome/e-mail/token");
    }
  }

  const recuperados = Object.keys(rnc).filter(k => {
    const antes = atual?.[k];
    return (antes === undefined || antes === null || antes === "") && rnc[k] !== undefined && rnc[k] !== null && rnc[k] !== "";
  });

  return { rnc, recuperados, fontes, aindaDanificada: rncDanificada(rnc) };
}

module.exports = { rncDanificada, repararJsonTruncado, reconstruirRNC };
