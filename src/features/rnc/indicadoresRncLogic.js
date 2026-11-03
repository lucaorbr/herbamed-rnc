// Séries dos gráficos dos Indicadores de RNC — só cálculo, sem tela, para poder testar.
//
// Os números são os mesmos que a tela sempre mostrou (Por Status, Por Tipo, Pareto); o
// que entra de novo é a tendência mensal, que antes não existia nesta tela.

import { dataEncerramentoRnc } from "../apresentacao/apresentacaoLogic";

export const SEVERIDADES = ["Menor", "Maior", "Crítica"];

const rotuloMes = (m, comAno) => {
  const [ano, ms] = m.split("-").map(Number);
  return new Date(ano, ms - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: comAno ? "2-digit" : undefined });
};

/**
 * Uma linha por mês do período: RNCs abertas no mês separadas por severidade e as
 * encerradas no mês. As abertas vêm de `doPeriodo` (já filtradas pela data de
 * abertura); as encerradas olham `todas`, porque RNC aberta antes do período e
 * encerrada dentro dele também foi encerrada naquele mês.
 */
export function tendenciaMensal(doPeriodo = [], todas = [], meses = []) {
  const comAno = meses.length > 12;
  return meses.map(m => {
    const doMes = doPeriodo.filter(r => (r.data || "").startsWith(m));
    const linha = { _key: m, mes: rotuloMes(m, comAno), total: doMes.length };
    for (const sev of SEVERIDADES) linha[sev] = doMes.filter(r => r.sev === sev).length;
    linha["Encerradas"] = todas.filter(r => (dataEncerramentoRnc(r) || "").startsWith(m)).length;
    return linha;
  });
}

/** Contagem por chave, do maior para o menor, no formato `{ name, value }` da rosca. */
export function contagem(lista = [], chave) {
  const mapa = {};
  for (const r of lista) {
    const k = chave(r);
    if (!k) continue;
    mapa[k] = (mapa[k] || 0) + 1;
  }
  return Object.entries(mapa).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
}

/**
 * Pareto: cada item com a quantidade, o % do total e o % acumulado. `dentro80`
 * marca os que somam até 80% — o mesmo critério da tela antiga (acumulado ≤ 80),
 * com o primeiro sempre dentro, para o destaque nunca sair vazio.
 */
export function pareto(itens = []) {
  const total = itens.reduce((s, i) => s + i.value, 0) || 1;
  let acum = 0;
  return itens.map((i, idx) => {
    const pct = i.value / total * 100;
    acum += pct;
    const acumR = Math.round(Math.min(acum, 100) * 10) / 10;
    return { nome: i.name, qtd: i.value, pct: Math.round(pct * 10) / 10, acum: acumR, dentro80: idx === 0 || acumR <= 80 };
  });
}
