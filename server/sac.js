// SAC — regras de gravação validadas no servidor.
//
// O atendimento guarda dados pessoais do consumidor (nome, telefone, e-mail): por
// isso a leitura também exige permissão — a rota genérica de coleções deixaria
// qualquer usuário logado ler tudo. É o mesmo tratamento das homologações.

const SAC_ROLE_PERMISSIONS = {
  viewer:  { verSAC: false, registrarSAC: false, tratarSAC: false },
  user:    { verSAC: true,  registrarSAC: true,  tratarSAC: false },
  rt:      { verSAC: true,  registrarSAC: true,  tratarSAC: true },
  keyuser: { verSAC: true,  registrarSAC: true,  tratarSAC: true },
  admin:   { verSAC: true,  registrarSAC: true,  tratarSAC: true },
  exec:    { verSAC: false, registrarSAC: false, tratarSAC: false },
};

// Campos que só a Qualidade (tratarSAC) muda: a decisão sobre o atendimento.
const CAMPOS_DA_TRIAGEM = [
  "status", "classificacao", "respostas", "rncId", "rncNum",
  "encerradoPor", "encerradoEm", "conclusao", "notificacaoVigilancia",
];

function hasSACPermission(user, key) {
  if (user?.permissoes && Object.prototype.hasOwnProperty.call(user.permissoes, key)) {
    return user.permissoes[key] === true;
  }
  return SAC_ROLE_PERMISSIONS[user?.role]?.[key] === true;
}

function erro(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function requireSACPermission(user, key) {
  if (!hasSACPermission(user, key)) throw erro(403, "Sem permissao para esta operacao do SAC");
}

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function validateSACUpdate(user, oldData, data) {
  if (!oldData) {
    requireSACPermission(user, "registrarSAC");
    if (data.status !== "Aberto") throw erro(409, "Atendimento novo nasce Aberto");
    return;
  }

  // Encerrado é registro fechado: corrigir significa abrir outro atendimento.
  if (oldData.status === "Encerrado") throw erro(409, "Atendimento encerrado nao pode ser alterado");

  const podeTratar = hasSACPermission(user, "tratarSAC");
  if (!podeTratar) {
    requireSACPermission(user, "registrarSAC");
    const mexeu = CAMPOS_DA_TRIAGEM.filter(k => !igual(oldData[k], data[k]));
    if (mexeu.length) throw erro(403, `Somente a Qualidade altera: ${mexeu.join(", ")}`);
  }

  // O relato do consumidor é evidência: só cresce no fim, nunca é reescrito.
  const relatoAntigo = String(oldData.relato || "");
  if (!String(data.relato || "").startsWith(relatoAntigo)) {
    throw erro(409, "O relato registrado nao pode ser alterado, apenas complementado");
  }

  // Respostas ao consumidor: só se acrescentam.
  const antigas = oldData.respostas || [];
  const novas = data.respostas || [];
  if (novas.length < antigas.length || antigas.some((r, i) => !igual(r, novas[i]))) {
    throw erro(409, "Resposta ja registrada nao pode ser alterada nem removida");
  }
}

function validateSACDelete(user, oldData) {
  if (user?.role !== "admin") throw erro(403, "Apenas administrador pode excluir atendimento");
  if (oldData && oldData.status !== "Aberto") throw erro(409, "Somente atendimento ainda nao triado pode ser excluido");
}

module.exports = {
  SAC_ROLE_PERMISSIONS,
  hasSACPermission,
  requireSACPermission,
  validateSACUpdate,
  validateSACDelete,
};
