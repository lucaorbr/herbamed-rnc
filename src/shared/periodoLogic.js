// Filtro de período dos indicadores — fonte única.
//
// Cada tela de indicador tinha o próprio jeito de recortar o tempo (botões fixos de
// "últimos N meses", 12 meses cravados, nenhum filtro) e nenhuma deixava escolher
// "de x até y". Aqui mora a regra; o componente `FiltroPeriodo.jsx` é só a tela.
//
// Datas trafegam como texto `YYYY-MM-DD` no fuso LOCAL. `toISOString()` devolve UTC:
// no Brasil, depois das 21h ele já dá o dia seguinte — por isso nada aqui o usa para
// "hoje".
//
// ⚠️ "Voltar N meses" é sempre calculado a partir do DIA 1 (`new Date(ano, mes - n, 1)`).
// `d.setMonth(d.getMonth() - n)` num dia 31 transborda (31/out − 1 mês = 1º/out) e
// os gráficos mensais repetiam um mês e pulavam outro nos dias 29 a 31.

const pad = n => String(n).padStart(2, "0");

/** Date → `YYYY-MM-DD` no fuso local. */
export const isoLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** `YYYY-MM-DD` → Date ao meio-dia local (meio-dia evita virar o dia em horário de verão). */
const paraDate = iso => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

export const somarDias = (iso, n) => {
  const d = paraDate(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};

/** Dia 1 do mês que fica `n` meses antes do mês de `iso`. */
export const inicioMesesAtras = (iso, n) => {
  const [y, m] = iso.split("-").map(Number);
  return isoLocal(new Date(y, m - 1 - n, 1, 12));
};

export const diasEntre = (a, b) => Math.round((paraDate(b) - paraDate(a)) / 86400000);

/**
 * Normaliza o que os registros guardam como data (texto `YYYY-MM-DD`, timestamp ISO,
 * número em ms, Date) para `YYYY-MM-DD`. Vazio ou inválido → "".
 */
export const dataIso = v => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "";
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? "" : isoLocal(d);
};

// Atalhos disponíveis. Cada tela escolhe quais mostra (o Relatórios de RNC usa os
// curtos; os painéis, os de meses).
export const PRESETS = {
  "7d":   { label: "Últimos 7 dias" },
  "15d":  { label: "Últimos 15 dias" },
  "mes":  { label: "Mês atual" },
  "3m":   { label: "Últimos 3 meses" },
  "6m":   { label: "Últimos 6 meses" },
  "12m":  { label: "Últimos 12 meses" },
  "ano":  { label: "Ano atual" },
  "tudo": { label: "Todo o histórico" },
};

export const PRESETS_PAINEL = ["mes", "3m", "6m", "12m", "ano", "tudo"];
export const PERSONALIZADO = "personalizado";

const ehData = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Transforma a escolha da tela em período concreto `{ de, ate }` (inclusive nas duas pontas).
 *
 * - `sel`: `{ preset, de, ate }` — `de`/`ate` só importam no personalizado.
 * - `datas`: datas dos registros, para "Todo o histórico" começar no mais antigo e
 *   para o personalizado sem início.
 *
 * Os atalhos de meses contam o mês corrente como o último: "6 meses" em 23/09 vai de
 * 1º/04 a 23/09 — o mesmo que os Indicadores de Desvios já faziam.
 * Datas invertidas no personalizado são trocadas em vez de devolver período vazio.
 */
export function resolverPeriodo(sel = {}, { hoje = isoLocal(), datas = [] } = {}) {
  const preset = sel.preset || "12m";
  const maisAntiga = () => {
    let min = "";
    for (const d of datas) { const x = dataIso(d); if (x && (!min || x < min)) min = x; }
    return min && min < hoje ? min : hoje;
  };
  let de, ate = hoje;
  switch (preset) {
    case "7d":  de = somarDias(hoje, -7); break;
    case "15d": de = somarDias(hoje, -15); break;
    case "mes": de = inicioMesesAtras(hoje, 0); break;
    case "3m":  de = inicioMesesAtras(hoje, 2); break;
    case "6m":  de = inicioMesesAtras(hoje, 5); break;
    case "12m": de = inicioMesesAtras(hoje, 11); break;
    case "ano": de = `${hoje.slice(0, 4)}-01-01`; break;
    case "tudo": de = maisAntiga(); break;
    case PERSONALIZADO: {
      de = ehData(sel.de) ? sel.de : maisAntiga();
      ate = ehData(sel.ate) ? sel.ate : hoje;
      if (de > ate) [de, ate] = [ate, de];
      break;
    }
    default: return resolverPeriodo({ preset: "12m" }, { hoje, datas });
  }
  return { preset, de, ate, todo: preset === "tudo" };
}

/** A data (em qualquer formato aceito por `dataIso`) cai dentro do período? */
export const dentroDoPeriodo = (v, per) => {
  const d = dataIso(v);
  return !!d && !!per && d >= per.de && d <= per.ate;
};

export const filtrarPorPeriodo = (lista = [], per, getData) =>
  lista.filter(x => dentroDoPeriodo(getData(x), per));

/**
 * Janela imediatamente anterior, de mesma duração em dias — para os comparativos
 * (▲▼). "Todo o histórico" não tem anterior.
 */
export function periodoAnterior(per) {
  if (!per || per.todo) return null;
  const dias = diasEntre(per.de, per.ate) + 1;
  return { de: somarDias(per.de, -dias), ate: somarDias(per.de, -1) };
}

/** Chaves `YYYY-MM` de cada mês tocado pelo período; se passar de `max`, ficam os últimos. */
export function mesesDoPeriodo(per, max = 24) {
  if (!per) return [];
  const [y0, m0] = per.de.split("-").map(Number);
  const [y1, m1] = per.ate.split("-").map(Number);
  const total = (y1 - y0) * 12 + (m1 - m0) + 1;
  const n = Math.max(1, Math.min(total, max));
  return Array.from({ length: n }, (_, i) => inicioMesesAtras(per.ate, n - 1 - i).slice(0, 7));
}

/** Os `n` últimos meses até `hoje` (inclusive), sem o transbordo do fim de mês. */
export const ultimosMeses = (n, hoje = isoLocal()) =>
  Array.from({ length: n }, (_, i) => inicioMesesAtras(hoje, n - 1 - i).slice(0, 7));

const br = iso => iso.split("-").reverse().join("/");

export const rotuloPeriodo = per => (per ? `${br(per.de)} a ${br(per.ate)}` : "");
