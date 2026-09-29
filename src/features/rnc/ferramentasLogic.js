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
 * Um único patch para salvar a CAPA. Antes eram duas gravações seguidas e a segunda
 * partia do histórico antigo, apagando a entrada que a primeira acabara de gravar.
 */
export function patchSalvarCapa(r, acts, autor, data) {
  const anteriores = r.w2h || [];
  const prazo = prazoGeralCapa(acts);
  const prorrogadas = acts
    .filter(a => { const ant = anteriores.find(x => x.id === a.id); return ant?.when && a.when && ant.when !== a.when; })
    .map(a => { const ant = anteriores.find(x => x.id === a.id); return `Ação "${a.what || a.id}": prazo ${ant.when} → ${a.when}`; });
  const historico = [
    ...(r.historico || []),
    { data, acao: `CAPA — ${acts.length} ação(ões)`, resp: autor },
    { data, acao: "Prazo geral calculado pelas ações CAPA", detalhes: [`Prazo calculado: ${prazo || "—"}`, ...prorrogadas], resp: autor, tipo: "prazo_capa" },
  ];
  return { w2h: acts, prazoAC: prazo, modoPrazo: "definido", justificativaPrazo: "", proximaReavaliacao: "", historico };
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
