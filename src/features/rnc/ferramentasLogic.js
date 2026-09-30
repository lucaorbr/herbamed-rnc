// Regras das ferramentas de tratamento da RNC (Ishikawa/5 Porquês, CAPA, Eficácia).
// Puras e testáveis: a tela só chama e mostra o resultado.
import { rncAtiva } from "../../core/status";

export const MIN_PORQUES = 3;

const cheio = v => typeof v === "string" && v.trim() !== "";
const concluida = a => a.status === "Concluída";
const fechada = a => a.status === "Concluída" || a.status === "Cancelada";

/** Quantos dos 5 porquês estão preenchidos. */
export function porquesPreenchidos(r) {
  return (r?.ishikawa?.whys || []).filter(cheio).length;
}

/**
 * RNC encerrada (Eficaz, Ineficaz, Encerrada) é registro fechado: as ferramentas
 * não a listam nem a alteram. Reabrir é outro fluxo, não edição por baixo.
 */
export function rncEditavelNasFerramentas(r) {
  return !!r && rncAtiva(r.status);
}

/** Ações que ainda contam (nem concluídas nem canceladas) precisam de o quê, quem e quando. */
export function errosDasAcoesCapa(acts) {
  const erros = [];
  (acts || []).forEach((a, i) => {
    if (fechada(a)) return;
    const faltam = [];
    if (!cheio(a.what)) faltam.push("o quê");
    if (!cheio(a.who)) faltam.push("quem");
    if (!a.when) faltam.push("quando");
    if (faltam.length) erros.push(`Ação #${i + 1}: falta ${faltam.join(", ")}.`);
  });
  return erros;
}

/** Prazo geral da ação corretiva = o prazo mais tardio entre as ações ainda ativas. */
export function prazoGeralCapa(acts) {
  return (acts || []).filter(a => !fechada(a) && a.when).map(a => a.when).sort().at(-1) || "";
}

/**
 * A versão gravada de uma ação. Ação antiga pode não ter `id` (comparar `undefined ===
 * undefined` casava todas com a primeira): essas casam pela posição — não se removem
 * (acaoRemovivel) e as novas vão sempre para o fim, então a posição não muda.
 */
export function acaoAnterior(anteriores, a, i) {
  if (a?.id == null) return (anteriores || [])[i]?.id == null ? (anteriores || [])[i] : undefined;
  return (anteriores || []).find(x => x.id === a.id);
}

/**
 * Um único patch para salvar a CAPA. Antes eram duas gravações seguidas e a segunda
 * partia do histórico antigo, apagando a entrada que a primeira acabara de gravar.
 */
export function patchSalvarCapa(r, acts, autor, data) {
  const anteriores = r.w2h || [];
  const prazo = prazoGeralCapa(acts);
  const prorrogadas = acts
    .map((a, i) => [a, acaoAnterior(anteriores, a, i)])
    .filter(([a, ant]) => ant?.when && a.when && ant.when !== a.when)
    .map(([a, ant]) => `Ação "${a.what || a.id}": prazo ${ant.when} → ${a.when}`);
  const historico = [
    ...(r.historico || []),
    { data, acao: `CAPA — ${acts.length} ação(ões)`, detalhes: resumoCapa(anteriores, acts), resp: autor, tipo: "capa" },
    { data, acao: "Prazo geral calculado pelas ações CAPA", detalhes: [`Prazo calculado: ${prazo || "—"}`, ...prorrogadas], resp: autor, tipo: "prazo_capa" },
  ];
  return { w2h: acts, prazoAC: prazo, modoPrazo: "definido", justificativaPrazo: "", proximaReavaliacao: "", historico };
}

const rotuloAcao = a => `"${(a.what || "").trim() || a.id}"`;

/**
 * O que mudou no plano CAPA, para o histórico da RNC: ações incluídas, removidas,
 * mudanças de status e evidências anexadas. Antes a entrada dizia só "CAPA — n ação(ões)".
 */
export function resumoCapa(anteriores, acts) {
  const d = [];
  const antes = anteriores || [];
  (acts || []).forEach((a, i) => {
    const ant = acaoAnterior(antes, a, i);
    if (!ant) { d.push(`Ação incluída: ${rotuloAcao(a)} (${a.tipo || "Corretiva"}, ${a.who || "sem responsável"})`); return; }
    if ((ant.status || "Pendente") !== (a.status || "Pendente")) d.push(`Ação ${rotuloAcao(a)}: ${ant.status || "Pendente"} → ${a.status || "Pendente"}`);
    const evA = (ant.evidencias || []).length, evD = (a.evidencias || []).length;
    if (evD > evA) d.push(`Ação ${rotuloAcao(a)}: ${evD - evA} evidência(s) anexada(s)`);
  });
  antes.filter(x => x.id != null && !(acts || []).some(a => a.id === x.id)).forEach(x => d.push(`Ação removida: ${rotuloAcao(x)}`));
  return d;
}

/**
 * Ação já gravada na RNC não se remove: cancela-se (status "Cancelada") e o registro do
 * que foi planejado fica. Só a ação ainda não salva pode ser apagada.
 */
export function acaoRemovivel(r, acao) {
  if (acao?.id == null) return false; // ação antiga sem id: já estava gravada
  return !(r?.w2h || []).some(x => x.id === acao.id);
}

const proximoPrazoCapa = r => (r?.w2h || []).filter(a => !fechada(a) && a.when).map(a => a.when).sort()[0] || "";

/**
 * RNCs ativas com análise de causa completa e plano CAPA por fazer (sem nenhuma ação ou
 * com ação em aberto) — a fila da etapa 4. RNC ainda sem plano vem primeiro (é a que está
 * parada); as demais pelo prazo mais próximo entre as ações em aberto.
 */
export function filaCapa(rncs) {
  const causaOk = r => porquesPreenchidos(r) >= MIN_PORQUES && cheio(r?.ishikawa?.root);
  const chave = r => !(r.w2h || []).length ? "0000" : (proximoPrazoCapa(r) || "9999");
  return (rncs || [])
    .filter(r => rncAtiva(r.status) && causaOk(r) && (!(r.w2h || []).length || r.w2h.some(a => !fechada(a))))
    .sort((a, b) => chave(a) < chave(b) ? -1 : chave(a) > chave(b) ? 1 : 0);
}

/** Resumo das ações de uma RNC. Vencida = em aberto com prazo antes de `hoje`. */
export function contagemCapa(r, hoje) {
  const acts = r?.w2h || [];
  const abertas = acts.filter(a => !fechada(a));
  return {
    total: acts.length,
    concluidas: acts.filter(concluida).length,
    abertas: abertas.length,
    vencidas: abertas.filter(a => a.when && a.when < hoje).length,
    proximoPrazo: proximoPrazoCapa(r),
  };
}

/**
 * Pode registrar este resultado de eficácia? Devolve { ok, motivos[] }.
 * "Pendente verificação" sempre pode (é só agendar). Eficaz/Ineficaz fecham a RNC e
 * exigem o ciclo completo: causa raiz com 5 Porquês, ao menos uma ação CAPA concluída
 * e nenhuma ação em aberto. Eficaz de RNC com material exige também a disposição.
 * Antes, RNC sem nenhuma ação passava: a trava só olhava ações pendentes.
 */
export function podeRegistrarEficacia(r, resultado) {
  const motivos = [];
  if (resultado !== "Eficaz" && resultado !== "Ineficaz") return { ok: true, motivos };
  if (porquesPreenchidos(r) < MIN_PORQUES) motivos.push(`Preencha ao menos ${MIN_PORQUES} dos 5 Porquês (análise de causa).`);
  if (!cheio(r?.ishikawa?.root)) motivos.push("Registre a causa raiz identificada.");
  const acts = r?.w2h || [];
  if (!acts.some(concluida)) motivos.push("É preciso ao menos uma ação CAPA concluída.");
  const abertas = acts.filter(a => !fechada(a));
  if (abertas.length) motivos.push(`Há ${abertas.length} ação(ões) CAPA ainda em aberto.`);
  return { ok: motivos.length === 0, motivos };
}

// A RNC "toca material/lote" quando o tipo é de material OU quando há produto/lote
// preenchido. Só nesses casos a disposição é obrigatória antes de encerrar como Eficaz.
const TIPOS_MATERIAL = ["Matéria-prima", "Material de embalagem", "Insumo", "Produto acabado"];
export function rncTemMaterial(r) {
  return !!(r && (TIPOS_MATERIAL.includes(r.tipo) || (r.lote || "").trim() || (r.produto || "").trim()));
}

/**
 * As etapas da ficha da RNC, em ordem, com o estado de cada uma — o que a barra de abas
 * mostra. Estados: "concluida", "atual" (a próxima a fazer), "pendente", "bloqueada"
 * (com `motivo`) e "dispensada" (RNC encerrada por disposição, sem ciclo de eficácia).
 * As travas são as mesmas das ferramentas: aqui elas só ficam visíveis.
 */
export const ETAPAS = [
  { id: "registro", label: "Registro" },
  { id: "contencao", label: "Contenção e disposição" },
  { id: "causa", label: "Análise de causa" },
  { id: "capa", label: "Plano CAPA" },
  { id: "eficacia", label: "Eficácia" },
];

export function etapasDaRnc(r) {
  const acts = r?.w2h || [];
  const causaOk = porquesPreenchidos(r) >= MIN_PORQUES && cheio(r?.ishikawa?.root);
  const precisaDisposicao = rncTemMaterial(r) && !r?.disposicao?.decisao;
  const feito = {
    registro: cheio(r?.desc),
    contencao: cheio(r?.contencao) && !precisaDisposicao,
    causa: causaOk,
    capa: acts.some(concluida) && !acts.some(a => !fechada(a)),
    eficacia: r?.status === "Eficaz" || r?.status === "Ineficaz",
  };
  const bloqueio = {
    capa: causaOk ? null : `Precisa da causa raiz com ao menos ${MIN_PORQUES} porquês.`,
    eficacia: podeRegistrarEficacia(r, "Eficaz").ok ? null : "Conclua o plano CAPA antes de verificar a eficácia.",
  };
  const encerradaPorDisposicao = r?.status === "Encerrada";
  let atualMarcada = false;
  return ETAPAS.map(e => {
    if (feito[e.id]) return { ...e, estado: "concluida" };
    if (encerradaPorDisposicao && (e.id === "capa" || e.id === "eficacia")) {
      return { ...e, estado: "dispensada", motivo: "RNC encerrada por disposição do material." };
    }
    if (bloqueio[e.id]) return { ...e, estado: "bloqueada", motivo: bloqueio[e.id] };
    if (!atualMarcada && rncAtiva(r?.status)) { atualMarcada = true; return { ...e, estado: "atual" }; }
    return { ...e, estado: "pendente" };
  });
}

const CATS_ISHIKAWA = ["mao", "maquina", "metodo", "material", "medicao", "meioamb"];
const totalCausas = ishi => CATS_ISHIKAWA.reduce((n, k) => n + (ishi?.causes?.[k]?.length || 0), 0);

/**
 * O que mudou numa gravação da análise de causa, para o histórico da RNC. O Ishikawa
 * e os 5 Porquês salvam juntos (antes eram dois botões e duas entradas sem detalhe).
 * Troca de causa raiz registra o texto anterior — com plano CAPA já montado sobre ela,
 * isso é informação que a auditoria vai querer.
 */
export function resumoAnaliseCausa(antes, depois) {
  const d = [];
  const nA = totalCausas(antes), nD = totalCausas(depois);
  if (nA !== nD) d.push(`Ishikawa: ${nA} → ${nD} causa(s) levantada(s)`);
  const pA = (antes?.whys || []).filter(cheio).length, pD = (depois?.whys || []).filter(cheio).length;
  const porquesMudaram = JSON.stringify(antes?.whys || []) !== JSON.stringify(depois?.whys || []);
  if (porquesMudaram) d.push(`5 Porquês: ${pD} de 5 preenchido(s)${pA !== pD ? ` (antes ${pA})` : ""}`);
  const rA = (antes?.root || "").trim(), rD = (depois?.root || "").trim();
  if (rA !== rD) d.push(rA ? `Causa raiz alterada — antes: "${rA}"` : "Causa raiz definida");
  if ((antes?.whyCausa || "") !== (depois?.whyCausa || "") && depois?.whyCausa) d.push(`Causa aprofundada: ${depois.whyCausa}`);
  return d;
}

/** RNCs ativas que ainda não têm análise de causa completa — a fila da etapa 3. */
export function filaAnaliseCausa(rncs) {
  return (rncs || [])
    .filter(r => rncAtiva(r.status) && !(porquesPreenchidos(r) >= MIN_PORQUES && cheio(r?.ishikawa?.root)))
    .sort((a, b) => (a.prazoCausa || "9999") < (b.prazoCausa || "9999") ? -1 : (a.prazoCausa || "9999") > (b.prazoCausa || "9999") ? 1 : 0);
}

/**
 * Ponto de partida vindo da resposta do fornecedor: preenche só o que está vazio,
 * nunca sobrescreve o que a Qualidade já escreveu.
 */
export function partirDaRespostaFornecedor(whys, root, resposta) {
  const doForn = (resposta?.porques || []).filter(cheio);
  const novos = [...whys];
  let usados = 0;
  for (let i = 0; i < novos.length && usados < doForn.length; i++) {
    if (!cheio(novos[i])) { novos[i] = doForn[usados]; usados++; }
  }
  const novaRaiz = cheio(root) ? root : (cheio(resposta?.causaRaiz) ? resposta.causaRaiz : root);
  return { whys: novos, root: novaRaiz, aproveitou: usados > 0 || novaRaiz !== root };
}
