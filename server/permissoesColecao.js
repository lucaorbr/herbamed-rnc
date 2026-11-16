// Quem pode GRAVAR e EXCLUIR em cada coleção — conferido no SERVIDOR.
//
// Até a v3.32.0 a rota genérica /api/collections/:nome/:id aceitava gravação e
// exclusão de qualquer usuário logado: as permissões só escondiam botão na tela, e
// um visualizador com o F12 aberto conseguia alterar desvio, análise de CQ,
// catálogo ou configuração. Só laudos, homologações e a assinatura de documento
// tinham trava própria.
//
// Agora cada coleção tem a regra da tela que a grava:
//   - coleção cuja tela usa uma permissão → exige a mesma permissão;
//   - coleção de tela só do admin (configurações, catálogos, colaboradores) → admin;
//   - coleção cuja tela ainda não usa permissão própria (fornecedores, auditorias,
//     CQ, IPC, produção, FMEA…) → qualquer papel de trabalho, ou seja, barra só os
//     papéis de leitura (viewer, exec). Não muda nada para quem já usa essas telas;
//   - coleção que não está no mapa → mesma regra de papel de trabalho.
//
// Casos especiais:
//   - treinamentos / leitura_aberturas: quem não gere treinamento só grava o PRÓPRIO
//     registro ("Li e entendi" e abertura do documento distribuído);
//   - audit_log: só acrescenta — não se sobrescreve nem se exclui entrada.
//
// A leitura (GET) segue aberta a quem está logado: o sistema carrega várias coleções
// na abertura para a tela inicial e os painéis.

const { temPermissao } = require("./permissoes");

const PAPEIS_SO_LEITURA = new Set(["viewer", "exec"]);

function erro(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const ehAdmin = user => user?.role === "admin";
const algum = (...keys) => user => ehAdmin(user) || keys.some(k => temPermissao(user, k));
const soAdmin = user => ehAdmin(user);
const papelDeTrabalho = user => !!user && !!user.role && !PAPEIS_SO_LEITURA.has(user.role);

const PERMS_DOCUMENTO = [
  "criarDocumento", "assinarElaborador", "assinarRevisorAprovador", "excluirDocumento",
  "iniciarRevisao", "tornarObsoleto", "configurarDocumentos", "registrarTreinamento",
  "gerenciarTreinamento",
];
const PERMS_ANALISE_CQ = ["lancarAnalise", "aprovarAnalise", "editarAnalise"];
const PERMS_TREINAMENTO = ["registrarTreinamento", "gerenciarTreinamento"];

// Permissões que dão direito a gravar RNC (usado em /api/rncs, fora da rota genérica).
// triarDesvio entra porque a conversão de desvio cria a RNC.
const PERMS_RNC = [
  "criarRNC", "editarRNCpropria", "editarRNCtodas", "analisarRNC", "aprovarRNC",
  "gerenciarReunioesRNC", "triarDesvio",
];

const REGRAS_GRAVACAO = {
  desvios: algum("criarDesvio", "triarDesvio"),
  gestao_docs: algum(...PERMS_DOCUMENTO),
  revalidacoes: algum("criarRevalidacao"),
  revalidacoes_grafico: algum("criarRevalidacao"),
  rnc_reunioes: algum("gerenciarReunioesRNC"),
  treinamento_sessoes: algum(...PERMS_TREINAMENTO),
  configuracoes: soAdmin,
  colaboradores: soAdmin,
  // Telas que ainda não usam permissão própria: barra só os papéis de leitura.
  cq_fichas: papelDeTrabalho,
  cq_analises: papelDeTrabalho,
  cq_materiais: papelDeTrabalho,
  cq_templates: papelDeTrabalho,
  fornecedores: papelDeTrabalho,
  clientes_terceiros: papelDeTrabalho,
  auditorias: papelDeTrabalho,
  fmea: papelDeTrabalho,
  ipc_registros: papelDeTrabalho,
  ipc_produtos: papelDeTrabalho,
  producao_processos: papelDeTrabalho,
  producao_config_refugo: papelDeTrabalho,
};

const REGRAS_EXCLUSAO = {
  gestao_docs: algum("excluirDocumento"),
  treinamentos: soAdmin,
  leitura_aberturas: soAdmin,
  treinamento_sessoes: soAdmin,
};

// Coleções em que quem não gere treinamento só mexe no próprio registro.
const COLECOES_DO_PROPRIO = new Set(["treinamentos", "leitura_aberturas"]);

const mesmoUsuario = (a, b) => a != null && b != null && String(a) === String(b);

/** Coleções cuja regra precisa do registro já gravado. */
function precisaDoAnterior(collection) {
  return COLECOES_DO_PROPRIO.has(collection) || collection === "audit_log";
}

/**
 * Lança 403/409 se `user` não pode gravar `data` em `collection`.
 * `anterior`: registro já gravado com o mesmo id (ou null) — só é lido para as
 * coleções de `precisaDoAnterior`.
 */
function validarGravacaoColecao(user, collection, data, anterior = null) {
  if (!user) throw erro(401, "Nao autenticado");

  if (collection === "audit_log") {
    if (anterior) throw erro(409, "Registro de auditoria nao pode ser alterado.");
    return;
  }

  if (COLECOES_DO_PROPRIO.has(collection)) {
    if (algum(...PERMS_TREINAMENTO)(user)) return;
    const proprio = mesmoUsuario(data?.userId, user.id)
      && (!anterior || mesmoUsuario(anterior.userId, user.id));
    if (!proprio) throw erro(403, "Sem permissao para registrar treinamento de outra pessoa.");
    if (collection === "treinamentos" && data?.modo && data.modo !== "leitura") {
      throw erro(403, "Sem permissao para registrar treinamento presencial.");
    }
    return;
  }

  const regra = REGRAS_GRAVACAO[collection] || papelDeTrabalho;
  if (!regra(user)) throw erro(403, "Sem permissao para esta operacao.");
}

/** Lança 403 se `user` não pode excluir registro de `collection`. */
function validarExclusaoColecao(user, collection) {
  if (!user) throw erro(401, "Nao autenticado");
  if (collection === "audit_log") throw erro(403, "Registro de auditoria nao pode ser excluido.");
  const regra = REGRAS_EXCLUSAO[collection] || REGRAS_GRAVACAO[collection] || papelDeTrabalho;
  if (!regra(user)) throw erro(403, "Sem permissao para esta operacao.");
}

/** Gravação em /api/rncs (criar, substituir, mesclar). */
function validarGravacaoRNC(user) {
  if (!algum(...PERMS_RNC)(user)) throw erro(403, "Sem permissao para alterar RNC.");
}

/** Exclusão em /api/rncs/:id. */
function validarExclusaoRNC(user) {
  if (!algum("excluirRNC")(user)) throw erro(403, "Sem permissao para excluir RNC.");
}

/**
 * Campos do próprio cadastro que só o admin altera. Sem isso, qualquer usuário
 * gravava `permissoes` no próprio cadastro e se dava todas as permissões.
 */
const CAMPOS_SO_ADMIN_NO_CADASTRO = ["role", "permissoes"];

// Comparação que ignora a ordem das chaves (o jsonb do Postgres reordena).
function canonico(v) {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = canonico(v[k]); return o; }, {});
  }
  return v;
}
const igual = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

/**
 * Lista o que o usuário tentou alterar sem poder ("*" = cadastro de outra pessoa).
 * Mandar o mesmo valor que já está gravado não conta como alteração.
 */
function camposProibidosNoCadastro(user, alvoId, dados, atual = {}) {
  if (ehAdmin(user)) return [];
  if (!mesmoUsuario(alvoId, user?.id)) return ["*"];
  return CAMPOS_SO_ADMIN_NO_CADASTRO.filter(campo => {
    if (dados?.[campo] === undefined) return false;
    const gravado = atual?.[campo] ?? (campo === "permissoes" ? {} : null);
    return !igual(dados[campo], gravado);
  });
}

module.exports = {
  PAPEIS_SO_LEITURA,
  REGRAS_GRAVACAO,
  precisaDoAnterior,
  validarGravacaoColecao,
  validarExclusaoColecao,
  validarGravacaoRNC,
  validarExclusaoRNC,
  camposProibidosNoCadastro,
};
