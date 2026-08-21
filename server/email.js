// Envio de e-mail do SGQ — Fase 0 do plano em `docs/PLANO_EMAIL_BACKEND.md`.
//
// O envio saiu do navegador e passou a acontecer aqui, atras de um adaptador
// selecionado pela variavel `EMAIL_TRANSPORTE`. Nesta fase o transporte real
// continua sendo o EmailJS; a Fase 1 troca para o Microsoft Graph mexendo SO na
// variavel de ambiente — nenhum codigo de front muda e o rollback e voltar a env.
//
// Todo envio (sucesso ou falha) vira uma linha em `email_log`, que e IMUTAVEL:
// so INSERT, nunca UPDATE nem DELETE. Num SGQ notificar e evidencia — "avisamos o
// responsavel em tal data" precisa ter registro, e o `.catch(() => {})` que os
// alertas usavam engolia justamente isso.
//
// O `Reply-To` e sempre o e-mail de quem disparou, resolvido pela sessao no
// servidor: o cliente nao escolhe remetente. Falsificar o `From` da pessoa e o
// que quebra DMARC, e e o problema que a Fase 1 vem resolver.

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_DESTINATARIOS = numeroEnv("EMAIL_MAX_DESTINATARIOS", 50);
const MAX_ASSUNTO = 300;
const MAX_CORPO = 100_000;

function numeroEnv(nome, padrao) {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

function erro(status, mensagem) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

function emailValido(valor) {
  return typeof valor === "string" && RE_EMAIL.test(valor.trim());
}

// Separa validos de invalidos em vez de simplesmente filtrar: destinatario
// descartado em silencio e notificacao que ninguem sabe que nao saiu.
function normalizarDestinatarios(para) {
  const lista = Array.isArray(para) ? para : [para];
  const vistos = new Set();
  const validos = [];
  const invalidos = [];
  for (const item of lista) {
    const valor = String(item ?? "").trim();
    if (!valor) continue;
    if (!emailValido(valor)) {
      invalidos.push(valor);
      continue;
    }
    const chave = valor.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    validos.push(valor);
  }
  return { validos, invalidos };
}

function validarEnvio({ para, assunto, corpo }) {
  const { validos, invalidos } = normalizarDestinatarios(para);
  if (!validos.length) {
    throw erro(400, invalidos.length ? `Destinatario invalido: ${invalidos.join(", ")}` : "Nenhum destinatario informado");
  }
  if (validos.length > MAX_DESTINATARIOS) {
    throw erro(400, `Maximo de ${MAX_DESTINATARIOS} destinatarios por envio`);
  }
  const assuntoLimpo = String(assunto ?? "").trim();
  if (!assuntoLimpo) throw erro(400, "Assunto obrigatorio");
  if (assuntoLimpo.length > MAX_ASSUNTO) throw erro(400, `Assunto acima de ${MAX_ASSUNTO} caracteres`);
  const corpoLimpo = String(corpo ?? "");
  if (!corpoLimpo.trim()) throw erro(400, "Corpo do e-mail obrigatorio");
  if (corpoLimpo.length > MAX_CORPO) throw erro(400, `Corpo acima de ${MAX_CORPO} caracteres`);
  return { destinatarios: validos, invalidos, assunto: assuntoLimpo, corpo: corpoLimpo };
}

// ── Limite de taxa ────────────────────────────────────────────────────────────
// Conta DESTINATARIOS, nao requisicoes: o modal envia um e-mail por destinatario
// num laco, entao limitar por requisicao nao seguraria nada. Estado em memoria e
// suficiente porque o backend e um processo unico (mesmo desenho do arecoSync).

const janelaPorUsuario = new Map();

function checarLimite(userId, quantidade, opcoes = {}) {
  const agora = opcoes.agora ?? Date.now();
  const estado = opcoes.estado ?? janelaPorUsuario;
  const max = opcoes.max ?? numeroEnv("EMAIL_RATE_LIMIT_MAX", 200);
  const janelaMs = opcoes.janelaMs ?? numeroEnv("EMAIL_RATE_LIMIT_JANELA_MS", 60 * 60 * 1000);
  const chave = String(userId || "anonimo");
  const recentes = (estado.get(chave) || []).filter(ts => agora - ts < janelaMs);
  if (recentes.length + quantidade > max) {
    estado.set(chave, recentes);
    throw erro(429, `Limite de ${max} e-mails por hora atingido. Tente novamente mais tarde.`);
  }
  for (let i = 0; i < quantidade; i += 1) recentes.push(agora);
  estado.set(chave, recentes);
  return { usados: recentes.length, max };
}

// ── Transportes ───────────────────────────────────────────────────────────────

function transporteAtual() {
  return String(process.env.EMAIL_TRANSPORTE || "emailjs").trim().toLowerCase();
}

// ⚠️ Chamada de fora do navegador exige DUAS coisas no painel do EmailJS:
// (1) "Allow EmailJS API for non-browser applications" ligado em Account →
// Security, e (2) a PRIVATE key enviada como `accessToken`. Sem isso a API
// responde 403 "API access from non-browser environments is currently disabled"
// — verificado em 2026-08-21, corrigindo o que o plano afirmava.
// Isso vale so ate a Fase 1: o Graph nao tem essa restricao.
function montarPayloadEmailJS(mensagem) {
  const privateKey = process.env.EMAILJS_PRIVATE_KEY || "";
  return {
    service_id: process.env.EMAILJS_SERVICE_ID || "",
    template_id: process.env.EMAILJS_TEMPLATE_ID || "",
    user_id: process.env.EMAILJS_PUBLIC_KEY || "",
    ...(privateKey ? { accessToken: privateKey } : {}),
    template_params: {
      to_email: mensagem.para,
      to_name: mensagem.paraNome || mensagem.para,
      from_name: mensagem.deNome,
      subject: mensagem.assunto,
      message: mensagem.corpo,
      reply_to: mensagem.replyTo,
    },
  };
}

async function enviarViaEmailJS(mensagem, deps = {}) {
  const buscar = deps.fetchImpl || fetch;
  const payload = montarPayloadEmailJS(mensagem);
  if (!payload.service_id || !payload.template_id || !payload.user_id) {
    throw erro(500, "EmailJS nao configurado (EMAILJS_SERVICE_ID / EMAILJS_TEMPLATE_ID / EMAILJS_PUBLIC_KEY)");
  }
  const res = await buscar("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    // A API devolve 403 com duas redacoes diferentes para a mesma causa raiz —
    // "strict mode, but no Private Key was provided" e, quando o template tambem
    // nao confere, "non-browser environments is currently disabled". As duas se
    // resolvem preenchendo EMAILJS_PRIVATE_KEY, entao a instrucao e a mesma.
    if (res.status === 403 && /non-browser|private key|strict mode/i.test(texto)) {
      throw new Error(
        "EmailJS recusou a chamada do servidor: EMAILJS_PRIVATE_KEY vazia. A conta esta em strict mode " +
        "('Use Private Key' ligado), e nesse modo a API exige o accessToken. A chave fica em " +
        "dashboard.emailjs.com → Account → General → Private Key. " +
        `Resposta do EmailJS: ${texto.slice(0, 150)}`
      );
    }
    throw new Error(`EmailJS respondeu ${res.status}${texto ? `: ${texto.slice(0, 300)}` : ""}`);
  }
  return { messageId: null };
}

// `log` nao envia nada: e o transporte para rodar local sem gastar cota nem
// disparar e-mail de verdade a partir de um banco de teste.
async function enviarViaLog(mensagem) {
  console.log(`[email:log] para=${mensagem.para} assunto=${mensagem.assunto}`);
  return { messageId: `log-${Date.now()}` };
}

async function enviarViaGraph() {
  throw erro(503, "Transporte 'graph' e a Fase 1 do plano de e-mail e ainda nao esta configurado");
}

const TRANSPORTES = {
  emailjs: enviarViaEmailJS,
  log: enviarViaLog,
  graph: enviarViaGraph,
};

function resolverTransporte(nome) {
  const adaptador = TRANSPORTES[nome];
  if (!adaptador) throw erro(500, `EMAIL_TRANSPORTE desconhecido: ${nome}`);
  return adaptador;
}

// ── Registro ──────────────────────────────────────────────────────────────────

async function registrarEnvio(query, linha) {
  await query(
    `INSERT INTO email_log
       (destinatario, assunto, evento, entidade_tipo, entidade_id, entidade_num,
        disparado_por_id, disparado_por_nome, transporte, status, erro, message_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      linha.destinatario,
      linha.assunto,
      linha.evento || null,
      linha.entidadeTipo || null,
      linha.entidadeId || null,
      linha.entidadeNum || null,
      linha.disparadoPorId || null,
      linha.disparadoPorNome || null,
      linha.transporte,
      linha.status,
      linha.erro || null,
      linha.messageId || null,
    ]
  );
}

// ── Entrada principal ─────────────────────────────────────────────────────────
//
// Envia um e-mail por destinatario e devolve o que passou e o que falhou. Uma
// falha isolada NAO aborta o restante: se cinco pessoas precisam ser notificadas
// e um endereco esta errado, as outras quatro continuam sendo avisadas — e a
// falha fica registrada em vez de derrubar o lote inteiro.
async function enviarEmails(pedido, deps = {}) {
  const { destinatarios, invalidos, assunto, corpo } = validarEnvio(pedido);
  const remetente = pedido.remetente || {};
  const nomeTransporte = deps.transporte || transporteAtual();
  const adaptador = deps.adaptador || resolverTransporte(nomeTransporte);

  const enviados = [];
  const falhas = [];

  // O log e importante, mas nao mais importante que a notificacao: se o INSERT
  // falhar (banco fora, coluna nova ainda nao migrada), derrubar o envio faria o
  // handler devolver erro para e-mails QUE JA SAIRAM — e abortaria os proximos
  // destinatarios do lote. Entao a gravacao nunca lanca; a falha dela vai para o
  // stdout do container, que e onde se procura problema de infraestrutura.
  const registrarBruto = deps.registrar || (async () => {});
  const registrar = async linha => {
    try {
      await registrarBruto(linha);
    } catch (e) {
      console.error(`[email] falha ao gravar email_log (${linha.destinatario}): ${e.message}`);
    }
  };

  const linhaBase = destinatario => ({
    destinatario,
    assunto,
    evento: pedido.evento,
    entidadeTipo: pedido.entidade?.tipo,
    entidadeId: pedido.entidade?.id,
    entidadeNum: pedido.entidade?.num,
    disparadoPorId: remetente.id,
    disparadoPorNome: remetente.nome,
    transporte: nomeTransporte,
  });

  // Endereco invalido tambem vira linha de log: "tentamos notificar e o endereco
  // estava errado" e informacao de auditoria, nao ruido de validacao.
  for (const destinatario of invalidos) {
    falhas.push({ destinatario, erro: "Endereco invalido" });
    await registrar({ ...linhaBase(destinatario), status: "falhou", erro: "Endereco invalido" });
  }

  for (const destinatario of destinatarios) {
    const mensagem = {
      para: destinatario,
      paraNome: pedido.nomes?.[destinatario] || destinatario,
      deNome: remetente.nome ? `${remetente.nome} · Herbamed® Gestão da Qualidade` : "SGQ Herbamed®",
      replyTo: remetente.email || "",
      assunto,
      corpo,
    };
    const base = linhaBase(destinatario);
    try {
      const resultado = await adaptador(mensagem, deps);
      enviados.push(destinatario);
      await registrar({ ...base, status: "enviado", messageId: resultado?.messageId });
    } catch (e) {
      falhas.push({ destinatario, erro: e.message });
      await registrar({ ...base, status: "falhou", erro: e.message });
    }
  }

  return { enviados, falhas, transporte: nomeTransporte };
}

module.exports = {
  checarLimite,
  emailValido,
  enviarEmails,
  montarPayloadEmailJS,
  normalizarDestinatarios,
  registrarEnvio,
  resolverTransporte,
  transporteAtual,
  validarEnvio,
};
