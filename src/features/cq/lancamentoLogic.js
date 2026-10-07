// Lançamento de resultados do CQ pelo teclado e resumo da barra fixa — regras puras,
// testadas em lancamentoLogic.test.js.

// Paradas de foco de cada ensaio, na ordem do lançamento: o valor ("res") e depois a
// conformidade ("conf"). Ensaio do tipo "conforme" não tem valor a digitar — só a conformidade.
export function paradasDoEnsaio(r) {
  return r?.tipo === "conforme" ? ["conf"] : ["res", "conf"];
}

// Próxima (passo = 1) ou anterior (passo = -1) parada a partir de { idx, campo }.
// Devolve null quando sai da tabela (antes do primeiro ensaio ou depois do último).
export function proximaParada(resultados, idx, campo, passo = 1) {
  const todas = [];
  (resultados || []).forEach((r, i) => paradasDoEnsaio(r).forEach(c => todas.push({ idx: i, campo: c })));
  const atual = todas.findIndex(p => p.idx === idx && p.campo === campo);
  if (atual < 0) return null;
  return todas[atual + passo] || null;
}

// Tecla → conformidade. undefined = tecla não é de conformidade.
export function conformidadeDaTecla(key) {
  const k = String(key || "").toLowerCase();
  if (k === "c" || k === "+") return true;
  if (k === "n" || k === "-") return false;
  if (k === "backspace" || k === "delete") return null;
  return undefined;
}

const lancado = (r) => String(r?.resultado ?? "").trim() !== "" || r?.conforme === true || r?.conforme === false;

// Resumo para a barra fixa: quantos ensaios foram lançados, conformes, não conformes e
// quantos ainda estão sem nada. Mesma noção de "pendente" do salvar (sem valor e sem conformidade).
export function resumoResultados(resultados) {
  const lista = resultados || [];
  return {
    total: lista.length,
    lancados: lista.filter(lancado).length,
    conformes: lista.filter(r => r.conforme === true).length,
    naoConformes: lista.filter(r => r.conforme === false).length,
    pendentes: lista.filter(r => !lancado(r)).length,
  };
}
