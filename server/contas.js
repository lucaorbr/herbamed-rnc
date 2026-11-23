// Regras de conta de usuário (entrega 4 do plano de segurança das permissões).
//
// - Conta DESATIVADA não entra e perde as sessões abertas, mas o cadastro fica:
//   o nome dela está em assinaturas, RNCs e na trilha. Excluir só quem nunca entrou.
// - Senha errada repetida BLOQUEIA a conta por um tempo (força bruta).
// - Senha temporária é ALEATÓRIA, mostrada uma vez ao admin — antes era fixa
//   ("Herba@123"), ou seja, qualquer um sabia a senha de quem tinha sido resetado.
// - "Encerrar sessões" invalida todo token já emitido, sem trocar a senha.
//   Funciona por versão: o token carrega `sv`; a conta guarda `sessao_versao`.

const crypto = require("crypto");

const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;

// Sem 0/O, 1/l/I: a senha é ditada ou copiada do papel.
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DIGITOS = "23456789";

function sorteia(alfabeto, n) {
  let s = "";
  for (let i = 0; i < n; i++) s += alfabeto[crypto.randomInt(alfabeto.length)];
  return s;
}

/** Ex.: "Kqtw-4827-Hmzp". 12 caracteres sorteados, legível para ditar. */
function gerarSenhaTemporaria() {
  return `${sorteia(LETRAS, 4)}-${sorteia(DIGITOS, 4)}-${sorteia(LETRAS, 4)}`;
}

/** Conta está bloqueada agora? */
function bloqueadaAte(row, agora = Date.now()) {
  const ate = row?.bloqueado_ate ? new Date(row.bloqueado_ate).getTime() : 0;
  return ate > agora ? new Date(ate) : null;
}

/**
 * Depois de uma senha errada: quantas tentativas ficam gravadas e se bloqueia.
 * Ao bloquear, o contador zera — o próximo erro depois do bloqueio recomeça a conta.
 */
function aposSenhaErrada(row, agora = Date.now()) {
  const tentativas = (Number(row?.tentativas_falhas) || 0) + 1;
  if (tentativas >= MAX_TENTATIVAS) {
    return { tentativas: 0, bloquearAte: new Date(agora + MINUTOS_BLOQUEIO * 60 * 1000) };
  }
  return { tentativas, bloquearAte: null };
}

/** Token ainda vale para esta conta? (conta ativa e mesma versão de sessão) */
function tokenValidoParaConta(payload, row) {
  if (!row) return false;
  if (row.ativo === false) return false;
  return (Number(payload?.sv) || 0) === (Number(row.sessao_versao) || 0);
}

/** Pode excluir de vez? Só quem nunca entrou — o resto se desativa. */
function podeExcluirConta(row) {
  return !row?.ultimo_acesso;
}

const horaBrasilia = (d) => new Date(d).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

module.exports = {
  MAX_TENTATIVAS,
  MINUTOS_BLOQUEIO,
  gerarSenhaTemporaria,
  bloqueadaAte,
  aposSenhaErrada,
  tokenValidoParaConta,
  podeExcluirConta,
  horaBrasilia,
};
