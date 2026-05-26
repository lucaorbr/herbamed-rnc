const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "sgqherbamed_dev_secret_change_me";
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
    crf: row.crf,
    assinatura: row.assinatura,
    permissoes: row.permissoes || {},
    online: row.online,
    ultimoAcesso: row.ultimo_acesso,
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_MAX_AGE_SECONDS });
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
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    const error = new Error("Credenciais invalidas");
    error.status = 401;
    throw error;
  }

  await query("UPDATE users SET online = true, ultimo_acesso = now(), updated_at = now() WHERE id = $1", [row.id]);
  const fresh = await query("SELECT * FROM users WHERE id = $1", [row.id]);
  const user = publicUser(fresh.rows[0]);
  return { user, token: signToken(user) };
}

async function verifyPassword(userId, password) {
  const result = await query("SELECT password_hash FROM users WHERE id = $1", [userId]);
  const row = result.rows[0];
  return !!row && bcrypt.compare(password, row.password_hash);
}

module.exports = {
  clearCookie,
  cookieOptions,
  getCurrentUser,
  login,
  publicUser,
  requireAdmin,
  requireUser,
  verifyPassword,
};
