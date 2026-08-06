/* eslint-disable no-console */
// Cenário de teste realista para a Matriz de Treinamento.
//
// Espelha o perfil do sistema oficial (49 documentos: 13 Vigentes, 31 Em Revisão,
// 5 Rascunho) e a realidade de chão de fábrica: a maioria das pessoas exigidas em
// POP é operador. Serve para exercitar a matriz com volume real, e para tornar
// visíveis dois limites do desenho atual:
//
//   1. Só documento VIGENTE entra na matriz (`documentoExigeTreinamento`). Com 31
//      dos 49 em revisão, a maior parte do acervo fica fora do cálculo — e nada na
//      tela avisa que ficou.
//   2. Toda pessoa exigida precisa ser um USUÁRIO do sistema. Aqui os operadores
//      são criados como usuários só para o teste rodar; em produção eles não têm
//      login, e é justamente esse o problema a resolver.
//
// Uso:  node scripts/seedTeste.js          (popula)
//       node scripts/seedTeste.js --limpar (remove só o que este script criou)
//
// Só roda contra banco local. Nada é apagado além do que tem a marca `seedTeste`.

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

// Lê o .env local sem dependência extra — as credenciais do banco moram lá.
for (const linha of (fs.existsSync(path.join(__dirname, "..", ".env"))
  ? fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/) : [])) {
  const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const HOST = process.env.POSTGRES_HOST || "localhost";
const PORT = Number(process.env.POSTGRES_PORT || 5487);
const DB   = process.env.POSTGRES_DB || "sgqherbamed";
const USER = process.env.POSTGRES_USER || "sgqherbamed";
const PASS = process.env.POSTGRES_PASSWORD || "sgqherbamed_change_me";

if (!["localhost", "127.0.0.1", "db"].includes(HOST)) {
  console.error(`Recusado: este seed só roda em banco local (host recebido: ${HOST}).`);
  process.exit(1);
}

const SENHA_PADRAO = "Herba@123";
const hoje = new Date();
const iso = (d) => d.toISOString().split("T")[0];
const diasAtras = (n) => iso(new Date(hoje.getTime() - n * 86400000));

// ── Cargos ────────────────────────────────────────────────────────────────────
const CARGOS = [
  { id: "operador-de-encapsulamento",          nome: "Operador de Encapsulamento" },
  { id: "operador-de-compressao",              nome: "Operador de Compressão" },
  { id: "operador-de-embalagem",               nome: "Operador de Embalagem" },
  { id: "auxiliar-de-producao",                nome: "Auxiliar de Produção" },
  { id: "supervisor-de-producao",              nome: "Supervisor de Produção" },
  { id: "analista-de-controle-de-qualidade",   nome: "Analista de Controle de Qualidade" },
  { id: "auxiliar-de-laboratorio",             nome: "Auxiliar de Laboratório" },
  { id: "farmaceutico-responsavel-tecnico",    nome: "Farmacêutico Responsável Técnico" },
  { id: "assistente-de-garantia-da-qualidade", nome: "Assistente de Garantia da Qualidade" },
  { id: "almoxarife",                          nome: "Almoxarife" },
  { id: "auxiliar-de-limpeza",                 nome: "Auxiliar de Limpeza" },
  { id: "tecnico-de-manutencao",               nome: "Técnico de Manutenção" },
];

// ── Pessoas ───────────────────────────────────────────────────────────────────
// Proporção de fábrica: operação é a maioria. Em produção a maior parte destes
// NÃO teria login — estão aqui como usuários só para o cenário rodar.
const PESSOAS = [
  ["Adriana Moreira",       "operador-de-encapsulamento",          "Produção"],
  ["Bruno Cardoso",         "operador-de-encapsulamento",          "Produção"],
  ["Cleber Antunes",        "operador-de-encapsulamento",          "Produção"],
  ["Daniela Prado",         "operador-de-compressao",              "Produção"],
  ["Edson Vilela",          "operador-de-compressao",              "Produção"],
  ["Fabiana Rocha",         "operador-de-embalagem",               "Produção"],
  ["Gilberto Nunes",        "operador-de-embalagem",               "Produção"],
  ["Helena Marques",        "operador-de-embalagem",               "Produção"],
  ["Ivan Siqueira",         "auxiliar-de-producao",                "Produção"],
  ["Joana Ferraz",          "auxiliar-de-producao",                "Produção"],
  ["Kleber Dias",           "auxiliar-de-producao",                "Produção"],
  ["Larissa Amorim",        "supervisor-de-producao",              "Produção"],
  ["Marcelo Tavares",       "supervisor-de-producao",              "Produção"],
  ["Natália Bezerra",       "analista-de-controle-de-qualidade",   "Qualidade"],
  ["Otávio Lins",           "analista-de-controle-de-qualidade",   "Qualidade"],
  ["Paula Rezende",         "auxiliar-de-laboratorio",             "Qualidade"],
  ["Quésia Martins",        "farmaceutico-responsavel-tecnico",    "Qualidade"],
  ["Rafael Coutinho",       "assistente-de-garantia-da-qualidade", "Qualidade"],
  ["Simone Barros",         "almoxarife",                          "Almoxarifado"],
  ["Tiago Peixoto",         "almoxarife",                          "Almoxarifado"],
  ["Vanessa Lopes",         "auxiliar-de-limpeza",                 "Serviços Gerais"],
  ["Wagner Estevam",        "tecnico-de-manutencao",               "Manutenção"],
];

// ── Documentos ────────────────────────────────────────────────────────────────
// [codigo, titulo, tipo, depto, cargos exigidos (vazio = não exige treinamento)]
const VIGENTES = [
  ["POP-PRO-001", "Higienização de Salas e Superfícies da Área Produtiva", "PO",  "PRO", ["operador-de-encapsulamento","operador-de-compressao","operador-de-embalagem","auxiliar-de-producao","auxiliar-de-limpeza"]],
  ["POP-PRO-002", "Operação da Encapsuladora Automática",                  "PO",  "PRO", ["operador-de-encapsulamento","supervisor-de-producao"]],
  ["POP-PRO-003", "Operação da Compressora Rotativa",                      "PO",  "PRO", ["operador-de-compressao","supervisor-de-producao"]],
  ["POP-PRO-004", "Pesagem e Dispensação de Matérias-Primas",              "PO",  "PRO", ["auxiliar-de-producao","supervisor-de-producao","almoxarife"]],
  ["POP-PRO-005", "Controle em Processo — Peso Médio e Dureza",            "PO",  "PRO", ["operador-de-compressao","analista-de-controle-de-qualidade"]],
  ["EMP-PRO-001", "Embalagem Primária de Cápsulas em Blíster",             "EMP", "PRO", ["operador-de-embalagem","supervisor-de-producao"]],
  ["POP-CQ-001",  "Amostragem de Matéria-Prima no Recebimento",            "PO",  "SGQ", ["analista-de-controle-de-qualidade","auxiliar-de-laboratorio","almoxarife"]],
  ["MTA-CQ-001",  "Determinação de Umidade por Termobalança",              "MTA", "SGQ", ["analista-de-controle-de-qualidade","auxiliar-de-laboratorio"]],
  ["POP-ALM-001", "Recebimento, Identificação e Armazenamento de Insumos", "PO",  "ALM", ["almoxarife","auxiliar-de-producao"]],
  ["POP-GQ-001",  "Controle de Documentos e Registros da Qualidade",       "PO",  "SGQ", ["assistente-de-garantia-da-qualidade","farmaceutico-responsavel-tecnico","supervisor-de-producao"]],
  ["POP-GQ-002",  "Tratamento de Não Conformidades e Ações CAPA",          "PO",  "SGQ", ["assistente-de-garantia-da-qualidade","farmaceutico-responsavel-tecnico","supervisor-de-producao","analista-de-controle-de-qualidade"]],
  ["IT-PRO-001",  "Troca de Lote e Limpeza de Linha",                      "IT",  "PRO", ["operador-de-encapsulamento","operador-de-compressao","operador-de-embalagem"]],
  ["EPI-SSM-001", "Uso, Guarda e Descarte de EPIs",                        "EPI", "SSM", ["operador-de-encapsulamento","operador-de-compressao","operador-de-embalagem","auxiliar-de-producao","auxiliar-de-limpeza","tecnico-de-manutencao","almoxarife"]],
];

const EM_REVISAO = [
  ["POP-PRO-006", "Paramentação e Acesso à Área Produtiva",                "PO",  "PRO", ["operador-de-encapsulamento","operador-de-compressao","operador-de-embalagem","auxiliar-de-producao"]],
  ["POP-PRO-007", "Controle de Pragas na Área Produtiva",                  "PO",  "PRO", ["auxiliar-de-limpeza","supervisor-de-producao"]],
  ["POP-PRO-008", "Identificação e Segregação de Produto Não Conforme",    "PO",  "PRO", ["supervisor-de-producao","operador-de-embalagem"]],
  ["POP-PRO-009", "Reconciliação de Materiais de Embalagem",               "PO",  "PRO", ["operador-de-embalagem","supervisor-de-producao"]],
  ["POP-PRO-010", "Registro de Ordem de Produção",                         "PO",  "PRO", ["supervisor-de-producao","auxiliar-de-producao"]],
  ["POP-CQ-002",  "Análise de Produto Acabado — Liberação de Lote",        "PO",  "SGQ", ["analista-de-controle-de-qualidade","farmaceutico-responsavel-tecnico"]],
  ["POP-CQ-003",  "Controle de Padrões e Reagentes",                       "PO",  "SGQ", ["analista-de-controle-de-qualidade","auxiliar-de-laboratorio"]],
  ["POP-CQ-004",  "Retenção de Amostras de Referência",                    "PO",  "SGQ", ["analista-de-controle-de-qualidade"]],
  ["MTA-CQ-002",  "Doseamento por Cromatografia Líquida (CLAE)",           "MTA", "SGQ", ["analista-de-controle-de-qualidade"]],
  ["MTA-CQ-003",  "Contagem Microbiana Total",                             "MTA", "SGQ", ["analista-de-controle-de-qualidade","auxiliar-de-laboratorio"]],
  ["ESP-CQ-001",  "Especificação de Matéria-Prima — Excipientes",          "ESP", "SGQ", []],
  ["ESP-CQ-002",  "Especificação de Material de Embalagem",                "ESP", "SGQ", []],
  ["EPA-CQ-001",  "Especificação de Produto Acabado — Cápsulas",           "EPA", "SGQ", []],
  ["POP-GQ-003",  "Gestão de Desvios de Qualidade",                        "PO",  "SGQ", ["assistente-de-garantia-da-qualidade","supervisor-de-producao","analista-de-controle-de-qualidade"]],
  ["POP-GQ-004",  "Controle de Mudanças (Change Control)",                 "PO",  "SGQ", ["assistente-de-garantia-da-qualidade","farmaceutico-responsavel-tecnico"]],
  ["POP-GQ-005",  "Auditoria Interna da Qualidade",                        "PO",  "SGQ", ["assistente-de-garantia-da-qualidade","farmaceutico-responsavel-tecnico"]],
  ["POP-GQ-006",  "Qualificação de Fornecedores",                          "PO",  "SGQ", ["assistente-de-garantia-da-qualidade"]],
  ["POP-GQ-007",  "Treinamento e Capacitação de Pessoal",                  "PO",  "SGQ", ["assistente-de-garantia-da-qualidade","supervisor-de-producao"]],
  ["POP-ALM-002", "Expedição e Transporte de Produto Acabado",             "PO",  "ALM", ["almoxarife"]],
  ["POP-ALM-003", "Inventário Rotativo de Estoque",                        "PO",  "ALM", ["almoxarife"]],
  ["POP-ALM-004", "Controle de Temperatura e Umidade do Armazém",          "PO",  "ALM", ["almoxarife","tecnico-de-manutencao"]],
  ["POP-MAN-001", "Manutenção Preventiva de Equipamentos Produtivos",      "PO",  "MAN", ["tecnico-de-manutencao","supervisor-de-producao"]],
  ["PCAL-MAN-001","Plano de Calibração de Balanças e Instrumentos",        "PCAL","MAN", ["tecnico-de-manutencao","analista-de-controle-de-qualidade"]],
  ["POP-SSM-001", "Prevenção de Acidentes na Operação de Máquinas",        "PO",  "SSM", ["operador-de-encapsulamento","operador-de-compressao","tecnico-de-manutencao"]],
  ["EME-SSM-001", "Procedimento de Emergência — Incêndio e Evacuação",     "EME", "SSM", ["operador-de-encapsulamento","operador-de-compressao","operador-de-embalagem","auxiliar-de-producao","almoxarife","auxiliar-de-limpeza","tecnico-de-manutencao"]],
  ["POP-LIM-001", "Higienização de Vestiários e Áreas Comuns",             "PO",  "LIM", ["auxiliar-de-limpeza"]],
  ["POP-LIM-002", "Diluição e Rodízio de Saneantes",                       "PO",  "LIM", ["auxiliar-de-limpeza"]],
  ["IT-PRO-002",  "Ajuste de Dosador da Encapsuladora",                    "IT",  "PRO", ["operador-de-encapsulamento"]],
  ["IT-PRO-003",  "Montagem e Desmontagem de Punções",                     "IT",  "PRO", ["operador-de-compressao","tecnico-de-manutencao"]],
  ["IT-ALM-001",  "Conferência de Nota Fiscal no Recebimento",             "IT",  "ALM", ["almoxarife"]],
  ["MOP-GQ-001",  "Manual da Qualidade",                                   "MOP", "SGQ", ["farmaceutico-responsavel-tecnico","assistente-de-garantia-da-qualidade"]],
];

const RASCUNHOS = [
  ["POP-PRO-011", "Validação de Limpeza de Equipamentos",                  "PO",  "PRO", []],
  ["POP-CQ-005",  "Investigação de Resultado Fora de Especificação (OOS)", "PO",  "SGQ", []],
  ["POP-GQ-008",  "Revisão Periódica de Produto (RPP)",                    "PO",  "SGQ", []],
  ["FO-GQ-001",   "Formulário de Solicitação de Mudança",                  "FO",  "SGQ", []],
  ["IT-LIM-001",  "Preparo de Solução Sanitizante a 70%",                  "IT",  "LIM", []],
];

const MARCA = "seedTeste";

function docBase(codigo, titulo, tipo, depto, cargos, status, versao, extra = {}) {
  const exige = cargos.length > 0;
  return {
    id: codigo, codigo, titulo, tipo, depto, versao, status,
    criadoEm: diasAtras(600), criadoPor: "Seed de Teste",
    atualizadoEm: diasAtras(30), atualizadoPor: "Seed de Teste", atualizadoTs: Date.now(),
    objetivo: `Estabelecer os critérios e responsabilidades para ${titulo.toLowerCase()}.`,
    alcance: "Aplica-se a todas as áreas envolvidas no processo descrito.",
    etapas: [], materiais: [], obs: "",
    treinamento: exige ? {
      exigido: true,
      modo: extra.modo || "presencial",
      cargos,
      pessoasExtra: [],
      prazoDias: 30,
      reciclagemMeses: extra.reciclagemMeses ?? null,
      desdeEm: extra.desdeEm ?? null,
      definidoPor: "Seed de Teste", definidoEm: diasAtras(120),
    } : null,
    [MARCA]: true,
    ...extra.doc,
  };
}

async function main() {
  const limpar = process.argv.includes("--limpar");
  const client = new Client({ host: HOST, port: PORT, database: DB, user: USER, password: PASS });
  await client.connect();

  // ── Limpeza do que este script criou (sempre roda antes de repopular) ──
  const delDocs = await client.query(`DELETE FROM generic_documents WHERE data->>'${MARCA}' = 'true'`);
  const delUsers = await client.query(`DELETE FROM users WHERE data->>'${MARCA}' = 'true'`);
  console.log(`Limpeza: ${delDocs.rowCount} registro(s) e ${delUsers.rowCount} usuário(s) do seed removidos.`);
  if (limpar) {
    // O catálogo de cargos é compartilhado: devolve só o cargo original.
    await client.query(
      `INSERT INTO generic_documents (collection, id, data) VALUES ('configuracoes','catalogo_cargos',$1)
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify({ id: "catalogo_cargos", items: [CARGOS[5]] })]
    );
    await client.end();
    console.log("Pronto — banco devolvido ao estado anterior ao seed.");
    return;
  }

  // ── Cargos ──
  await client.query(
    `INSERT INTO generic_documents (collection, id, data) VALUES ('configuracoes','catalogo_cargos',$1)
     ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify({ id: "catalogo_cargos", items: CARGOS.map(c => ({ ...c, ativo: true })) })]
  );
  console.log(`Cargos: ${CARGOS.length}`);

  // ── Pessoas ──
  const hash = await bcrypt.hash(SENHA_PADRAO, 10);
  const pessoasIds = [];
  for (const [nome, cargoId, setor] of PESSOAS) {
    const email = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z ]/gu, "").trim().split(/\s+/).join(".") + "@teste.local";
    const cargoNome = CARGOS.find(c => c.id === cargoId)?.nome || "";
    const r = await client.query(
      `INSERT INTO users (name, email, password_hash, role, setor, permissoes, data)
       VALUES ($1,$2,$3,'user',$4,'{}'::jsonb,$5) RETURNING id`,
      [nome, email, hash, setor, JSON.stringify({ cargo: cargoNome, cargoId, [MARCA]: true })]
    );
    pessoasIds.push({ id: r.rows[0].id, nome, cargoId, cargoNome, setor });
  }
  console.log(`Pessoas: ${pessoasIds.length} (senha padrão: ${SENHA_PADRAO})`);

  // ── Documentos ──
  const insertDoc = (d) => client.query(
    `INSERT INTO generic_documents (collection, id, data) VALUES ('gestao_docs',$1,$2)
     ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data`,
    [d.id, JSON.stringify(d)]
  );

  const docsVigentes = [];
  for (let i = 0; i < VIGENTES.length; i++) {
    const [codigo, titulo, tipo, depto, cargos] = VIGENTES[i];
    // Espalha o relógio do prazo: alguns dentro do prazo, outros já estourados.
    const desdeEm = diasAtras([10, 20, 45, 90, 200, 15, 60, 120, 25, 300, 40, 5, 180][i] || 30);
    const d = docBase(codigo, titulo, tipo, depto, cargos, "Vigente", "02", {
      desdeEm,
      // Reciclagem em POP crítico — gera "a reciclar" na matriz.
      reciclagemMeses: [12, 12, 12, null, null, null, 24, null, null, 12, null, 12, 12][i] ?? null,
      modo: ["POP-GQ-001", "POP-GQ-002", "MTA-CQ-001"].includes(codigo) ? "leitura" : "presencial",
    });
    await insertDoc(d);
    docsVigentes.push(d);
  }

  for (const [codigo, titulo, tipo, depto, cargos] of EM_REVISAO) {
    // Estes JÁ FORAM vigentes: a Rev. anterior está no histórico e segue em vigor
    // na prática, mas a matriz não os enxerga (status ≠ Vigente).
    const d = docBase(codigo, titulo, tipo, depto, cargos, "Em Revisão", "03", {
      desdeEm: null,
      doc: {
        historicoRevisoes: [{
          versao: "02", versaoAlvo: "03", status: "Vigente", data: diasAtras(400),
          responsavel: "Seed de Teste", motivo: "Revisão periódica",
          itemModificado: "Documento completo", descricao: "Atualização de rotina",
        }],
      },
    });
    await insertDoc(d);
  }

  for (const [codigo, titulo, tipo, depto, cargos] of RASCUNHOS) {
    await insertDoc(docBase(codigo, titulo, tipo, depto, cargos, "Rascunho", "00", { desdeEm: null }));
  }
  console.log(`Documentos: ${VIGENTES.length} Vigentes, ${EM_REVISAO.length} Em Revisão, ${RASCUNHOS.length} Rascunho (${VIGENTES.length + EM_REVISAO.length + RASCUNHOS.length} no total)`);

  // ── Evidências ──
  // Cobertura parcial e desigual, como na vida real: parte treinada em dia, parte
  // com reciclagem vencida, parte nunca treinada.
  let n = 0;
  for (const doc of docsVigentes) {
    const cargos = doc.treinamento?.cargos || [];
    const exigidos = pessoasIds.filter(p => cargos.includes(p.cargoId));
    for (let i = 0; i < exigidos.length; i++) {
      const p = exigidos[i];
      // ~25% nunca treinou; dos que treinaram, alguns com data antiga (vence a reciclagem).
      if (i % 4 === 3) continue;
      const antigo = doc.treinamento.reciclagemMeses && i % 3 === 0;
      const dataRealizacao = antigo ? diasAtras(430) : diasAtras(20 + (i * 7) % 120);
      const id = `${MARCA}-${doc.id}-${p.id}`;
      await client.query(
        `INSERT INTO generic_documents (collection, id, data) VALUES ('treinamentos',$1,$2)
         ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data`,
        [id, JSON.stringify({
          id, docId: doc.id, docCodigo: doc.codigo, docTitulo: doc.titulo, versao: doc.versao,
          userId: String(p.id), userName: p.nome, cargoNome: p.cargoNome,
          modo: doc.treinamento.modo, dataRealizacao,
          obs: "Registro do cenário de teste", registradoPor: "Seed de Teste",
          origem: "seed", ts: Date.now() - n, [MARCA]: true,
        })]
      );
      n++;
    }
  }
  console.log(`Evidências de treinamento: ${n}`);

  await client.end();
  console.log("\nCenário pronto. Abra Gestão de Docs → 📚 Matriz de Treinamento.");
  console.log("Repare: a matriz mostra só os 13 Vigentes — os 31 Em Revisão ficam fora do cálculo.");
}

main().catch(e => { console.error(e); process.exit(1); });
