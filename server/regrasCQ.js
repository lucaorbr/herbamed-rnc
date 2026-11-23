// Gravação no Controle de Qualidade por AÇÃO (entrega 6 do plano de segurança das
// permissões). Antes qualquer papel de trabalho gravava qualquer coisa no CQ: quem só
// lançava análise também aprovava a disposição e reescrevia o cadastro de material.
//
// Análise (cq_analises, e a ficha antiga cq_fichas):
//   - lançar / editar análise ainda sem disposição aprovada → lancarAnalise (ou editarAnalise)
//   - aprovar a disposição                                  → aprovarAnalise
//   - mexer em análise com disposição já aprovada           → editarAnalise
//   - a aprovação gravada não se troca nem se apaga (409); quem aprova é quem está logado
// Sem segregação analista × aprovador por decisão do usuário ("por enquanto"); a
// configuração `aprovadorDiferenteAnalista` segue valendo só na tela.
//
// Material e templates de ensaio (cq_materiais, cq_templates) → criarMaterialCQ.
// Exceção: o "Iniciar análise" do Recebimento Areco cria o material do item do ERP
// (`areco-<código>`) quando ele ainda não existe — basta lancarAnalise para essa criação.

const { temPermissao } = require("./permissoes");

const COLECOES_ANALISE = new Set(["cq_analises", "cq_fichas"]);
const COLECOES_CADASTRO = new Set(["cq_materiais", "cq_templates"]);

function erro(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const pode = (user, ...keys) => user?.role === "admin" || keys.some(k => temPermissao(user, k));

// Campos que a tela/servidor carimbam sem ser conteúdo da análise.
const semCarimbos = ({ aprovacaoDisposicao, id, ...resto } = {}) => resto;
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function ordenado(v) {
  if (Array.isArray(v)) return v.map(ordenado);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = ordenado(v[k]); return o; }, {});
  }
  return v;
}
const conteudoIgual = (a, b) => igual(ordenado(semCarimbos(a)), ordenado(semCarimbos(b)));

function validarGravacaoAnalise(user, data, anterior) {
  const aprovacaoAntes = anterior?.aprovacaoDisposicao || null;
  const aprovacaoDepois = data?.aprovacaoDisposicao || null;

  if (!igual(ordenado(aprovacaoAntes), ordenado(aprovacaoDepois))) {
    if (aprovacaoAntes) throw erro(409, "Disposicao ja aprovada nao pode ser alterada.");
    if (!pode(user, "aprovarAnalise")) throw erro(403, "Sem permissao para aprovar a disposicao da analise.");
    if (aprovacaoDepois?.nome && user?.name && aprovacaoDepois.nome !== user.name) {
      throw erro(403, "A aprovacao da disposicao deve ser registrada em nome de quem esta logado.");
    }
  }

  if (!anterior || !conteudoIgual(anterior, data)) {
    if (aprovacaoAntes) {
      if (!pode(user, "editarAnalise")) throw erro(403, "Analise com disposicao aprovada: editar exige a permissao \"Editar analise aprovada\".");
    } else if (!pode(user, "lancarAnalise", "editarAnalise")) {
      throw erro(403, "Sem permissao para lancar ou editar analise.");
    }
  }
}

/** Lança 403/409 se `user` não pode gravar `data` (id `id`) na coleção do CQ. */
function validarGravacaoCQ(user, colecao, id, data, anterior) {
  if (COLECOES_ANALISE.has(colecao)) return validarGravacaoAnalise(user, data, anterior);
  if (COLECOES_CADASTRO.has(colecao)) {
    if (pode(user, "criarMaterialCQ")) return;
    const materialAreco = colecao === "cq_materiais" && !anterior && String(id || "").startsWith("areco-");
    if (materialAreco && pode(user, "lancarAnalise")) return;
    throw erro(403, "Sem permissao para criar ou editar material do CQ.");
  }
}

/** Lança 403 se `user` não pode excluir o registro `anterior` da coleção do CQ. */
function validarExclusaoCQ(user, colecao, anterior) {
  if (COLECOES_ANALISE.has(colecao)) {
    const ok = anterior?.aprovacaoDisposicao
      ? pode(user, "editarAnalise")
      : pode(user, "lancarAnalise", "editarAnalise");
    if (!ok) throw erro(403, "Sem permissao para excluir esta analise.");
    return;
  }
  if (COLECOES_CADASTRO.has(colecao) && !pode(user, "criarMaterialCQ")) {
    throw erro(403, "Sem permissao para excluir material do CQ.");
  }
}

const ehColecaoCQ = c => COLECOES_ANALISE.has(c) || COLECOES_CADASTRO.has(c);

module.exports = { validarGravacaoCQ, validarExclusaoCQ, ehColecaoCQ };
