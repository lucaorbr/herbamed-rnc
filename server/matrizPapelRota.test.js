// Matriz papel × rota — rede de segurança das permissões no SERVIDOR.
//
// Cada linha diz QUEM pode fazer a ação, com os padrões de cada papel (sem
// permissão customizada no cadastro). Letras: V visualizador, X executivo,
// U usuário, R RT, K keyuser, A admin. "URKA" = usuário, RT, keyuser e admin podem.
//
// Se uma mudança de regra (ou uma tela nova gravando numa coleção) mudar quem pode
// fazer o quê, este teste falha e mostra a linha. Mudança intencional: atualize a
// linha aqui junto, e diga no PR quem ganhou ou perdeu acesso.
//
// As funções `gravar`/`excluir`/`ler` repetem a ordem de checagem de
// handleCollections (server/index.js). Mexeu lá, confira aqui.

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validarGravacaoColecao, validarExclusaoColecao, validarLeituraColecao, validarExclusaoRNC,
  REGRAS_GRAVACAO, REGRAS_LEITURA,
} = require("./permissoesColecao");
const { validarGravacaoCQ, validarExclusaoCQ, ehColecaoCQ } = require("./regrasCQ");
const { validarCriacaoRNC, validarAlteracaoRNC } = require("./regrasRNC");
const { temPermissao, PERMS_PADRAO } = require("./permissoes");

const PAPEIS = { V: "viewer", X: "exec", U: "user", R: "rt", K: "keyuser", A: "admin" };
const usuario = letra => ({ id: `id-${letra}`, name: `Pessoa ${letra}`, role: PAPEIS[letra], permissoes: {} });

const proibido = () => { const e = new Error("Sem permissao"); e.status = 403; throw e; };
const valor = (v, user) => (typeof v === "function" ? v(user) : v);

// Mesma sequência de handleCollections.
function gravar(colecao, dados, anterior = null, id = "x1") {
  return user => {
    if (colecao === "laudos" && !temPermissao(user, "criarLaudos")) proibido();
    const data = valor(dados, user), ant = valor(anterior, user);
    validarGravacaoColecao(user, colecao, data, ant);
    if (ehColecaoCQ(colecao)) validarGravacaoCQ(user, colecao, id, data, ant);
  };
}
function excluir(colecao, anterior = null) {
  return user => {
    if (colecao === "laudos" && !temPermissao(user, "criarLaudos")) proibido();
    validarExclusaoColecao(user, colecao);
    if (colecao === "homologacoes" && user.role !== "admin") proibido();
    if (ehColecaoCQ(colecao)) validarExclusaoCQ(user, colecao, anterior);
  };
}
function ler(colecao) {
  return user => {
    if (colecao === "laudos" && !temPermissao(user, "verLaudos")) proibido();
    if (colecao === "homologacoes" && !temPermissao(user, "verHomologacoes")) proibido();
    validarLeituraColecao(user, colecao);
  };
}

const RNC_ALHEIA = { id: "r1", num: "NC-1", desc: "Original", status: "Em andamento", criadoPor: "Outra pessoa", criadoPorId: "id-outra" };
const rncPropria = user => ({ ...RNC_ALHEIA, criadoPor: user.name, criadoPorId: user.id });
const alterarRNC = (anterior, mudanca) => user => {
  const ant = valor(anterior, user);
  validarAlteracaoRNC(user, ant, { ...ant, ...mudanca });
};

const aprovacao = user => ({ nome: user.name, data: "2026-11-24" });

// [ação, quem pode, função que lança se não pode]
const MATRIZ = [
  // ── Gravação em coleções ──
  ["gravar desvio", "URKA", gravar("desvios", { desc: "x" })],
  ["gravar documento", "URKA", gravar("gestao_docs", { titulo: "x" })],
  ["gravar revalidação", "URKA", gravar("revalidacoes", {})],
  ["gravar revalidação de material gráfico", "URKA", gravar("revalidacoes_grafico", {})],
  ["gravar reunião da RAC", "RKA", gravar("rnc_reunioes", {})],
  ["gravar sessão de treinamento", "RKA", gravar("treinamento_sessoes", {})],
  ["gravar configuração/catálogo", "A", gravar("configuracoes", {})],
  ["gravar colaborador", "A", gravar("colaboradores", {})],
  ["gravar fornecedor", "RKA", gravar("fornecedores", { nome: "x" })],
  ["gravar análise de mistura (IPC)", "URKA", gravar("ipc_registros", {})],
  ["gravar produto do IPC", "KA", gravar("ipc_produtos", {})],
  ["gravar auditoria", "RKA", gravar("auditorias", {})],
  ["gravar cliente terceiro", "RKA", gravar("clientes_terceiros", {})],
  ["gravar FMEA", "URKA", gravar("fmea", {})],
  ["gravar processo de produção", "URKA", gravar("producao_processos", {})],
  ["gravar config. de refugo da produção", "URKA", gravar("producao_config_refugo", {})],
  ["gravar coleção sem regra própria", "URKA", gravar("colecao_nova", {})],
  ["gravar na trilha antiga (audit_log)", "", gravar("audit_log", { acao: "x" })],
  ["lançar análise de CQ", "URKA", gravar("cq_analises", { material: "x" })],
  ["lançar ficha de CQ antiga", "URKA", gravar("cq_fichas", { material: "x" })],
  ["aprovar disposição de análise de CQ", "RKA", gravar("cq_analises", user => ({ material: "x", aprovacaoDisposicao: aprovacao(user) }), { material: "x" })],
  ["editar análise de CQ já aprovada", "RKA", gravar("cq_analises", { material: "y", aprovacaoDisposicao: { nome: "Outra", data: "2026-11-01" } }, { material: "x", aprovacaoDisposicao: { nome: "Outra", data: "2026-11-01" } })],
  ["trocar aprovação de disposição gravada", "", gravar("cq_analises", aprovacao, { aprovacaoDisposicao: { nome: "Outra", data: "2026-11-01" } })],
  ["cadastrar material de CQ", "RKA", gravar("cq_materiais", { nome: "x" }, null, "mat-1")],
  ["criar material Areco pelo recebimento", "URKA", gravar("cq_materiais", { nome: "x" }, null, "areco-123")],
  ["gravar template de ensaio do CQ", "RKA", gravar("cq_templates", { nome: "x" })],
  ["gravar laudo", "RKA", gravar("laudos", {})],
  ["registrar a própria leitura (Li e entendi)", "VXURKA", gravar("treinamentos", user => ({ userId: user.id, modo: "leitura" }))],
  ["registrar treinamento presencial de outra pessoa", "RKA", gravar("treinamentos", { userId: "id-outra", modo: "presencial" })],
  ["registrar abertura de documento de outra pessoa", "RKA", gravar("leitura_aberturas", { userId: "id-outra" })],

  // ── Exclusão em coleções ──
  ["excluir desvio", "URKA", excluir("desvios")],
  ["excluir documento", "KA", excluir("gestao_docs")],
  ["excluir fornecedor", "A", excluir("fornecedores")],
  ["excluir auditoria", "A", excluir("auditorias")],
  ["excluir cliente terceiro", "A", excluir("clientes_terceiros")],
  ["excluir análise de mistura (IPC)", "URKA", excluir("ipc_registros")],
  ["excluir produto do IPC", "KA", excluir("ipc_produtos")],
  ["excluir evidência de treinamento", "A", excluir("treinamentos")],
  ["excluir sessão de treinamento", "A", excluir("treinamento_sessoes")],
  ["excluir homologação (rascunho)", "A", excluir("homologacoes")],
  ["excluir laudo não assinado", "RKA", excluir("laudos")],
  ["excluir análise de CQ em aberto", "URKA", excluir("cq_analises", { material: "x" })],
  ["excluir análise de CQ aprovada", "RKA", excluir("cq_analises", { aprovacaoDisposicao: { nome: "Outra" } })],
  ["excluir material de CQ", "RKA", excluir("cq_materiais", { nome: "x" })],
  ["excluir da trilha antiga (audit_log)", "", excluir("audit_log")],

  // ── Leitura de coleções ──
  ["ler desvios", "VXURKA", ler("desvios")],
  ["ler revalidações", "VXURKA", ler("revalidacoes")],
  ["ler documentos", "VXURKA", ler("gestao_docs")],
  ["ler laudos", "VRKA", ler("laudos")],
  ["ler homologações", "VURKA", ler("homologacoes")],
  ["ler trilha antiga (audit_log)", "A", ler("audit_log")],
  ["ler fornecedores", "VXURKA", ler("fornecedores")],

  // ── RNC (/api/rncs) ──
  ["criar RNC", "URKA", user => validarCriacaoRNC(user, { desc: "x" })],
  ["excluir RNC", "RKA", user => validarExclusaoRNC(user)],
  ["editar o registro da própria RNC", "URKA", alterarRNC(rncPropria, { desc: "Corrigido" })],
  ["editar o registro de RNC de outra pessoa", "RKA", alterarRNC(RNC_ALHEIA, { desc: "Corrigido" })],
  ["registrar plano CAPA", "URKA", alterarRNC(RNC_ALHEIA, { w2h: [{ what: "x" }] })],
  ["encerrar RNC como Eficaz", "URKA", alterarRNC(RNC_ALHEIA, { status: "Eficaz", eficacia: { resultado: "Eficaz" } })],
  ["deliberar a RNC na RAC", "RKA", alterarRNC(RNC_ALHEIA, { ultimaReuniao: { id: "rac-1" } })],
  ["trocar a autoria da RNC", "", alterarRNC(rncPropria, { criadoPor: "Outra pessoa", criadoPorId: "id-outra" })],
  ["trocar a assinatura do elaborador já gravada", "", alterarRNC(
    user => ({ ...rncPropria(user), assinaturaElaborador: { userId: user.id, nome: user.name } }),
    { assinaturaElaborador: { userId: "id-outra", nome: "Outra pessoa" } })],
];

function quemPode(fn) {
  return Object.keys(PAPEIS).filter(letra => {
    try { fn(usuario(letra)); return true; }
    catch (e) {
      if (e.status !== 403 && e.status !== 409) throw e; // erro de programação, não de permissão
      return false;
    }
  }).join("");
}

test("matriz papel × rota: cada ação liberada só para os papéis esperados", () => {
  const divergencias = MATRIZ
    .map(([acao, esperado, fn]) => ({ acao, esperado, obtido: quemPode(fn) }))
    .filter(l => l.obtido !== l.esperado)
    .map(l => `  ${l.acao}: esperado "${l.esperado || "ninguém"}", servidor libera "${l.obtido || "ninguém"}"`);
  assert.equal(divergencias.length, 0, `Permissões mudaram (V visualizador, X executivo, U usuário, R RT, K keyuser, A admin):\n${divergencias.join("\n")}`);
});

test("toda coleção com regra própria de gravação ou leitura está na matriz", () => {
  const naMatriz = MATRIZ.map(([acao]) => acao).join("\n");
  const rotulo = {
    desvios: "desvio", gestao_docs: "documento", revalidacoes: "revalidação", revalidacoes_grafico: "material gráfico",
    rnc_reunioes: "RAC", treinamento_sessoes: "sessão de treinamento", configuracoes: "configuração",
    colaboradores: "colaborador", fornecedores: "fornecedor", ipc_registros: "IPC", ipc_produtos: "produto do IPC",
    auditorias: "auditoria", clientes_terceiros: "cliente terceiro", fmea: "FMEA", producao_processos: "processo de produção",
    producao_config_refugo: "refugo", cq_fichas: "ficha de CQ", cq_analises: "análise de CQ", cq_materiais: "material de CQ",
    cq_templates: "template de ensaio", audit_log: "audit_log",
  };
  const colecoes = [...Object.keys(REGRAS_GRAVACAO), ...Object.keys(REGRAS_LEITURA)];
  const faltando = colecoes.filter(c => !rotulo[c] || !naMatriz.includes(rotulo[c]));
  assert.deepEqual([...new Set(faltando)], [], "Coleção nova com regra própria: acrescente as linhas dela na MATRIZ.");
});

test("a matriz cobre todos os papéis do sistema", () => {
  assert.deepEqual(Object.values(PAPEIS).sort(), Object.keys(PERMS_PADRAO).sort());
});
