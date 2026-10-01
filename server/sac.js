// SAC — regras de gravação validadas no servidor.
//
// O atendimento guarda dados pessoais do consumidor (nome, CPF, endereço,
// telefone): por isso a leitura também exige permissão — a rota genérica de
// coleções deixaria qualquer usuário logado ler tudo. Mesmo tratamento das
// homologações.
//
// ⚠️ Status, tipos e "quem finaliza" espelham `src/features/sac/sacLogic.js`.

const SAC_ROLE_PERMISSIONS = {
  viewer:  { verSAC: false, registrarSAC: false, tratarSAC: false },
  user:    { verSAC: true,  registrarSAC: true,  tratarSAC: false },
  rt:      { verSAC: true,  registrarSAC: true,  tratarSAC: true },
  keyuser: { verSAC: true,  registrarSAC: true,  tratarSAC: true },
  admin:   { verSAC: true,  registrarSAC: true,  tratarSAC: true },
  exec:    { verSAC: false, registrarSAC: false, tratarSAC: false },
};

const STATUS = { ABERTO: "Em aberto", ANDAMENTO: "Em andamento", FINALIZADO: "Finalizado" };
const TIPOS_SIMPLES = ["Dúvida", "Sugestão", "Elogio"];
const SETOR_QUALIDADE = "Qualidade / Regulatório";

// Decisões técnicas: só a Qualidade (tratarSAC) grava.
const CAMPOS_DA_QUALIDADE = ["rncId", "rncNum", "notificacaoVigilancia", "avaliacao"];
const CAMPOS_DO_FECHAMENTO = ["encerradoPor", "encerradoEm", "solucao", "conclusao"];

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

/** A recepção só finaliza o que não precisa da Qualidade. */
function finalizavelPelaRecepcao(a) {
  return TIPOS_SIMPLES.includes(a?.classificacao)
    && a?.teveReacao !== "Sim"
    && !(a?.encaminhamentos || []).some(e => e.setor === SETOR_QUALIDADE);
}

function validateSACUpdate(user, oldData, data) {
  const podeTratar = hasSACPermission(user, "tratarSAC");

  if (!oldData) {
    requireSACPermission(user, "registrarSAC");
    if (data.status === STATUS.FINALIZADO) {
      if (!podeTratar && !finalizavelPelaRecepcao(data)) throw erro(403, "Este atendimento precisa passar pela Qualidade antes de finalizar");
    } else if (![STATUS.ABERTO, STATUS.ANDAMENTO].includes(data.status)) {
      throw erro(409, "Atendimento novo nasce Em aberto ou Em andamento");
    }
    return;
  }

  // Finalizado é registro fechado: corrigir significa abrir outro atendimento.
  if (oldData.status === STATUS.FINALIZADO) throw erro(409, "Atendimento finalizado nao pode ser alterado");

  if (!podeTratar) {
    requireSACPermission(user, "registrarSAC");
    const mexeu = CAMPOS_DA_QUALIDADE.filter(k => !igual(oldData[k], data[k]));
    if (!igual(oldData.classificacao, data.classificacao)) mexeu.push("classificacao");
    // A recepção registra a CHEGADA da amostra (é ela quem recebe o pacote), não o pedido.
    const { recebida: _r1, ...amostraAntes } = oldData.amostra || {};
    const { recebida: _r2, ...amostraDepois } = data.amostra || {};
    if (!igual(amostraAntes, amostraDepois)) mexeu.push("amostra");
    if (mexeu.length) throw erro(403, `Somente a Qualidade altera: ${mexeu.join(", ")}`);

    if (data.status !== oldData.status) {
      const vaiAndar = oldData.status === STATUS.ABERTO && data.status === STATUS.ANDAMENTO;
      const vaiFinalizar = data.status === STATUS.FINALIZADO && finalizavelPelaRecepcao(data);
      if (!vaiAndar && !vaiFinalizar) throw erro(403, "Este atendimento precisa passar pela Qualidade antes de finalizar");
    }
    if (data.status !== STATUS.FINALIZADO && CAMPOS_DO_FECHAMENTO.some(k => !igual(oldData[k], data[k]))) {
      throw erro(403, "Dados de encerramento so entram ao finalizar");
    }
  }

  // O relato do consumidor é evidência: só cresce no fim, nunca é reescrito.
  if (!String(data.relato || "").startsWith(String(oldData.relato || ""))) {
    throw erro(409, "O relato registrado nao pode ser alterado, apenas complementado");
  }

  // Etapas já registradas são evidência: avaliação, pedido e chegada da amostra.
  const etapas = [
    ["avaliacao", oldData.avaliacao, data.avaliacao],
    ["pedido de amostra", oldData.amostra?.solicitada, data.amostra?.solicitada],
    ["recebimento de amostra", oldData.amostra?.recebida, data.amostra?.recebida],
  ];
  for (const [nome, antes, depois] of etapas) {
    if (antes && !igual(antes, depois)) throw erro(409, `Registro de ${nome} ja gravado nao pode ser alterado`);
  }

  // Respostas ao consumidor: só se acrescentam.
  const antigas = oldData.respostas || [];
  const novas = data.respostas || [];
  if (novas.length < antigas.length || antigas.some((r, i) => !igual(r, novas[i]))) {
    throw erro(409, "Resposta ja registrada nao pode ser alterada nem removida");
  }

  // Encaminhamentos: só se acrescentam; o retorno do setor entra uma vez.
  const encAntes = oldData.encaminhamentos || [];
  const encDepois = data.encaminhamentos || [];
  if (encDepois.length < encAntes.length) throw erro(409, "Encaminhamento ja registrado nao pode ser removido");
  encAntes.forEach((e, i) => {
    const d = encDepois[i] || {};
    const { retorno: rA, ...baseA } = e;
    const { retorno: rD, ...baseD } = d;
    if (!igual(baseA, baseD) || (rA && !igual(rA, rD))) {
      throw erro(409, "Encaminhamento ou retorno do setor ja registrado nao pode ser alterado");
    }
  });
}

function validateSACDelete(user, oldData) {
  if (user?.role !== "admin") throw erro(403, "Apenas administrador pode excluir atendimento");
  if (oldData && oldData.status !== STATUS.ABERTO) throw erro(409, "Somente atendimento ainda Em aberto pode ser excluido");
}

module.exports = {
  SAC_ROLE_PERMISSIONS,
  hasSACPermission,
  requireSACPermission,
  validateSACUpdate,
  validateSACDelete,
  finalizavelPelaRecepcao,
};
