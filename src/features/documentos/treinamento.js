// Treinamento e leitura obrigatória — regras puras, sem React.
//
// Princípio (SE Suite / BPF): confirmação de leitura e registro de treinamento
// valem para UMA versão do documento. Nova revisão reabre a exigência; a evidência
// da versão anterior não é apagada, é arquivada no histórico de revisões.

/**
 * Reabre a leitura obrigatória para uma nova revisão do documento.
 * Mantém os mesmos designados e zera as confirmações — quem confirmou a versão
 * anterior não pode seguir exibido como confirmado numa versão que não leu.
 *
 * @param {object|null} leitura  o `doc.leituraObrigatoria` da versão que está sendo arquivada
 * @param {{novaVersao:string, hoje:string, por:string}} ctx
 * @returns {object|null} o novo `leituraObrigatoria` (ou o valor original, se não havia atribuição)
 */
export function reabrirLeitura(leitura, { novaVersao, hoje, por } = {}) {
  if (!leitura?.atribuido) return leitura || null;
  return {
    ...leitura,
    designados: (leitura.designados || []).map(d => ({ ...d, confirmou: false, confirmedoEm: null })),
    reabertoEm: hoje,
    reabertoPor: por || "",
    reabertoNaVersao: novaVersao,
  };
}

/**
 * Um registro de treinamento só comprova treinamento no documento vigente se foi
 * feito na versão vigente. Registros sem `versao` são anteriores ao carimbo de
 * versão (v2.28.1) e não podem ser presumidos atuais.
 */
export function treinoAtual(treino, versaoDoc) {
  return !!treino?.versao && String(treino.versao) === String(versaoDoc);
}

/** Quantos designados ainda não confirmaram a leitura da versão vigente. */
export function pendentesLeitura(leitura) {
  if (!leitura?.atribuido) return 0;
  return (leitura.designados || []).filter(d => !d.confirmou).length;
}

// ──────────────────────────────────────────────────────────────────────────────
// MATRIZ DE TREINAMENTO — exigência por cargo
//
// Decisão central de arquitetura: EXIGÊNCIA É DERIVADA, EVIDÊNCIA É GRAVADA.
//
// A exigência (quem deve treinar) não se armazena — calcula-se de
// `doc.treinamento.cargos` × usuários que ocupam esses cargos. Assim, trocou
// alguém de cargo, entrou gente nova, saiu outro: a matriz já está certa, sem
// job de sincronização e sem lista de designados envelhecendo no documento.
//
// A evidência (quem treinou) é gravada e imutável, sempre carimbada com a VERSÃO
// do documento. É isso que faz a revisão reabrir o treinamento automaticamente,
// sem lógica de reset: a evidência da Rev.01 simplesmente não responde pela Rev.02.
// ──────────────────────────────────────────────────────────────────────────────

export const MODOS_TREINAMENTO = [
  { id: "leitura",    label: "Leitura e entendimento", desc: "O colaborador lê o documento e confirma no sistema." },
  { id: "presencial", label: "Treinamento presencial", desc: "Instrutor registra quem participou." },
];

export const PRAZO_TREINAMENTO_PADRAO = 30;

/** Documento só exige treinamento quando está Vigente — não se treina em rascunho. */
export function documentoExigeTreinamento(doc) {
  return !!doc?.treinamento?.exigido && doc?.status === "Vigente";
}

/**
 * Quem deve treinar este documento. Deriva de cargo (herança) e admite exceções
 * nominais. Sem duplicar: quem entra pelo cargo não reaparece como exceção.
 *
 * `pessoas` são COLABORADORES (cadastro de funcionários), não usuários do sistema:
 * numa fábrica a maioria de quem treina em POP não tem login. Aceita tanto `nome`
 * (colaborador) quanto `name` (usuário) para o período de transição.
 *
 * Desligado (`ativo: false`) fica de fora — some do cálculo de conformidade, mas a
 * evidência dele continua gravada e consultável, que é o que a inspeção pede.
 */
export function exigidosDoDocumento(doc, pessoas = [], catalogoCargos = []) {
  if (!doc?.treinamento?.exigido) return [];
  const { cargos = [], pessoasExtra = [] } = doc.treinamento;
  const nomeCargo = (id, fallback) => (catalogoCargos || []).find(c => c.id === id)?.nome || fallback || id;
  const nomeDe = (p) => p?.nome || p?.name || "—";
  const ativos = (pessoas || []).filter(p => p && p.ativo !== false);
  const vistos = new Set();
  const out = [];
  const linha = (p, origem) => ({
    userId: String(p.id), userName: nomeDe(p), setor: p.setor || "",
    cargoId: p.cargoId || null,
    cargoNome: p.cargoId ? nomeCargo(p.cargoId, p.cargoNome) : "—",
    // Relógio do prazo respeita a admissão: novo contratado não nasce atrasado.
    admissao: p.dataAdmissao || null,
    temLogin: !!p.userId,
    origem,
  });
  for (const p of ativos) {
    if (!p?.cargoId || !cargos.includes(p.cargoId)) continue;
    vistos.add(String(p.id));
    out.push(linha(p, "cargo"));
  }
  for (const uid of pessoasExtra) {
    if (vistos.has(String(uid))) continue;
    const p = ativos.find(x => String(x.id) === String(uid));
    if (!p) continue;
    vistos.add(String(uid));
    out.push(linha(p, "extra"));
  }
  return out.sort((a, b) => a.userName.localeCompare(b.userName));
}

/**
 * Exigidos que não têm login, num documento configurado como "leitura".
 *
 * É uma pendência impossível: o modo leitura depende da pessoa confirmar no
 * sistema, e quem não tem conta nunca vai conseguir. Numa fábrica isso acontece
 * sozinho — basta vincular um cargo operacional a um documento de leitura. A tela
 * usa isto para avisar e sugerir o modo presencial, que tem a lista de presença.
 */
export function exigidosSemLogin(doc, pessoas = [], catalogoCargos = []) {
  if (doc?.treinamento?.modo !== "leitura") return [];
  return exigidosDoDocumento(doc, pessoas, catalogoCargos).filter(e => !e.temLogin);
}

/** Chave lógica da evidência: um treinamento vale para (documento, versão, pessoa). */
export function chaveEvidencia(docId, versao, userId) {
  return `${docId}|${versao}|${userId}`;
}

/** Índice das evidências para consulta O(1) ao montar a matriz. */
export function indexarEvidencias(evidencias = []) {
  const mapa = new Map();
  for (const e of evidencias || []) {
    if (!e?.docId || !e?.userId) continue;
    const k = chaveEvidencia(e.docId, e.versao, e.userId);
    // Mantém a evidência mais recente em caso de registro duplicado.
    const atual = mapa.get(k);
    if (!atual || (e.ts || 0) > (atual.ts || 0)) mapa.set(k, e);
  }
  return mapa;
}

export const diasEntre = (de, ate) => {
  if (!de || !ate) return 0;
  const ms = new Date(`${ate}T12:00:00`) - new Date(`${de}T12:00:00`);
  return Math.floor(ms / 86400000);
};

/**
 * Soma meses a uma data ISO, sem estourar para o mês seguinte: 31/01 + 1 mês é
 * 28/02 (ou 29/02), não 03/03 — que é o que o Date faria sozinho.
 */
export function somarMeses(dataISO, meses) {
  if (!dataISO || !meses) return null;
  const [a, m, d] = String(dataISO).split("T")[0].split("-").map(Number);
  if (!a || !m || !d) return null;
  const alvoMes = m - 1 + Number(meses);
  const ano = a + Math.floor(alvoMes / 12);
  const mes = ((alvoMes % 12) + 12) % 12;
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const dia = Math.min(d, ultimoDia);
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Quando este treinamento vence, se o documento exigir reciclagem periódica. */
export function vencimentoDaEvidencia(evidencia, reciclagemMeses) {
  const meses = Number(reciclagemMeses) || 0;
  if (!evidencia?.dataRealizacao || meses <= 0) return null;
  return somarMeses(evidencia.dataRealizacao, meses);
}

/**
 * Status de uma célula da matriz.
 *  - `treinado`: tem evidência da versão vigente e ela ainda está válida
 *  - `vencido` : treinou, mas a reciclagem periódica expirou (BPF: competência
 *                não é permanente — POP crítico se reeduca de tempos em tempos)
 *  - `atrasado`: nunca treinou e o prazo estourou
 *  - `pendente`: nunca treinou, ainda dentro do prazo
 * `vencido` é distinto de `atrasado` de propósito: a ação é diferente (reciclar
 * quem já sabia × treinar quem nunca foi treinado) e a inspeção olha diferente.
 */
export function statusCelula({ doc, userId, indice, hoje, admissao = null }) {
  const ev = indice?.get(chaveEvidencia(doc.id, doc.versao, String(userId))) || null;
  if (ev) {
    const venceEm = vencimentoDaEvidencia(ev, doc?.treinamento?.reciclagemMeses);
    if (venceEm && venceEm < hoje) {
      return { status: "vencido", evidencia: ev, dias: diasEntre(venceEm, hoje), venceEm };
    }
    return { status: "treinado", evidencia: ev, dias: 0, venceEm, diasParaVencer: venceEm ? diasEntre(hoje, venceEm) : null };
  }
  // O relógio começa no mais TARDE entre a entrada em vigor da versão e a admissão
  // da pessoa. Sem isso, quem é contratado hoje aparece atrasado há anos num POP
  // antigo — e leva cobrança por e-mail no primeiro login, sem nunca ter tido chance.
  const desdeDoc = doc?.treinamento?.desdeEm || doc?.atualizadoEm || null;
  const desde = admissao && desdeDoc
    ? (admissao > desdeDoc ? admissao : desdeDoc)
    : (admissao || desdeDoc);
  const dias = desde ? diasEntre(desde, hoje) : 0;
  const prazo = Number(doc?.treinamento?.prazoDias ?? PRAZO_TREINAMENTO_PADRAO);
  return { status: dias > prazo ? "atrasado" : "pendente", evidencia: null, dias, venceEm: null };
}

/**
 * Monta a matriz completa: documentos vigentes que exigem treinamento × pessoas
 * exigidas. Linhas sem nenhuma exigência não aparecem — a matriz mostra quem
 * deve algo, não o cadastro inteiro.
 */
export function montarMatriz({ docs = [], pessoas = [], evidencias = [], catalogoCargos = [], hoje }) {
  const colunas = (docs || []).filter(documentoExigeTreinamento);
  const indice = indexarEvidencias(evidencias);
  const linhasPorUser = new Map();

  for (const doc of colunas) {
    for (const ex of exigidosDoDocumento(doc, pessoas, catalogoCargos)) {
      if (!linhasPorUser.has(ex.userId)) {
        linhasPorUser.set(ex.userId, { ...ex, celulas: new Map(), treinado: 0, pendente: 0, atrasado: 0, vencido: 0 });
      }
      const linha = linhasPorUser.get(ex.userId);
      const cel = statusCelula({ doc, userId: ex.userId, indice, hoje, admissao: ex.admissao });
      linha.celulas.set(String(doc.id), cel);
      linha[cel.status] += 1;
    }
  }

  const linhas = [...linhasPorUser.values()].sort((a, b) =>
    (a.cargoNome || "").localeCompare(b.cargoNome || "") || a.userName.localeCompare(b.userName));

  const total = linhas.reduce((n, l) => n + l.celulas.size, 0);
  const treinado = linhas.reduce((n, l) => n + l.treinado, 0);
  const atrasado = linhas.reduce((n, l) => n + l.atrasado, 0);
  const vencido  = linhas.reduce((n, l) => n + l.vencido, 0);
  return {
    colunas, linhas, indice,
    resumo: {
      total, treinado, atrasado, vencido,
      pendente: total - treinado - atrasado - vencido,
      // Reciclagem vencida NÃO conta como conforme — é justamente o ponto.
      conformidade: total > 0 ? Math.round((treinado / total) * 100) : 100,
    },
  };
}

/**
 * Fila de reciclagem: treinamentos ainda válidos que vencem dentro da janela.
 * É o equivalente à revisão periódica dos documentos, aplicada à competência.
 */
export function filaDeReciclagem({ docs = [], pessoas = [], evidencias = [], catalogoCargos = [], hoje, janelaDias = 60 }) {
  const indice = indexarEvidencias(evidencias);
  const out = [];
  for (const doc of (docs || []).filter(documentoExigeTreinamento)) {
    if (!Number(doc?.treinamento?.reciclagemMeses)) continue;
    for (const ex of exigidosDoDocumento(doc, pessoas, catalogoCargos)) {
      const cel = statusCelula({ doc, userId: ex.userId, indice, hoje, admissao: ex.admissao });
      if (cel.status !== "treinado" || cel.diasParaVencer == null) continue;
      if (cel.diasParaVencer <= janelaDias) out.push({ doc, ...ex, ...cel });
    }
  }
  return out.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
}

/** As exigências em aberto de uma pessoa — alimenta "meus treinamentos pendentes". */
export function pendentesDoUsuario({ docs = [], pessoas = [], evidencias = [], catalogoCargos = [], userId, hoje }) {
  const indice = indexarEvidencias(evidencias);
  const out = [];
  for (const doc of (docs || []).filter(documentoExigeTreinamento)) {
    const eu = exigidosDoDocumento(doc, pessoas, catalogoCargos).find(e => e.userId === String(userId));
    if (!eu) continue;
    const cel = statusCelula({ doc, userId, indice, hoje, admissao: eu.admissao });
    if (cel.status !== "treinado") out.push({ doc, ...cel });
  }
  return out.sort((a, b) => b.dias - a.dias);
}

// ── Migração dos dois mecanismos antigos ─────────────────────────────────────
// Antes desta fase havia dois controles paralelos e desconexos, ambos nominais:
//   1. `doc.leituraObrigatoria.designados[]` — lista de pessoas escolhida à mão
//   2. `gestao_docs/{id}/treinos` (subcoleção) — registro de treinamento presencial
// Ambos viram evidência na coleção `treinamentos`, e a designação nominal vira
// `pessoasExtra` (não dá para inferir cargo do passado — quem designou escolheu
// pessoas, não cargos). A migração é IDEMPOTENTE: evidência que já existe não
// é recriada, então rodar de novo é seguro.

/**
 * Calcula o que a migração faria, sem efeito colateral.
 * @param docs        documentos atuais
 * @param treinosPorDoc  { [docId]: [registros da subcoleção] }
 * @param evidencias  evidências já existentes na coleção nova
 * @returns { evidencias: [...], patches: [{ docId, treinamento }], jaMigrados }
 */
export function planoMigracaoTreinamento({ docs = [], treinosPorDoc = {}, evidencias = [] }) {
  const indice = indexarEvidencias(evidencias);
  const novas = [];
  const patches = [];
  let jaMigrados = 0;

  const push = (doc, userId, userName, modo, dataRealizacao, obs) => {
    const k = chaveEvidencia(String(doc.id), doc.versao || "01", String(userId));
    if (indice.has(k) || novas.some(n => chaveEvidencia(n.docId, n.versao, n.userId) === k)) { jaMigrados++; return; }
    novas.push({
      id: `mig-${doc.id}-${doc.versao || "01"}-${userId}`,
      docId: String(doc.id), docCodigo: doc.codigo || "", docTitulo: doc.titulo || "",
      versao: doc.versao || "01",
      userId: String(userId), userName: userName || "—",
      cargoNome: "", modo,
      dataRealizacao: dataRealizacao || null,
      obs: obs || "", registradoPor: "",
      origem: "migracao", ts: Date.now(),
    });
  };

  for (const doc of docs || []) {
    const leitura = doc.leituraObrigatoria;
    const treinos = treinosPorDoc[String(doc.id)] || [];
    const temLeitura = !!leitura?.atribuido;
    const temTreinos = treinos.length > 0 || !!doc.treinamentoObrigatorio;
    if (!temLeitura && !temTreinos) continue;

    // Confirmações de leitura da versão vigente viram evidência de leitura.
    for (const d of (leitura?.designados || [])) {
      if (!d?.confirmou) continue;
      push(doc, d.userId, d.userName, "leitura", (d.confirmedoEm || "").split("T")[0] || null, "Migrado da confirmação de leitura");
    }
    // Registros presenciais só valem para a versão em que foram feitos. Sem carimbo
    // de versão (registros anteriores à v2.28.1) não podem ser presumidos atuais.
    for (const t of treinos) {
      if (!t?.versao || String(t.versao) !== String(doc.versao)) continue;
      push(doc, t.userId, t.userName, "presencial", t.dataRealizacao, t.obs || "Migrado do controle de treinamentos");
    }

    if (!doc.treinamento) {
      patches.push({
        docId: String(doc.id),
        treinamento: {
          exigido: true,
          modo: temLeitura ? "leitura" : "presencial",
          cargos: [],
          pessoasExtra: (leitura?.designados || []).map(d => String(d.userId)).filter(Boolean),
          prazoDias: PRAZO_TREINAMENTO_PADRAO,
          desdeEm: doc.atualizadoEm || doc.criadoEm || null,
          migradoEm: new Date().toISOString(),
        },
      });
    }
  }
  return { evidencias: novas, patches, jaMigrados };
}

/** Uma evidência nova, pronta para gravar. Formato único — não repetir por aí. */
export function novaEvidencia({ doc, user, cargoNome, modo, dataRealizacao, obs, registradoPor, origem = "sistema" }) {
  const ts = Date.now();
  return {
    id: String(ts) + "-" + String(user.id).slice(0, 8),
    docId: String(doc.id), docCodigo: doc.codigo || "", docTitulo: doc.titulo || "",
    versao: doc.versao || "01",
    userId: String(user.id), userName: user.name || "—",
    cargoNome: cargoNome || "",
    modo: modo || "leitura",
    dataRealizacao: dataRealizacao || null,
    obs: obs || "",
    registradoPor: registradoPor || "",
    origem, ts,
  };
}
