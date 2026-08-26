const HOMOLOGACAO_ROLE_PERMISSIONS = {
  viewer: { verHomologacoes: true, criarHomologacao: false, avaliarHomologacao: false, aprovarHomologacao: false },
  user: { verHomologacoes: true, criarHomologacao: true, avaliarHomologacao: false, aprovarHomologacao: false },
  rt: { verHomologacoes: true, criarHomologacao: true, avaliarHomologacao: true, aprovarHomologacao: true },
  keyuser: { verHomologacoes: true, criarHomologacao: true, avaliarHomologacao: true, aprovarHomologacao: true },
  admin: { verHomologacoes: true, criarHomologacao: true, avaliarHomologacao: true, aprovarHomologacao: true },
  exec: { verHomologacoes: false, criarHomologacao: false, avaliarHomologacao: false, aprovarHomologacao: false },
};

const STATUS_FINAIS = new Set(["Homologada", "Condicional", "Reprovada"]);

function hasHomologacaoPermission(user, key) {
  if (user?.permissoes && Object.prototype.hasOwnProperty.call(user.permissoes, key)) {
    return user.permissoes[key] === true;
  }
  return HOMOLOGACAO_ROLE_PERMISSIONS[user?.role]?.[key] === true;
}

function forbidden(message = "Sem permissao para esta operacao") {
  const error = new Error(message);
  error.status = 403;
  return error;
}

function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

function requireHomologacaoPermission(user, key) {
  if (!hasHomologacaoPermission(user, key)) throw forbidden();
}

function sameUser(a, b) {
  return !!a && !!b && String(a) === String(b);
}

function validateSignatureOwner(signature, user, label) {
  const signerId = signature?.userId || signature?.uid;
  if (!signature || !sameUser(signerId, user?.id)) {
    throw forbidden(`${label} deve pertencer ao usuario autenticado`);
  }
}

function validateHomologacaoUpdate(user, oldData, newData) {
  const oldStatus = oldData?.status || null;
  const newStatus = newData?.status || "Rascunho";

  if (!oldData) {
    requireHomologacaoPermission(user, "criarHomologacao");
    if (newStatus !== "Rascunho") throw conflict("Nova homologacao deve iniciar como Rascunho");
    if (!sameUser(newData?.criadoPorId, user?.id)) throw forbidden("O solicitante deve ser o usuario autenticado");
    return;
  }

  if (STATUS_FINAIS.has(oldStatus)) {
    throw conflict("Homologacao finalizada nao pode ser alterada; abra uma nova revisao");
  }

  if (oldStatus === "Rascunho" && newStatus === "Rascunho") {
    requireHomologacaoPermission(user, "criarHomologacao");
    if (user?.role !== "admin" && !sameUser(oldData.criadoPorId, user?.id)) {
      throw forbidden("Apenas o solicitante pode editar este rascunho");
    }
    return;
  }

  if (oldStatus === "Rascunho" && newStatus === "Em análise") {
    requireHomologacaoPermission(user, "criarHomologacao");
    if (user?.role !== "admin" && !sameUser(oldData.criadoPorId, user?.id)) {
      throw forbidden("Apenas o solicitante pode enviar para analise");
    }
    return;
  }

  if (oldStatus === "Em análise" && newStatus === "Aguardando aprovação") {
    requireHomologacaoPermission(user, "avaliarHomologacao");
    validateSignatureOwner(newData?.parecerTecnico?.assinatura, user, "Assinatura do parecer tecnico");
    if (sameUser(oldData.criadoPorId, user?.id)) {
      throw forbidden("O parecerista deve ser diferente do solicitante");
    }
    return;
  }

  if (oldStatus === "Aguardando aprovação" && STATUS_FINAIS.has(newStatus)) {
    requireHomologacaoPermission(user, "aprovarHomologacao");
    validateSignatureOwner(newData?.decisaoFinal?.assinatura, user, "Assinatura da decisao final");
    if (sameUser(oldData.criadoPorId, user?.id) || sameUser(oldData?.parecerTecnico?.assinatura?.userId, user?.id)) {
      throw forbidden("O aprovador final deve ser diferente do solicitante e do parecerista");
    }
    if (newStatus === "Condicional" && !String(newData?.decisaoFinal?.condicoes || "").trim()) {
      throw conflict("Homologacao condicional exige condicoes registradas");
    }
    return;
  }

  throw conflict(`Transicao de status invalida: ${oldStatus} -> ${newStatus}`);
}

module.exports = {
  HOMOLOGACAO_ROLE_PERMISSIONS,
  STATUS_FINAIS,
  hasHomologacaoPermission,
  requireHomologacaoPermission,
  validateHomologacaoUpdate,
};
