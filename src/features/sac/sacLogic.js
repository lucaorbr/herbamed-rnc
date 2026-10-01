// SAC — regras puras do atendimento ao consumidor (sem tela, testáveis).
//
// O SAC é a PORTA DE ENTRADA da reclamação: registra, classifica e responde ao
// consumidor. Quando o problema é de qualidade do produto, a investigação não se
// faz aqui — abre-se uma RNC (5 Porquês, CAPA, eficácia), como os Desvios já fazem.
// O atendimento só guarda o vínculo com ela.

export const CANAIS_SAC = ["Telefone", "WhatsApp", "E-mail", "Site", "Redes sociais", "Reclame Aqui", "Pessoalmente", "Outro"];

// Classificação feita pela Qualidade na triagem. `investigar` = é problema do
// produto e pode virar RNC; `vigilancia` = suplemento que fez mal a alguém.
export const CLASSIFICACOES_SAC = [
  { id: "Dúvida",          investigar: false, dica: "Pergunta sobre uso, composição, onde comprar." },
  { id: "Elogio",          investigar: false, dica: "" },
  { id: "Sugestão",        investigar: false, dica: "" },
  { id: "Comercial",       investigar: false, dica: "Entrega, preço, troca sem defeito — não é qualidade do produto." },
  { id: "Queixa técnica",  investigar: true,  dica: "Defeito no produto: cápsula quebrada, cor/cheiro diferente, corpo estranho, embalagem violada, quantidade errada." },
  { id: "Evento adverso",  investigar: true,  vigilancia: true, dica: "Alguém passou mal ou teve reação após consumir o produto." },
];

export const classificacaoSac = (id) => CLASSIFICACOES_SAC.find(c => c.id === id) || null;

export const SAC_SMETA = {
  "Aberto":     { c: "#4fc3f7", bg: "#4fc3f718", dica: "Aguardando a Qualidade classificar" },
  "Em análise": { c: "#ffd166", bg: "#ffd16618", dica: "Classificado; falta responder o consumidor ou concluir a investigação" },
  "Encerrado":  { c: "#2ab84a", bg: "#2ab84a18", dica: "Consumidor respondido e atendimento concluído" },
};

// Meta interna para dar a resposta final ao consumidor (dias corridos do contato).
export const META_RESPOSTA_DIAS = 7;

// A partir de quantas reclamações no mesmo lote o sistema acende o alerta.
export const LIMITE_RECORRENCIA_LOTE = 3;

const hojeISO = () => new Date().toISOString().slice(0, 10);

export function diasEntre(deISO, ateISO = hojeISO()) {
  if (!deISO) return 0;
  const ms = new Date(ateISO + "T12:00:00") - new Date(String(deISO).slice(0, 10) + "T12:00:00");
  return Math.max(0, Math.round(ms / 86400000));
}

/** Há quantos dias o atendimento está aberto e se passou da meta. Null se encerrado. */
export function prazoSac(a, hoje = hojeISO()) {
  if (!a || a.status === "Encerrado") return null;
  const dias = diasEntre(a.dataContato || a.dataRegistro, hoje);
  return { dias, atrasado: dias > META_RESPOSTA_DIAS };
}

/** Lote normalizado: "L-2025/001 " e "l2025001" são o mesmo lote. */
export const normLote = (l) => String(l || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Quantos atendimentos citam cada lote (chave normalizada). */
export function contagemPorLote(atendimentos = []) {
  const m = new Map();
  for (const a of atendimentos) {
    const k = normLote(a?.lote);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/** Outros atendimentos do mesmo lote (sem o próprio), mais recentes primeiro. */
export function mesmoLote(a, atendimentos = []) {
  const k = normLote(a?.lote);
  if (!k) return [];
  return atendimentos
    .filter(x => x.id !== a.id && normLote(x.lote) === k)
    .sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
}

/** O consumidor relatou que alguém passou mal — vira prioridade na triagem. */
export const relatouReacao = (a) => a?.teveReacao === "Sim";

/** Campos obrigatórios do registro (quem atende). Devolve { campo: mensagem }. */
export function errosDoRegistro(f) {
  const e = {};
  if (!String(f.consumidorNome || "").trim()) e.consumidorNome = "Informe o nome de quem entrou em contato.";
  if (!String(f.consumidorTelefone || "").trim() && !String(f.consumidorEmail || "").trim())
    e.consumidorTelefone = "Informe ao menos um telefone ou e-mail para dar o retorno.";
  if (!String(f.produto || "").trim()) e.produto = "Informe o produto.";
  if (!String(f.relato || "").trim()) e.relato = "Descreva o que o consumidor relatou.";
  if (f.teveReacao === "Sim" && !String(f.reacaoDesc || "").trim()) e.reacaoDesc = "Descreva o que a pessoa sentiu.";
  return e;
}

/** Resposta dada ao consumidor — registro que não se altera depois de gravado. */
export function novaResposta({ data, meio, texto }, user, agora = new Date()) {
  return {
    id: `r-${agora.getTime()}`,
    data: data || hojeISO(),
    meio: meio || "Telefone",
    texto: String(texto || "").trim(),
    por: user?.name || "—",
    em: agora.toISOString(),
  };
}

/**
 * O que impede o encerramento. Lista vazia = pode encerrar.
 * Avisos (não bloqueiam) vêm de `avisosDoEncerramento`.
 */
export function errosDoEncerramento(a, conclusao) {
  const e = [];
  if (!a?.classificacao) e.push("Classifique o atendimento.");
  if (!(a?.respostas || []).length) e.push("Registre a resposta dada ao consumidor.");
  if (classificacaoSac(a?.classificacao)?.investigar && !a?.avaliacao?.resultado)
    e.push("Registre a avaliação técnica (procedente, improcedente ou inconclusiva).");
  if (classificacaoSac(a?.classificacao)?.vigilancia && !a?.notificacaoVigilancia?.decisao)
    e.push("Registre se o evento adverso foi notificado à vigilância sanitária.");
  if (!String(conclusao || "").trim()) e.push("Escreva a conclusão do atendimento.");
  return e;
}

/** Situações que merecem atenção antes de encerrar, mas não travam. */
export function avisosDoEncerramento(a, rncVinculada) {
  const av = [];
  if (rncVinculada && !["Eficaz", "Ineficaz", "Encerrada"].includes(rncVinculada.status))
    av.push(`A ${rncVinculada.num} ainda está em tratamento (${rncVinculada.status}). O atendimento pode ser encerrado e a RNC segue o próprio fluxo.`);
  if (etapaAmostra(a) === "aguardando")
    av.push(`Amostra pedida ao consumidor em ${String(a.amostra.solicitada.em || "").slice(0, 10)} ainda não chegou.`);
  if (classificacaoSac(a?.classificacao)?.investigar && !a?.rncId)
    av.push("Queixa técnica encerrada sem RNC. Confirme que a análise não precisa de investigação formal.");
  return av;
}

/** Texto da RNC aberta a partir do atendimento. */
export function descParaRNC(a) {
  const partes = [
    `Reclamação de consumidor recebida pelo SAC (${a.num}) em ${a.dataContato || "—"}, via ${a.canal || "—"}.`,
    "",
    `Relato: ${String(a.relato || "").trim()}`,
  ];
  if (relatouReacao(a)) partes.push("", `Reação relatada após o consumo: ${String(a.reacaoDesc || "").trim()}`);
  if (a.localCompra) partes.push("", `Local de compra: ${a.localCompra}`);
  if (a.validade) partes.push(`Validade informada: ${a.validade}`);
  if (a.temAmostra) partes.push(`Consumidor ainda tem o produto: ${a.temAmostra}`);
  return partes.join("\n");
}

/** Entrada de histórico no padrão do sistema. */
export function entradaHistorico(acao, user, detalhes, agora = new Date()) {
  const h = { data: agora.toISOString().slice(0, 10), hora: agora.toLocaleTimeString("pt-BR"), acao, resp: user?.name || "—" };
  if (detalhes?.length) h.detalhes = detalhes;
  return h;
}

// ── Fase 2: amostra do consumidor e avaliação técnica ──

// Resultado da avaliação da Qualidade: a reclamação tinha fundamento?
export const RESULTADOS_AVALIACAO = [
  { id: "Procedente",   dica: "Confirmado defeito ou desvio no produto." },
  { id: "Improcedente", dica: "Produto conforme; a causa não foi o produto (uso, armazenamento, expectativa)." },
  { id: "Inconclusiva", dica: "Não foi possível confirmar nem descartar (sem amostra, amostra insuficiente)." },
];

/** Em que ponto está a amostra do consumidor. */
export function etapaAmostra(a) {
  if (a?.amostra?.recebida) return "recebida";
  if (a?.amostra?.solicitada) return "aguardando";
  return "nao_solicitada";
}

export function errosDaAvaliacao(av = {}) {
  const e = [];
  if (!RESULTADOS_AVALIACAO.some(r => r.id === av.resultado)) e.push("Escolha o resultado da avaliação.");
  if (!String(av.parecer || "").trim()) e.push("Escreva o parecer técnico.");
  return e;
}

/** Avaliação técnica — registro que não se altera depois de gravado. */
export function novaAvaliacao({ resultado, parecer, amostraConsumidor, amostraRetencao, anexos = [] }, user, agora = new Date()) {
  return {
    resultado,
    parecer: String(parecer || "").trim(),
    amostraConsumidor: amostraConsumidor || "Não",
    amostraRetencao: amostraRetencao || "Não",
    anexos,
    por: user?.name || "—",
    em: agora.toISOString(),
  };
}

// ── Fase 3: indicadores ──

export const dataRefSac = a => String(a?.dataContato || a?.dataRegistro || "").slice(0, 10);

/** Dias do contato até a primeira resposta ao consumidor (null se ainda sem resposta). */
export function diasPrimeiraResposta(a) {
  const r = (a?.respostas || [])[0];
  return r ? diasEntre(dataRefSac(a), r.data || String(r.em || "").slice(0, 10)) : null;
}

/** Dias do contato até o encerramento (null se aberto). */
export function diasAteEncerrar(a) {
  return a?.status === "Encerrado" && a.encerradoEm ? diasEntre(dataRefSac(a), a.encerradoEm) : null;
}

export function mediana(nums = []) {
  if (!nums.length) return null;
  const s = [...nums].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2 * 10) / 10;
}

const pct = (n, d) => (d > 0 ? Math.round(n / d * 100) : null);

export function kpisSac(lista = []) {
  const total = lista.length;
  const queixas = lista.filter(a => a.classificacao === "Queixa técnica").length;
  const eventos = lista.filter(a => a.classificacao === "Evento adverso").length;
  const avaliadas = lista.filter(a => a.avaliacao?.resultado);
  const procedentes = avaliadas.filter(a => a.avaliacao.resultado === "Procedente").length;
  const primeiras = lista.map(diasPrimeiraResposta).filter(x => x !== null);
  const noPrazo = primeiras.filter(x => x <= META_RESPOSTA_DIAS).length;
  const encerramentos = lista.map(diasAteEncerrar).filter(x => x !== null);
  return {
    total, queixas, eventos,
    reacoes: lista.filter(relatouReacao).length,
    avaliadas: avaliadas.length, procedentes,
    taxaProcedencia: pct(procedentes, avaliadas.length),
    respondidos: primeiras.length,
    taxaNoPrazo: pct(noPrazo, primeiras.length),
    medianaResposta: mediana(primeiras),
    medianaEncerramento: mediana(encerramentos),
    comRnc: lista.filter(a => a.rncId).length,
  };
}

/** Contagem por um campo, maior primeiro. `rotulo` vazio vira "Não informado". */
export function contarPor(lista = [], rotulo) {
  const m = new Map();
  for (const a of lista) {
    const k = String(rotulo(a) || "").trim() || "Não informado";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((x, y) => y.qtd - x.qtd || x.nome.localeCompare(y.nome, "pt-BR"));
}

/** Lotes citados em mais de um atendimento — o sinal de problema no lote. */
export function lotesRecorrentes(lista = [], minimo = 2) {
  const m = new Map();
  for (const a of lista) {
    const k = normLote(a.lote);
    if (!k) continue;
    if (!m.has(k)) m.set(k, { lote: a.lote, produto: a.produto || "", qtd: 0, procedentes: 0, nums: [] });
    const g = m.get(k);
    g.qtd += 1;
    g.nums.push(a.num);
    if (a.avaliacao?.resultado === "Procedente") g.procedentes += 1;
  }
  return [...m.values()].filter(g => g.qtd >= minimo).sort((x, y) => y.qtd - x.qtd);
}

/** Linhas mensais com a contagem por classificação (sem classificação = "A classificar"). */
export function porMesClassificacao(lista = [], meses = []) {
  return meses.map(mes => {
    const doMes = lista.filter(a => dataRefSac(a).startsWith(mes));
    const linha = { mes, total: doMes.length, "A classificar": 0 };
    CLASSIFICACOES_SAC.forEach(c => { linha[c.id] = 0; });
    doMes.forEach(a => { linha[a.classificacao || "A classificar"] = (linha[a.classificacao || "A classificar"] || 0) + 1; });
    return linha;
  });
}
