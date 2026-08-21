const assert = require("node:assert/strict");
const test = require("node:test");
const {
  checarLimite,
  enviarEmails,
  montarPayloadEmailJS,
  normalizarDestinatarios,
  resolverTransporte,
  validarEnvio,
} = require("./email");

test("destinatarios sao normalizados: invalido nao vira silencio", () => {
  const { validos, invalidos } = normalizarDestinatarios([
    " lucas@herbamed.com.br ",
    "LUCAS@herbamed.com.br",
    "sem-arroba",
    "",
    null,
  ]);
  assert.deepEqual(validos, ["lucas@herbamed.com.br"]);
  assert.deepEqual(invalidos, ["sem-arroba"]);
});

test("validacao exige destinatario, assunto e corpo", () => {
  const ok = validarEnvio({ para: ["a@b.com"], assunto: " Teste ", corpo: "corpo" });
  assert.deepEqual(ok.destinatarios, ["a@b.com"]);
  assert.equal(ok.assunto, "Teste");

  assert.throws(() => validarEnvio({ para: [], assunto: "x", corpo: "y" }), e => e.status === 400);
  assert.throws(() => validarEnvio({ para: ["nao-e-email"], assunto: "x", corpo: "y" }), e => e.status === 400);
  assert.throws(() => validarEnvio({ para: ["a@b.com"], assunto: "  ", corpo: "y" }), e => e.status === 400);
  assert.throws(() => validarEnvio({ para: ["a@b.com"], assunto: "x", corpo: "   " }), e => e.status === 400);
});

test("limite de taxa conta destinatarios, nao requisicoes", () => {
  const estado = new Map();
  const opcoes = { estado, max: 5, janelaMs: 1000, agora: 1000 };
  checarLimite("u1", 3, opcoes);
  checarLimite("u1", 2, opcoes);
  assert.throws(() => checarLimite("u1", 1, opcoes), e => e.status === 429);
  // Outro usuario tem janela propria.
  assert.doesNotThrow(() => checarLimite("u2", 5, opcoes));
  // Passada a janela, libera.
  assert.doesNotThrow(() => checarLimite("u1", 5, { ...opcoes, agora: 3000 }));
});

test("payload do EmailJS sai das variaveis de ambiente, nao do bundle", () => {
  const anterior = { s: process.env.EMAILJS_SERVICE_ID, t: process.env.EMAILJS_TEMPLATE_ID, k: process.env.EMAILJS_PUBLIC_KEY };
  process.env.EMAILJS_SERVICE_ID = "srv";
  process.env.EMAILJS_TEMPLATE_ID = "tpl";
  process.env.EMAILJS_PUBLIC_KEY = "key";
  try {
    const payload = montarPayloadEmailJS({
      para: "a@b.com", paraNome: "Ana", deNome: "SGQ", replyTo: "rt@herbamed.com.br",
      assunto: "Assunto", corpo: "Corpo",
    });
    assert.equal(payload.service_id, "srv");
    assert.equal(payload.template_id, "tpl");
    assert.equal(payload.user_id, "key");
    assert.equal(payload.template_params.to_email, "a@b.com");
    assert.equal(payload.template_params.reply_to, "rt@herbamed.com.br");
  } finally {
    for (const [nome, valor] of [["EMAILJS_SERVICE_ID", anterior.s], ["EMAILJS_TEMPLATE_ID", anterior.t], ["EMAILJS_PUBLIC_KEY", anterior.k]]) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  }
});

test("private key entra como accessToken; sem ela o campo nem aparece", () => {
  const anterior = process.env.EMAILJS_PRIVATE_KEY;
  try {
    delete process.env.EMAILJS_PRIVATE_KEY;
    assert.equal("accessToken" in montarPayloadEmailJS({ para: "a@b.com" }), false);
    process.env.EMAILJS_PRIVATE_KEY = "priv";
    assert.equal(montarPayloadEmailJS({ para: "a@b.com" }).accessToken, "priv");
  } finally {
    if (anterior === undefined) delete process.env.EMAILJS_PRIVATE_KEY;
    else process.env.EMAILJS_PRIVATE_KEY = anterior;
  }
});

test("403 de ambiente nao-navegador vira instrucao, nao stack", async () => {
  const anterior = { s: process.env.EMAILJS_SERVICE_ID, t: process.env.EMAILJS_TEMPLATE_ID, k: process.env.EMAILJS_PUBLIC_KEY };
  process.env.EMAILJS_SERVICE_ID = "srv";
  process.env.EMAILJS_TEMPLATE_ID = "tpl";
  process.env.EMAILJS_PUBLIC_KEY = "key";
  try {
    const emailjs = resolverTransporte("emailjs");
    await assert.rejects(
      () => emailjs({ para: "a@b.com", assunto: "x", corpo: "y" }, {
        fetchImpl: async () => ({ ok: false, status: 403, text: async () => "API access from non-browser environments is currently disabled." }),
      }),
      e => /non-browser applications/.test(e.message) && /EMAILJS_PRIVATE_KEY/.test(e.message)
    );
  } finally {
    for (const [nome, valor] of [["EMAILJS_SERVICE_ID", anterior.s], ["EMAILJS_TEMPLATE_ID", anterior.t], ["EMAILJS_PUBLIC_KEY", anterior.k]]) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  }
});

test("transporte desconhecido falha alto; graph avisa que e a Fase 1", async () => {
  assert.throws(() => resolverTransporte("carta-registrada"), e => e.status === 500);
  const graph = resolverTransporte("graph");
  await assert.rejects(() => graph({}), e => e.status === 503);
});

test("cada destinatario vira uma linha de log, com sucesso e com falha", async () => {
  const logs = [];
  const resultado = await enviarEmails(
    {
      para: ["ok@herbamed.com.br", "ruim@herbamed.com.br"],
      assunto: "Assunto",
      corpo: "Corpo",
      evento: "manual",
      entidade: { tipo: "rnc", id: "rnc-1", num: "RNC-001" },
      remetente: { id: "u1", nome: "Lucas", email: "lucas@herbamed.com.br" },
    },
    {
      transporte: "teste",
      adaptador: async msg => {
        if (msg.para.startsWith("ruim")) throw new Error("caixa cheia");
        return { messageId: "m-1" };
      },
      registrar: async linha => logs.push(linha),
    }
  );

  assert.deepEqual(resultado.enviados, ["ok@herbamed.com.br"]);
  assert.equal(resultado.falhas.length, 1);
  assert.equal(resultado.falhas[0].erro, "caixa cheia");

  assert.equal(logs.length, 2);
  assert.equal(logs[0].status, "enviado");
  assert.equal(logs[0].messageId, "m-1");
  assert.equal(logs[0].entidadeNum, "RNC-001");
  assert.equal(logs[0].disparadoPorNome, "Lucas");
  assert.equal(logs[1].status, "falhou");
  assert.equal(logs[1].erro, "caixa cheia");
});

test("endereco invalido tambem deixa rastro no log", async () => {
  const logs = [];
  const resultado = await enviarEmails(
    { para: ["ok@b.com", "sem-arroba"], assunto: "Assunto", corpo: "Corpo", remetente: { id: "u1", nome: "Lucas" } },
    { transporte: "teste", adaptador: async () => ({}), registrar: async l => logs.push(l) }
  );
  assert.deepEqual(resultado.enviados, ["ok@b.com"]);
  assert.equal(logs.length, 2);
  const invalido = logs.find(l => l.destinatario === "sem-arroba");
  assert.equal(invalido.status, "falhou");
  assert.equal(invalido.erro, "Endereco invalido");
});

test("falha isolada nao aborta o lote", async () => {
  const resultado = await enviarEmails(
    {
      para: ["a@b.com", "quebra@b.com", "c@b.com"],
      assunto: "Assunto", corpo: "Corpo",
      remetente: { id: "u1", nome: "Lucas", email: "lucas@herbamed.com.br" },
    },
    {
      transporte: "teste",
      adaptador: async msg => { if (msg.para.startsWith("quebra")) throw new Error("falhou"); return {}; },
    }
  );
  assert.deepEqual(resultado.enviados, ["a@b.com", "c@b.com"]);
  assert.equal(resultado.falhas.length, 1);
});

test("reply-to vem do remetente da sessao, nunca do pedido do cliente", async () => {
  const enviadas = [];
  await enviarEmails(
    {
      para: ["a@b.com"], assunto: "Assunto", corpo: "Corpo",
      replyTo: "invasor@fora.com", remetente: { id: "u1", nome: "Lucas", email: "lucas@herbamed.com.br" },
    },
    { transporte: "teste", adaptador: async msg => { enviadas.push(msg); return {}; } }
  );
  assert.equal(enviadas[0].replyTo, "lucas@herbamed.com.br");
  assert.match(enviadas[0].deNome, /^Lucas · /);
});
