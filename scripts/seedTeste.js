/* eslint-disable no-console */
// Cenário de teste realista para a Matriz de Treinamento.
//
// Espelha o perfil do sistema oficial (49 documentos: 13 Vigentes, 1 Em Revisão,
// 35 Rascunho — conferido com o usuário em 2026-08-06) e a realidade de chão de
// fábrica: a maioria das pessoas exigidas em POP é operador.
//
// Só documento VIGENTE entra na matriz (`documentoExigeTreinamento`), e isso está
// certo: não se treina em documento não aprovado. Os 35 rascunhos são documentos
// em elaboração inicial, que nunca vigoraram — eles entram na matriz quando forem
// aprovados. O único Em Revisão é uma Rev.02 de documento que já vigorou.
//
// O limite real que este cenário expõe é outro: toda pessoa exigida precisa ser um
// USUÁRIO do sistema. Aqui os operadores são criados como usuários só para o teste
// rodar; em produção eles não têm login — é o problema que a Fase 6 resolve.
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

// ── Setores de trabalho ───────────────────────────────────────────────────────
// Reproduz o cenário real descrito pelo usuário: encapsulamento, compressão,
// envase e mistura são TODOS "Auxiliar de Produção". O cargo não discrimina —
// quem separa é o setor. É o caso que a regra de interseção da Fase 7 resolve.
const SETORES_NECESSARIOS = {
  PRO: { label: "Produção", setores: [
    { id: "PRO-ENC",  nome: "Encapsulamento" },
    { id: "PRO-COMP", nome: "Compressão" },
    { id: "PRO-ENV",  nome: "Envase" },
    { id: "PRO-MIST", nome: "Mistura" },
  ]},
  CQ:  { label: "Controle de Qualidade", setores: [{ id: "CQ-FQ", nome: "Físico-químico" }] },
  ALM: { label: "Almoxarifado",          setores: [{ id: "ALM-REC", nome: "Recebimento" }] },
  MAN: { label: "Manutenção",            setores: [{ id: "MAN-OF", nome: "Oficina" }] },
  LIM: { label: "Serviços Gerais",       setores: [{ id: "LIM-GER", nome: "Limpeza Geral" }] },
};

// ── Pessoas ───────────────────────────────────────────────────────────────────
// Proporção de fábrica: operação é a maioria. Em produção a maior parte destes
// NÃO teria login — estão aqui como usuários só para o cenário rodar.
const PESSOAS = [
  ["Adriana Moreira",       "operador-de-encapsulamento",          "Produção", "PRO-ENC"],
  ["Bruno Cardoso",         "operador-de-encapsulamento",          "Produção", "PRO-ENC"],
  ["Cleber Antunes",        "operador-de-encapsulamento",          "Produção", "PRO-ENC"],
  ["Daniela Prado",         "operador-de-compressao",              "Produção", "PRO-COMP"],
  ["Edson Vilela",          "operador-de-compressao",              "Produção", "PRO-COMP"],
  ["Fabiana Rocha",         "operador-de-embalagem",               "Produção", "PRO-ENV"],
  ["Gilberto Nunes",        "operador-de-embalagem",               "Produção", "PRO-ENV"],
  ["Helena Marques",        "operador-de-embalagem",               "Produção", "PRO-ENV"],
  ["Ivan Siqueira",         "auxiliar-de-producao",                "Produção", "PRO-MIST"],
  ["Joana Ferraz",          "auxiliar-de-producao",                "Produção", "PRO-MIST"],
  ["Kleber Dias",           "auxiliar-de-producao",                "Produção", "PRO-MIST"],
  ["Larissa Amorim",        "supervisor-de-producao",              "Produção", "PRO-ENC"],
  ["Marcelo Tavares",       "supervisor-de-producao",              "Produção", "PRO-COMP"],
  ["Natália Bezerra",       "analista-de-controle-de-qualidade",   "Qualidade", "CQ-FQ"],
  ["Otávio Lins",           "analista-de-controle-de-qualidade",   "Qualidade", "CQ-FQ"],
  ["Paula Rezende",         "auxiliar-de-laboratorio",             "Qualidade", "CQ-FQ"],
  ["Quésia Martins",        "farmaceutico-responsavel-tecnico",    "Qualidade", "CQ-FQ"],
  ["Rafael Coutinho",       "assistente-de-garantia-da-qualidade", "Qualidade", "CQ-FQ"],
  ["Simone Barros",         "almoxarife",                          "Almoxarifado", "ALM-REC"],
  ["Tiago Peixoto",         "almoxarife",                          "Almoxarifado", "ALM-REC"],
  ["Vanessa Lopes",         "auxiliar-de-limpeza",                 "Serviços Gerais", "LIM-GER"],
  ["Wagner Estevam",        "tecnico-de-manutencao",               "Manutenção", "MAN-OF"],
];

// Quais documentos exigem por SETOR (Fase 7). Vazio = só por cargo, como antes.
const SETORES_POR_DOC = {
  "POP-PRO-001": ["PRO"],        // área inteira: higienização vale para toda a produção
  "POP-PRO-002": ["PRO-ENC"],    // interseção com o cargo: encapsuladora, só no encapsulamento
  "POP-PRO-003": ["PRO-COMP"],   // interseção com o cargo: compressora, só na compressão
  "EPI-SSM-001": ["PRO", "ALM", "MAN", "LIM"], // EPI: várias áreas, qualquer cargo
};

// Documentos que valem para TODO MUNDO do setor, independente do cargo — o filtro
// de cargo é limpo para não virar interseção sem querer.
const SO_POR_SETOR = new Set(["POP-PRO-001", "EPI-SSM-001"]);

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
  const exige = cargos.length > 0 || (extra.setores || []).length > 0;
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
      setores: extra.setores || [],
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
  // Recriar os usuários gera ids novos, então colaboradores vinculados aos antigos
  // ficariam órfãos — apontando para conta inexistente e fora de sincronia com as
  // evidências. Some com eles aqui para o cenário nascer coerente.
  const delColab = await client.query(
    `DELETE FROM generic_documents g
      WHERE g.collection = 'colaboradores'
        AND g.data->>'userId' IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id::text = g.data->>'userId')`
  );
  console.log(`Limpeza: ${delDocs.rowCount} registro(s), ${delUsers.rowCount} usuário(s) e ${delColab.rowCount} colaborador(es) órfão(s) removidos.`);
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

  // ── Áreas e setores ──
  // MERGE, não sobrescrita: este catálogo é compartilhado com a distribuição de
  // cópias físicas (PR #56). Só acrescenta o que falta, preservando o que existe.
  {
    const atual = (await client.query(
      `SELECT data FROM generic_documents WHERE collection='configuracoes' AND id='catalogo_areas_setores_distribuicao'`
    )).rows[0]?.data || { id: "catalogo_areas_setores_distribuicao", items: [] };
    const items = [...(atual.items || [])];
    for (const [areaId, def] of Object.entries(SETORES_NECESSARIOS)) {
      let area = items.find(a => a.id === areaId);
      if (!area) { area = { id: areaId, label: def.label, ativo: true, setores: [] }; items.push(area); }
      area.setores = area.setores || [];
      for (const s of def.setores) {
        if (!area.setores.some(x => x.id === s.id)) area.setores.push({ ...s, ativo: true });
      }
    }
    await client.query(
      `INSERT INTO generic_documents (collection, id, data) VALUES ('configuracoes','catalogo_areas_setores_distribuicao',$1)
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify({ ...atual, id: "catalogo_areas_setores_distribuicao", items })]
    );
    console.log(`Áreas/setores: ${items.length} área(s), ${items.reduce((n, a) => n + (a.setores || []).length, 0)} setor(es)`);
  }

  // ── Pessoas ──
  const hash = await bcrypt.hash(SENHA_PADRAO, 10);
  const pessoasIds = [];
  for (const [nome, cargoId, setor, setorId] of PESSOAS) {
    const email = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z ]/gu, "").trim().split(/\s+/).join(".") + "@teste.local";
    const cargoNome = CARGOS.find(c => c.id === cargoId)?.nome || "";
    const r = await client.query(
      `INSERT INTO users (name, email, password_hash, role, setor, permissoes, data)
       VALUES ($1,$2,$3,'user',$4,'{}'::jsonb,$5) RETURNING id`,
      [nome, email, hash, setor, JSON.stringify({ cargo: cargoNome, cargoId, [MARCA]: true })]
    );
    pessoasIds.push({ id: r.rows[0].id, nome, cargoId, cargoNome, setor, setorId });
  }
  console.log(`Pessoas: ${pessoasIds.length} (senha padrão: ${SENHA_PADRAO})`);

  // ── Colaboradores ──
  // Criados direto, com o MESMO id do usuário — a invariante da Fase 6 que mantém
  // toda evidência já gravada resolvendo. Aqui todos têm login porque é cenário de
  // teste; em produção a maioria não teria.
  for (const p of pessoasIds) {
    const setorNome = Object.values(SETORES_NECESSARIOS)
      .flatMap(a => a.setores).find(s => s.id === p.setorId)?.nome || p.setor;
    await client.query(
      `INSERT INTO generic_documents (collection, id, data) VALUES ('colaboradores',$1,$2)
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data`,
      [String(p.id), JSON.stringify({
        id: String(p.id), nome: p.nome, matricula: "",
        cargoId: p.cargoId, cargoNome: p.cargoNome,
        setorId: p.setorId || null, setor: setorNome || "",
        dataAdmissao: null, userId: String(p.id), ativo: true,
        origem: "seed", criadoEm: new Date().toISOString(), [MARCA]: true,
      })]
    );
  }
  console.log(`Colaboradores: ${pessoasIds.length} (com setor vinculado)`);

  // ── Documentos ──
  const insertDoc = (d) => client.query(
    `INSERT INTO generic_documents (collection, id, data) VALUES ('gestao_docs',$1,$2)
     ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data`,
    [d.id, JSON.stringify(d)]
  );

  const docsVigentes = [];
  for (let i = 0; i < VIGENTES.length; i++) {
    const [codigo, titulo, tipo, depto, cargosOrig] = VIGENTES[i];
    const cargos = SO_POR_SETOR.has(codigo) ? [] : cargosOrig;
    // Espalha o relógio do prazo: alguns dentro do prazo, outros já estourados.
    const desdeEm = diasAtras([10, 20, 45, 90, 200, 15, 60, 120, 25, 300, 40, 5, 180][i] || 30);
    const d = docBase(codigo, titulo, tipo, depto, cargos, "Vigente", "02", {
      desdeEm,
      // Reciclagem em POP crítico — gera "a reciclar" na matriz.
      reciclagemMeses: [12, 12, 12, null, null, null, 24, null, null, 12, null, 12, 12][i] ?? null,
      modo: ["POP-GQ-001", "POP-GQ-002", "MTA-CQ-001"].includes(codigo) ? "leitura" : "presencial",
      // Exemplos das três formas de exigir (Fase 7), para o cenário exercitar a regra:
      //  · POP-PRO-001 → só ÁREA: higienização vale para toda a produção, qualquer cargo
      //  · POP-PRO-002 → INTERSEÇÃO: quem opera a encapsuladora é o pessoal DAQUELE setor
      //  · POP-PRO-003 → INTERSEÇÃO: idem para a compressora
      //  · demais      → só cargo, como antes
      setores: SETORES_POR_DOC[codigo] || [],
    });
    await insertDoc(d);
    docsVigentes.push(d);
  }

  // Um único Em Revisão, como no sistema oficial: documento que JÁ vigorou e está
  // sendo revisado para a Rev.02. Enquanto a revisão não é aprovada ele fica fora
  // da matriz — janela pequena e conhecida, não é lacuna a corrigir.
  {
    const [codigo, titulo, tipo, depto, cargos] = EM_REVISAO[0];
    await insertDoc(docBase(codigo, titulo, tipo, depto, cargos, "Em Revisão", "02", {
      desdeEm: null,
      doc: {
        historicoRevisoes: [{
          versao: "01", versaoAlvo: "02", status: "Vigente", data: diasAtras(400),
          responsavel: "Seed de Teste", motivo: "Revisão periódica",
          itemModificado: "Documento completo", descricao: "Atualização de rotina",
        }],
      },
    }));
  }

  // O resto é rascunho: documento em elaboração inicial, que nunca vigorou.
  const rascunhos = [...EM_REVISAO.slice(1), ...RASCUNHOS];
  for (const [codigo, titulo, tipo, depto, cargos] of rascunhos) {
    await insertDoc(docBase(codigo, titulo, tipo, depto, cargos, "Rascunho", "00", { desdeEm: null }));
  }
  console.log(`Documentos: ${VIGENTES.length} Vigentes, 1 Em Revisão, ${rascunhos.length} Rascunho (${VIGENTES.length + 1 + rascunhos.length} no total)`);

  // ── Evidências ──
  // Cobertura parcial e desigual, como na vida real: parte treinada em dia, parte
  // com reciclagem vencida, parte nunca treinada.
  let n = 0;
  for (const doc of docsVigentes) {
    // Mesma regra da Fase 7: cargo ∩ setor quando os dois existem.
    const cargos = doc.treinamento?.cargos || [];
    const setores = doc.treinamento?.setores || [];
    const areaDe = (sid) => Object.entries(SETORES_NECESSARIOS).find(([, a]) => a.setores.some(x => x.id === sid))?.[0] || null;
    const casaSetor = (p) => !!p.setorId && (setores.includes(p.setorId) || setores.includes(areaDe(p.setorId)));
    const casaCargo = (p) => cargos.includes(p.cargoId);
    const exigidos = pessoasIds.filter(p =>
      cargos.length && setores.length ? casaCargo(p) && casaSetor(p)
      : cargos.length ? casaCargo(p)
      : setores.length ? casaSetor(p) : false);
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
  console.log("A matriz mostra os 13 Vigentes — rascunho não exige treinamento, e isso está correto.");
}

main().catch(e => { console.error(e); process.exit(1); });
