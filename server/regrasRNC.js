// Gravação de RNC por AÇÃO (entrega 6 do plano de segurança das permissões, parte b).
//
// Até a v3.38.0 o servidor só exigia "alguma permissão de RNC" para gravar: quem
// tinha "Criar RNC" alterava o registro de qualquer RNC, e "Editar RNC própria" /
// "Editar qualquer RNC" não controlavam nada (a tela usava só "foi você quem criou").
//
// Agora o servidor compara a RNC gravada com a que vai ser gravada e confere cada
// campo que mudou:
//   - campos do REGISTRO (descrição, contenção, produto, lote, NF, setor, responsável,
//     prazos…) → "Editar qualquer RNC", ou "Editar RNC própria" se a pessoa é o autor;
//   - campos do TRATAMENTO (investigação, Ishikawa, 5 Porquês, CAPA, eficácia,
//     disposição, resposta/avaliação do fornecedor, reuniões internas…) → "Tratar RNC";
//   - deliberação da RAC (`ultimaReuniao`) → "Gerenciar reuniões de RNC";
//   - vínculo da RNC sucessora numa ineficaz (`rncSucessora`) → "Criar RNC";
//   - status, prazo da ação corretiva e histórico mudam junto com qualquer uma das
//     ações acima (todas elas gravam isso), com duas travas no status: Eficaz/Ineficaz
//     só por quem trata a RNC, e Encerrada por quem trata ou pela RAC;
//   - assinatura do elaborador: só o autor (ou o admin), em nome de quem está logado,
//     e não se troca depois de gravada;
//   - autoria (`criadoPor`, `criadoPorId`) não muda depois da criação.
// O admin pode tudo. Campo fora das listas conta como tratamento.

const { temPermissao } = require("./permissoes");

function erro(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const ehAdmin = user => user?.role === "admin";
const pode = (user, ...keys) => ehAdmin(user) || keys.some(k => temPermissao(user, k));

// Permissões que dão direito a CRIAR RNC (POST). triarDesvio converte desvio em RNC.
const PERMS_CRIAR_RNC = ["criarRNC", "triarDesvio"];
// Qualquer gravação em RNC existente exige ao menos uma destas.
const PERMS_ALTERAR_RNC = ["criarRNC", "editarRNCpropria", "editarRNCtodas", "analisarRNC", "gerenciarReunioesRNC", "triarDesvio"];

// Campos do formulário de registro / "Editar registro" da ficha.
const CAMPOS_REGISTRO = new Set([
  "num", "data", "tipoRnc", "tipo", "sev", "produto", "fornecedor", "setor", "detector",
  "desc", "lote", "nf", "ordemCompra", "qtd", "ref", "evidencia", "anexos",
  "contencao", "respCont", "dataContencao", "resp", "prazoCausa", "prazoEfic",
  "prazoRespostaFornecedor", "origemAnalise", "origemDesvio", "origemDesvioNum",
  "origemRnc", "origemRncNum",
]);
// Gravados por mais de uma ação (registro, tratamento, RAC).
const CAMPOS_COMPARTILHADOS = new Set([
  "historico", "status", "prazoAC", "modoPrazo", "justificativaPrazo", "proximaReavaliacao",
]);
const CAMPOS_AUTORIA = new Set(["criadoPor", "criadoPorId"]);
// `tipoRnc` também muda no tratamento ("converter em interna").
const CAMPOS_REGISTRO_OU_TRATAMENTO = new Set(["tipoRnc"]);

const vazio = v => v === undefined || v === null || v === ""
  || (Array.isArray(v) && v.length === 0);
function canonico(v) {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = canonico(v[k]); return o; }, {});
  }
  return v;
}
const igual = (a, b) => (vazio(a) && vazio(b)) || JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

/** Campos cujo valor difere entre a RNC gravada e a nova (ignora id). */
function camposAlterados(anterior, novo) {
  const chaves = new Set([...Object.keys(anterior || {}), ...Object.keys(novo || {})]);
  chaves.delete("id");
  return [...chaves].filter(k => !igual(anterior?.[k], novo?.[k])).sort();
}

const mesmo = (a, b) => a != null && b != null && String(a).trim() !== "" && String(a) === String(b);

/** A RNC é da pessoa: foi ela quem registrou (ou consta como quem detectou). */
function rncPropria(rnc, user) {
  if (!rnc || !user) return false;
  if (mesmo(rnc.criadoPorId, user.id)) return true;
  return mesmo(rnc.criadoPor, user.name) || mesmo(rnc.detector, user.name);
}

const TERMINAIS_EFICACIA = new Set(["Eficaz", "Ineficaz"]);

/**
 * Lança 403/409 se `user` não pode transformar `anterior` em `novo`.
 * `anterior` é a RNC gravada (obrigatória: criação passa por validarCriacaoRNC).
 */
function validarAlteracaoRNC(user, anterior, novo) {
  if (!user) throw erro(401, "Nao autenticado");
  if (!pode(user, ...PERMS_ALTERAR_RNC)) throw erro(403, "Sem permissao para alterar RNC.");

  const alterados = camposAlterados(anterior, novo);
  if (!alterados.length) return;

  // Imutáveis para todos, admin inclusive: quem registrou e a assinatura já gravada.
  if (alterados.some(c => CAMPOS_AUTORIA.has(c))) throw erro(409, "A autoria da RNC nao pode ser alterada.");
  if (alterados.includes("assinaturaElaborador")) {
    if (anterior.assinaturaElaborador) throw erro(409, "Assinatura do elaborador ja registrada nao pode ser alterada.");
    // Só quem registrou a RNC assina como elaborador, em nome próprio — admin inclusive.
    if (!rncPropria(anterior, user)) throw erro(403, "Sem permissao para alterar: assinatura do elaborador (so o autor da RNC assina).");
    const ass = novo.assinaturaElaborador;
    const dono = ass?.userId || ass?.uid;
    if (dono != null && !mesmo(dono, user.id)) throw erro(403, "A assinatura deve pertencer ao usuario autenticado.");
  }
  if (ehAdmin(user)) return;

  const propria = rncPropria(anterior, user);
  const podeRegistro = pode(user, "editarRNCtodas") || (propria && pode(user, "editarRNCpropria"));
  const podeTratar = pode(user, "analisarRNC");
  const podeRac = pode(user, "gerenciarReunioesRNC");
  const negados = [];

  for (const campo of alterados) {
    if (CAMPOS_AUTORIA.has(campo)) throw erro(409, "A autoria da RNC nao pode ser alterada.");

    if (campo === "assinaturaElaborador") continue; // conferida acima, para todos

    if (campo === "status") {
      const st = novo.status;
      if (TERMINAIS_EFICACIA.has(st)) { if (!podeTratar) negados.push(`status ${st}`); continue; }
      if (st === "Encerrada") { if (!podeTratar && !podeRac) negados.push("status Encerrada"); continue; }
      if (!podeRegistro && !podeTratar && !podeRac) negados.push("status");
      continue;
    }

    if (CAMPOS_COMPARTILHADOS.has(campo)) {
      if (campo === "historico" || podeRegistro || podeTratar || podeRac) continue;
      negados.push(campo);
      continue;
    }

    if (campo === "ultimaReuniao") { if (!podeRac) negados.push(campo); continue; }
    if (campo === "rncSucessora") { if (!pode(user, "criarRNC")) negados.push(campo); continue; }

    if (CAMPOS_REGISTRO_OU_TRATAMENTO.has(campo)) { if (!podeRegistro && !podeTratar) negados.push(campo); continue; }
    if (CAMPOS_REGISTRO.has(campo)) { if (!podeRegistro) negados.push(campo); continue; }
    if (!podeTratar) negados.push(campo);
  }

  if (negados.length) {
    const registro = negados.some(c => CAMPOS_REGISTRO.has(c));
    const dica = registro && !propria && pode(user, "editarRNCpropria")
      ? " Esta RNC nao foi registrada por voce: editar exige \"Editar qualquer RNC\"."
      : "";
    throw erro(403, `Sem permissao para alterar: ${negados.join(", ")}.${dica}`);
  }
}

/** Lança 403 se `user` não pode criar RNC. */
function validarCriacaoRNC(user, data = {}) {
  if (!user) throw erro(401, "Nao autenticado");
  if (!pode(user, ...PERMS_CRIAR_RNC)) throw erro(403, "Sem permissao para criar RNC.");
  const ass = data?.assinaturaElaborador;
  const dono = ass?.userId || ass?.uid;
  if (dono != null && !mesmo(dono, user.id)) throw erro(403, "A assinatura deve pertencer ao usuario autenticado.");
}

/** Carimba a autoria na criação: quem está logado, nunca o que veio no corpo. */
function comAutoria(data, user) {
  return { ...data, criadoPor: user?.name || data.criadoPor || "", criadoPorId: user?.id != null ? String(user.id) : (data.criadoPorId || "") };
}

module.exports = {
  validarAlteracaoRNC, validarCriacaoRNC, comAutoria, camposAlterados, rncPropria,
  CAMPOS_REGISTRO,
};
