// SAC — regras puras do atendimento ao consumidor (sem tela, testáveis).
//
// Espelha a "Nova Ficha SAC" (planilha que a recepção usava): atendimento,
// cliente com endereço, produto, relato, orientação dada no 1º contato,
// encaminhamento a um setor com o retorno dele, e encerramento com a solução
// aplicada. Por cima da ficha, o que um SGQ precisa: reação adversa com decisão
// sobre notificação, amostra do consumidor, avaliação técnica (procede ou não)
// e, quando é problema no produto, a investigação numa RNC — o SAC só guarda o
// vínculo, a análise de causa não é refeita aqui.
//
// ⚠️ As regras de gravação têm cópia no servidor (`server/sac.js`, CommonJS).
// Mudou uma lista ou um status aqui, confira lá.

// ── Listas da ficha (aba "Listas") ──

export const CANAIS_SAC = ["Telefone", "WhatsApp", "E-mail", "Site / Chat", "Redes sociais", "Marketplace", "Reclame Aqui"];

// Tipo de manifestação — escolhido por quem atende; a Qualidade pode corrigir.
// `investigar` = pode ser problema do produto (avaliação técnica, RNC);
// `vigilancia` = alguém passou mal (decisão sobre notificação);
// `simples` = a recepção pode finalizar sozinha, sem passar pela Qualidade.
export const CLASSIFICACOES_SAC = [
  { id: "Reclamação",        investigar: true,  dica: "Algo errado com o produto ou o serviço: defeito, cor/cheiro, embalagem, quantidade, entrega." },
  { id: "Reação adversa",    investigar: true,  vigilancia: true, dica: "Alguém passou mal ou teve reação depois de consumir o produto." },
  { id: "Troca / Devolução", investigar: false, dica: "Pedido de troca ou devolução." },
  { id: "Dúvida",            investigar: false, simples: true, dica: "Pergunta sobre uso, composição, onde comprar." },
  { id: "Sugestão",          investigar: false, simples: true, dica: "" },
  { id: "Elogio",            investigar: false, simples: true, dica: "" },
];
export const classificacaoSac = (id) => CLASSIFICACOES_SAC.find(c => c.id === id) || null;

export const SETORES_SAC = ["Qualidade / Regulatório", "Nutricionista", "Logística / Entregas", "Financeiro", "Comercial", "Marketing"];
export const SETOR_QUALIDADE = "Qualidade / Regulatório";

export const SOLUCOES_SAC = ["Orientação prestada", "Troca do produto", "Reembolso", "Reenvio", "Cupom / Crédito", "Improcedente", "Outra"];
// Soluções que mandam algo para a casa do consumidor: aí o endereço é obrigatório.
export const SOLUCOES_COM_ENDERECO = ["Troca do produto", "Reenvio"];

export const STATUS_SAC = { ABERTO: "Em aberto", ANDAMENTO: "Em andamento", FINALIZADO: "Finalizado" };
export const SAC_SMETA = {
  "Em aberto":    { c: "#4fc3f7", bg: "#4fc3f718", dica: "Registrado; ninguém agiu ainda" },
  "Em andamento": { c: "#ffd166", bg: "#ffd16618", dica: "Em tratamento: encaminhado, respondido ou em análise" },
  "Finalizado":   { c: "#2ab84a", bg: "#2ab84a18", dica: "Solução aplicada e atendimento encerrado" },
};
export const finalizado = (a) => a?.status === STATUS_SAC.FINALIZADO;

/** Primeiro ato depois do registro tira o atendimento de "Em aberto". */
export const comAndamento = (a) => (a.status === STATUS_SAC.ABERTO ? { ...a, status: STATUS_SAC.ANDAMENTO } : a);

// Meta interna para dar a resposta final ao consumidor (dias corridos do contato).
export const META_RESPOSTA_DIAS = 7;

// A partir de quantas reclamações no mesmo lote o sistema acende o alerta.
export const LIMITE_RECORRENCIA_LOTE = 3;

const hojeISO = () => new Date().toISOString().slice(0, 10);
const vazio = (v) => !String(v ?? "").trim();

export function diasEntre(deISO, ateISO = hojeISO()) {
  if (!deISO) return 0;
  const ms = new Date(String(ateISO).slice(0, 10) + "T12:00:00") - new Date(String(deISO).slice(0, 10) + "T12:00:00");
  return Math.max(0, Math.round(ms / 86400000));
}

/** Há quantos dias o atendimento está aberto e se passou da meta. Null se finalizado. */
export function prazoSac(a, hoje = hojeISO()) {
  if (!a || finalizado(a)) return null;
  const dias = diasEntre(a.dataContato || a.dataRegistro, hoje);
  return { dias, atrasado: dias > META_RESPOSTA_DIAS };
}

// ── Máscaras ──

export function mascaraDoc(v) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

export function mascaraCep(v) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// ── Endereço ──

const CAMPOS_ENDERECO = [
  ["consumidorCEP", "CEP"], ["consumidorLogradouro", "logradouro"], ["consumidorNumero", "número"],
  ["consumidorBairro", "bairro"], ["consumidorCidade", "cidade"], ["consumidorUF", "UF"],
];

/** Partes do endereço que faltam para mandar algo ao consumidor. */
export function faltasEndereco(a = {}) {
  return CAMPOS_ENDERECO
    .filter(([k]) => (k === "consumidorCEP" ? String(a[k] || "").replace(/\D/g, "").length !== 8 : vazio(a[k])))
    .map(([, l]) => l);
}

export function enderecoTexto(a = {}) {
  const linha1 = [a.consumidorLogradouro, a.consumidorNumero].filter(Boolean).join(", ");
  const linha2 = [a.consumidorComplemento, a.consumidorBairro].filter(Boolean).join(" · ");
  const linha3 = [[a.consumidorCidade, a.consumidorUF].filter(Boolean).join(" / "), a.consumidorCEP && `CEP ${a.consumidorCEP}`].filter(Boolean).join(" · ");
  return [linha1, linha2, linha3, a.consumidorReferencia && `Ref.: ${a.consumidorReferencia}`].filter(Boolean).join("\n");
}

// ── Lote e reação ──

/** Lote normalizado: "L-2025/001 " e "l2025001" são o mesmo lote. */
export const normLote = (l) => String(l || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

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

/** O consumidor relatou que alguém passou mal — vira prioridade. */
export const relatouReacao = (a) => a?.teveReacao === "Sim";

// ── Encaminhamento a setor ──

export function novoEncaminhamento({ setor, data, motivo }, user, agora = new Date()) {
  return {
    id: `e-${agora.getTime()}`,
    setor,
    data: data || hojeISO(),
    motivo: String(motivo || "").trim(),
    por: user?.name || "—",
    em: agora.toISOString(),
    retorno: null,
  };
}

/** O retorno do setor entra uma vez; o encaminhamento em si não muda. */
export function comRetorno(enc, { texto, data }, user, agora = new Date()) {
  return { ...enc, retorno: { texto: String(texto || "").trim(), data: data || hojeISO(), por: user?.name || "—", em: agora.toISOString() } };
}

// Para a Qualidade, a avaliação técnica registrada já é o retorno dela.
export const retornosPendentes = (a) => (a?.encaminhamentos || [])
  .filter(e => !e.retorno && !(e.setor === SETOR_QUALIDADE && a?.avaliacao?.resultado));
export const encaminhadoQualidade = (a) => (a?.encaminhamentos || []).some(e => e.setor === SETOR_QUALIDADE);

/** Avaliação técnica (procede ou não) é obrigatória: reação adversa, ou quando foi para a Qualidade. */
export const exigeAvaliacao = (a) => !!classificacaoSac(a?.classificacao)?.vigilancia || encaminhadoQualidade(a);

/**
 * A recepção finaliza sozinha só o que não precisa da Qualidade: dúvida,
 * sugestão ou elogio, sem reação relatada e sem passar pela Qualidade.
 */
export const podeFinalizarNaRecepcao = (a) =>
  !!classificacaoSac(a?.classificacao)?.simples && !relatouReacao(a) && !encaminhadoQualidade(a);

// ── Registro ──

/** Campos obrigatórios do registro (os "*" da ficha). Devolve { campo: mensagem }. */
export function errosDoRegistro(f) {
  const e = {};
  if (!f.classificacao) e.classificacao = "Escolha o tipo de manifestação.";
  if (vazio(f.consumidorNome)) e.consumidorNome = "Informe o nome completo.";
  if (String(f.consumidorTelefone || "").replace(/\D/g, "").length < 10) e.consumidorTelefone = "Informe telefone ou WhatsApp com DDD.";
  if (vazio(f.consumidorCidade)) e.consumidorCidade = "Informe a cidade.";
  if (vazio(f.consumidorUF)) e.consumidorUF = "Informe a UF.";
  if (!vazio(f.consumidorCEP) && String(f.consumidorCEP).replace(/\D/g, "").length !== 8) e.consumidorCEP = "CEP com 8 dígitos.";
  if (vazio(f.produto)) e.produto = "Informe o suplemento.";
  if (vazio(f.relato)) e.relato = "Descreva o que o cliente relatou.";
  if (f.teveReacao === "Sim" && vazio(f.reacaoDesc)) e.reacaoDesc = "Descreva o que a pessoa sentiu.";
  if (f.encaminhar === "Sim" && !f.setor) e.setor = "Escolha o setor.";
  if (f.finalizarAgora) {
    if (vazio(f.orientacao)) e.orientacao = "Para finalizar no contato, registre a orientação dada.";
    if (!f.solucao) e.solucao = "Escolha a solução aplicada.";
  }
  return e;
}

/** Resposta/orientação dada ao consumidor — registro que não se altera depois de gravado. */
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

// ── Encerramento ──

/** O que impede finalizar. Lista vazia = pode. Avisos vêm de `avisosDoEncerramento`. */
export function errosDoEncerramento(a, { solucao, detalhe } = {}) {
  const e = [];
  if (!a?.classificacao) e.push("Escolha o tipo de manifestação.");
  if (!(a?.respostas || []).length) e.push("Registre a orientação ou resposta dada ao cliente.");
  if (exigeAvaliacao(a) && !a?.avaliacao?.resultado)
    e.push("Registre a avaliação técnica (procedente, improcedente ou inconclusiva).");
  if (classificacaoSac(a?.classificacao)?.vigilancia && !a?.notificacaoVigilancia?.decisao)
    e.push("Registre se a reação adversa foi notificada à vigilância sanitária.");
  if (!solucao) e.push("Escolha a solução aplicada.");
  if (solucao === "Outra" && vazio(detalhe)) e.push("Descreva a solução (\"Outra\").");
  if (SOLUCOES_COM_ENDERECO.includes(solucao)) {
    const f = faltasEndereco(a);
    if (f.length) e.push(`${solucao} precisa do endereço completo — falta: ${f.join(", ")}.`);
  }
  return e;
}

/** Situações que merecem atenção antes de finalizar, mas não travam. */
export function avisosDoEncerramento(a, rncVinculada) {
  const av = [];
  if (rncVinculada && !["Eficaz", "Ineficaz", "Encerrada"].includes(rncVinculada.status))
    av.push(`A ${rncVinculada.num} ainda está em tratamento (${rncVinculada.status}). O atendimento pode ser finalizado e a RNC segue o próprio fluxo.`);
  if (etapaAmostra(a) === "aguardando")
    av.push(`Amostra pedida ao cliente em ${String(a.amostra.solicitada.em || "").slice(0, 10)} ainda não chegou.`);
  retornosPendentes(a).forEach(enc => av.push(`Sem retorno do setor ${enc.setor} (encaminhado em ${enc.data}).`));
  if (a?.avaliacao?.resultado === "Procedente" && !a?.rncId)
    av.push("Reclamação procedente sem RNC. Confirme que não precisa de investigação formal.");
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

// ── Amostra do consumidor e avaliação técnica ──

export const RESULTADOS_AVALIACAO = [
  { id: "Procedente",   dica: "Confirmado defeito ou desvio no produto." },
  { id: "Improcedente", dica: "Produto conforme; a causa não foi o produto (uso, armazenamento, expectativa)." },
  { id: "Inconclusiva", dica: "Não foi possível confirmar nem descartar (sem amostra, amostra insuficiente)." },
];

export function etapaAmostra(a) {
  if (a?.amostra?.recebida) return "recebida";
  if (a?.amostra?.solicitada) return "aguardando";
  return "nao_solicitada";
}

export function errosDaAvaliacao(av = {}) {
  const e = [];
  if (!RESULTADOS_AVALIACAO.some(r => r.id === av.resultado)) e.push("Escolha o resultado da avaliação.");
  if (vazio(av.parecer)) e.push("Escreva o parecer técnico.");
  return e;
}

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

// ── Indicadores ──

export const dataRefSac = a => String(a?.dataContato || a?.dataRegistro || "").slice(0, 10);

export function diasPrimeiraResposta(a) {
  const r = (a?.respostas || [])[0];
  return r ? diasEntre(dataRefSac(a), r.data || String(r.em || "").slice(0, 10)) : null;
}

export function diasAteEncerrar(a) {
  return finalizado(a) && a.encerradoEm ? diasEntre(dataRefSac(a), a.encerradoEm) : null;
}

export function mediana(nums = []) {
  if (!nums.length) return null;
  const s = [...nums].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2 * 10) / 10;
}

const pct = (n, d) => (d > 0 ? Math.round(n / d * 100) : null);

export function kpisSac(lista = []) {
  const avaliadas = lista.filter(a => a.avaliacao?.resultado);
  const procedentes = avaliadas.filter(a => a.avaliacao.resultado === "Procedente").length;
  const primeiras = lista.map(diasPrimeiraResposta).filter(x => x !== null);
  const noPrazo = primeiras.filter(x => x <= META_RESPOSTA_DIAS).length;
  const encerramentos = lista.map(diasAteEncerrar).filter(x => x !== null);
  return {
    total: lista.length,
    reclamacoes: lista.filter(a => a.classificacao === "Reclamação").length,
    reacoesAdversas: lista.filter(a => a.classificacao === "Reação adversa").length,
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

/** Setores para onde os atendimentos foram encaminhados (um atendimento conta uma vez por setor). */
export function contarSetores(lista = []) {
  const m = new Map();
  for (const a of lista) {
    for (const s of new Set((a.encaminhamentos || []).map(e => e.setor))) m.set(s, (m.get(s) || 0) + 1);
  }
  return [...m.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((x, y) => y.qtd - x.qtd);
}

/** Lotes citados em mais de um atendimento — o sinal de problema no lote. */
export function lotesRecorrentes(lista = [], minimo = 2) {
  const m = new Map();
  for (const a of lista) {
    const k = normLote(a.lote);
    if (!k) continue;
    if (!m.has(k)) m.set(k, { lote: String(a.lote).toUpperCase(), produto: a.produto || "", qtd: 0, procedentes: 0, nums: [] });
    const g = m.get(k);
    g.qtd += 1;
    g.nums.push(a.num);
    if (a.avaliacao?.resultado === "Procedente") g.procedentes += 1;
  }
  return [...m.values()].filter(g => g.qtd >= minimo).sort((x, y) => y.qtd - x.qtd);
}

/** Linhas mensais com a contagem por tipo de manifestação. */
export function porMesClassificacao(lista = [], meses = []) {
  return meses.map(mes => {
    const doMes = lista.filter(a => dataRefSac(a).startsWith(mes));
    const linha = { mes, total: doMes.length };
    CLASSIFICACOES_SAC.forEach(c => { linha[c.id] = 0; });
    doMes.forEach(a => { if (a.classificacao) linha[a.classificacao] = (linha[a.classificacao] || 0) + 1; });
    return linha;
  });
}
