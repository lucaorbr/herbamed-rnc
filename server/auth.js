const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("./db");
const { bloqueadaAte, aposSenhaErrada, tokenValidoParaConta, horaBrasilia } = require("./contas");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET nao definido — defina a variavel de ambiente antes de iniciar");
}
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12;

function publicUser(row) {
  if (!row) return null;
  const data = row.data || {};
  return {
    ...data,
    id: row.id,
    uid: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    setor: row.setor,
    cargo: data.cargo || null,
    crf: row.crf,
    assinatura: row.assinatura,
    permissoes: row.permissoes || {},
    online: row.online,
    ultimoAcesso: row.ultimo_acesso,
    senhaTemporaria: row.senha_temporaria || false,
    ativo: row.ativo !== false,
    bloqueadoAte: bloqueadaAte(row)?.toISOString() || null,
    desativacao: row.desativacao || null,
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, sv: user.sessaoVersao || 0 }, JWT_SECRET, { expiresIn: TOKEN_MAX_AGE_SECONDS });
}

function cookieOptions(token) {
  return `sgq_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TOKEN_MAX_AGE_SECONDS}`;
}

function clearCookie() {
  return "sgq_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)sgq_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function getCurrentUser(req) {
  const token = getToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
    // Conta desativada ou sessões encerradas pelo admin: o token deixa de valer na hora.
    if (!tokenValidoParaConta(payload, result.rows[0])) return null;
    return publicUser(result.rows[0]);
  } catch {
    return null;
  }
}

async function requireUser(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    const error = new Error("Nao autenticado");
    error.status = 401;
    throw error;
  }
  return user;
}

async function requireAdmin(req) {
  const user = await requireUser(req);
  if (user.role !== "admin") {
    const error = new Error("Sem permissao");
    error.status = 403;
    throw error;
  }
  return user;
}

async function login(email, password) {
  const result = await query("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
  const row = result.rows[0];
  const falha = (status, mensagem, extra = {}) => Object.assign(new Error(mensagem), { status, ...extra });

  // Bloqueada vale antes de conferir a senha: senão o bloqueio não segura tentativa nenhuma.
  const ate = row && bloqueadaAte(row);
  if (ate) {
    throw falha(423, `Conta bloqueada por senhas erradas repetidas. Tente de novo depois das ${horaBrasilia(ate)} ou peça ao administrador para desbloquear.`);
  }
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    if (row) {
      const r = aposSenhaErrada(row);
      await query("UPDATE users SET tentativas_falhas = $2, bloqueado_ate = COALESCE($3, bloqueado_ate) WHERE id = $1",
        [row.id, r.tentativas, r.bloquearAte]);
      if (r.bloquearAte) throw falha(401, "Credenciais invalidas", { bloqueou: { row, ate: r.bloquearAte } });
    }
    throw falha(401, "Credenciais invalidas");
  }
  // Senha certa em conta desativada: diz o motivo (quem acertou a senha é o dono).
  if (row.ativo === false) {
    throw falha(403, "Conta desativada. Procure o administrador do sistema.");
  }

  await query("UPDATE users SET online = true, ultimo_acesso = now(), tentativas_falhas = 0, bloqueado_ate = NULL, updated_at = now() WHERE id = $1", [row.id]);
  const fresh = await query("SELECT * FROM users WHERE id = $1", [row.id]);
  const user = publicUser(fresh.rows[0]);
  return { user, token: signToken({ ...user, sessaoVersao: fresh.rows[0].sessao_versao }) };
}

async function verifyPassword(userId, password) {
  const result = await query("SELECT password_hash FROM users WHERE id = $1", [userId]);
  const row = result.rows[0];
  return !!row && bcrypt.compare(password, row.password_hash);
}

module.exports = {
  signToken,
  clearCookie,
  cookieOptions,
  getCurrentUser,
  login,
  publicUser,
  requireAdmin,
  requireUser,
  verifyPassword,
};
