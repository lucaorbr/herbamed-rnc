const http = require("http");
const bcrypt = require("bcryptjs");
const { migrate } = require("./migrate");
const { query, transaction } = require("./db");
const {
  clearCookie,
  cookieOptions,
  getCurrentUser,
  login,
  publicUser,
  requireAdmin,
  requireUser,
  verifyPassword,
} = require("./auth");
const { runArecoSync, startArecoScheduler } = require("./arecoSync");

const PORT = Number(process.env.PORT || 9028);

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj, (_, value) => (value === undefined ? null : value)));
}

function parseUrl(req) {
  return new URL(req.url, `http://${req.headers.host || "localhost"}`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10_000_000) {
        req.destroy();
        reject(new Error("Payload muito grande"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON invalido"));
      }
    });
    req.on("error", reject);
  });
}

async function handleClaude(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return sendJson(res, 503, { error: "ANTHROPIC_API_KEY nao configurada" });

  const body = await readBody(req);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      ...body,
    }),
  });

  const data = await response.json();
  return sendJson(res, response.ok ? 200 : response.status, data);
}

async function handleAuth(req, res, pathname) {
  if (pathname === "/api/auth/login" && req.method === "POST") {
    const { email, password } = await readBody(req);
    const result = await login(email, password);
    return sendJson(res, 200, { user: result.user, token: result.token }, { "Set-Cookie": cookieOptions(result.token) });
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const user = await getCurrentUser(req);
    if (user?.id) await query("UPDATE users SET online = false, updated_at = now() WHERE id = $1", [user.id]);
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearCookie() });
  }

  if (pathname === "/api/auth/me" && req.method === "GET") {
    const user = await getCurrentUser(req);
    return sendJson(res, 200, { user });
  }

  if (pathname === "/api/auth/verify-password" && req.method === "POST") {
    const user = await requireUser(req);
    const { password } = await readBody(req);
    const ok = await verifyPassword(user.id, password);
    return sendJson(res, ok ? 200 : 401, ok ? { ok: true } : { error: "Senha incorreta" });
  }

  return false;
}

async function handleUsers(req, res, pathname) {
  if (pathname === "/api/users" && req.method === "GET") {
    await requireUser(req);
    const result = await query("SELECT * FROM users ORDER BY name");
    return sendJson(res, 200, result.rows.map(publicUser));
  }

  if (pathname === "/api/users" && req.method === "POST") {
    await requireAdmin(req);
    const data = sanitize(await readBody(req));
    const password = data.pw || data.password || "Herbamed@2025";
    const passwordHash = await bcrypt.hash(password, 12);
    const payload = { ...data, pw: undefined, password: undefined };
    const result = await query(`
      INSERT INTO users (name, email, password_hash, role, setor, crf, assinatura, permissoes, data)
      VALUES ($1, lower($2), $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
      RETURNING *
    `, [
      data.name,
      data.email,
      passwordHash,
      data.role || "user",
      data.setor || null,
      data.crf || null,
      data.assinatura ? JSON.stringify(data.assinatura) : null,
      JSON.stringify(data.permissoes || {}),
      JSON.stringify(payload),
    ]);
    return sendJson(res, 201, publicUser(result.rows[0]));
  }

  const match = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (!match) return false;
  const id = decodeURIComponent(match[1]);

  if (req.method === "GET") {
    await requireUser(req);
    const result = await query("SELECT * FROM users WHERE id = $1", [id]);
    return sendJson(res, result.rowCount ? 200 : 404, result.rowCount ? publicUser(result.rows[0]) : { error: "Usuario nao encontrado" });
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    await requireUser(req);
    const data = sanitize(await readBody(req));
    const existing = await query("SELECT data FROM users WHERE id = $1", [id]);
    if (!existing.rowCount) return sendJson(res, 404, { error: "Usuario nao encontrado" });
    const merged = { ...(existing.rows[0].data || {}), ...data };
    const result = await query(`
      UPDATE users SET
        name = COALESCE($2, name),
        email = COALESCE(lower($3), email),
        role = COALESCE($4, role),
        setor = COALESCE($5, setor),
        crf = COALESCE($6, crf),
        assinatura = COALESCE($7::jsonb, assinatura),
        permissoes = COALESCE($8::jsonb, permissoes),
        online = COALESCE($9, online),
        ultimo_acesso = COALESCE($10, ultimo_acesso),
        data = $11::jsonb,
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [
      id,
      data.name ?? null,
      data.email ?? null,
      data.role ?? null,
      data.setor ?? null,
      data.crf ?? null,
      data.assinatura === undefined ? null : JSON.stringify(data.assinatura),
      data.permissoes === undefined ? null : JSON.stringify(data.permissoes),
      data.online === undefined ? null : data.online,
      data.ultimoAcesso || data.ultimo_acesso || null,
      JSON.stringify(merged),
    ]);
    return sendJson(res, 200, publicUser(result.rows[0]));
  }

  if (req.method === "DELETE") {
    await requireAdmin(req);
    await query("DELETE FROM users WHERE id = $1", [id]);
    return sendJson(res, 200, { ok: true });
  }

  return false;
}

async function handleRncs(req, res, pathname) {
  if (pathname === "/api/rncs" && req.method === "GET") {
    await requireUser(req);
    const result = await query("SELECT data FROM rncs ORDER BY updated_at DESC");
    return sendJson(res, 200, result.rows.map(row => row.data));
  }

  const match = pathname.match(/^\/api\/rncs\/([^/]+)$/);
  if (!match) return false;
  await requireUser(req);
  const id = decodeURIComponent(match[1]);

  if (req.method === "PUT" || req.method === "POST") {
    const data = sanitize(await readBody(req));
    await query(`
      INSERT INTO rncs (id, num, status, sev, resp, prazo_ac, data, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now())
      ON CONFLICT (id) DO UPDATE SET
        num = EXCLUDED.num,
        status = EXCLUDED.status,
        sev = EXCLUDED.sev,
        resp = EXCLUDED.resp,
        prazo_ac = EXCLUDED.prazo_ac,
        data = EXCLUDED.data,
        updated_at = now()
    `, [id, data.num || null, data.status || null, data.sev || null, data.resp || null, data.prazoAC || null, JSON.stringify({ ...data, id })]);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "PATCH") {
    const patch = sanitize(await readBody(req));
    const existing = await query("SELECT data FROM rncs WHERE id = $1", [id]);
    if (!existing.rowCount) return sendJson(res, 404, { error: "RNC nao encontrada" });
    const data = { ...(existing.rows[0].data || {}), ...patch, id };
    await query(`
      UPDATE rncs SET num=$2,status=$3,sev=$4,resp=$5,prazo_ac=$6,data=$7::jsonb,updated_at=now()
      WHERE id=$1
    `, [id, data.num || null, data.status || null, data.sev || null, data.resp || null, data.prazoAC || null, JSON.stringify(data)]);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "DELETE") {
    await query("DELETE FROM rncs WHERE id = $1", [id]);
    return sendJson(res, 200, { ok: true });
  }

  return false;
}

async function handleCounters(req, res, pathname) {
  if (pathname === "/api/counters/peek-daily" && req.method === "GET") {
    await requireUser(req);
    const key = dailyCounterKey();
    const result = await query("SELECT value FROM counters WHERE key = $1", [key]);
    const next = result.rowCount ? result.rows[0].value + 1 : 1;
    return sendJson(res, 200, { value: dailyCounterNumber(next) });
  }

  if (pathname === "/api/counters/increment-daily" && req.method === "POST") {
    await requireUser(req);
    const value = await transaction(async client => {
      const key = dailyCounterKey();
      const result = await client.query(`
        INSERT INTO counters (key, value, updated_at)
        VALUES ($1, 1, now())
        ON CONFLICT (key) DO UPDATE SET value = counters.value + 1, updated_at = now()
        RETURNING value
      `, [key]);
      return result.rows[0].value;
    });
    return sendJson(res, 200, { value: dailyCounterNumber(value) });
  }

  return false;
}

function dailyCounterKey() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return `counter_${dd}${mm}${yy}`;
}

function dailyCounterNumber(value) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}${value}`;
}

async function handleCollections(req, res, pathname) {
  const match = pathname.match(/^\/api\/collections\/([^/]+)(?:\/(.+))?$/);
  if (!match) return false;
  await requireUser(req);
  const collection = decodeURIComponent(match[1]);
  const id = match[2] ? decodeURIComponent(match[2]) : null;

  if (!id && req.method === "GET") {
    const result = await query(`
      SELECT id, data FROM generic_documents
      WHERE collection = $1
      ORDER BY updated_at DESC
    `, [collection]);
    return sendJson(res, 200, result.rows.map(row => ({ id: row.id, ...row.data })));
  }

  if (id && (req.method === "PUT" || req.method === "POST")) {
    const data = sanitize(await readBody(req));
    await query(`
      INSERT INTO generic_documents (collection, id, data, updated_at)
      VALUES ($1,$2,$3::jsonb,now())
      ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `, [collection, id, JSON.stringify({ ...data, id })]);
    return sendJson(res, 200, { ok: true });
  }

  if (id && req.method === "DELETE") {
    await query("DELETE FROM generic_documents WHERE collection = $1 AND id = $2", [collection, id]);
    return sendJson(res, 200, { ok: true });
  }

  return false;
}

async function handleAreco(req, res, pathname, url) {
  if (pathname === "/api/areco/recebimentos" && req.method === "GET") {
    await requireUser(req);
    const status = url.searchParams.get("status");
    const params = [];
    let where = "";
    if (status) {
      params.push(status);
      where = "WHERE status = $1";
    }
    const result = await query(`
      SELECT * FROM areco_recebimentos
      ${where}
      ORDER BY data_entrada DESC NULLS LAST, imported_at DESC
      LIMIT 500
    `, params);
    return sendJson(res, 200, result.rows);
  }

  if (pathname === "/api/areco/sync/status" && req.method === "GET") {
    await requireUser(req);
    const result = await query("SELECT * FROM areco_sync_state ORDER BY source");
    return sendJson(res, 200, result.rows);
  }

  if (pathname === "/api/areco/sync/run" && req.method === "POST") {
    await requireAdmin(req);
    const result = await runArecoSync();
    return sendJson(res, 200, result);
  }

  return false;
}

async function route(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const url = parseUrl(req);
  const pathname = url.pathname;

  if (pathname === "/health") {
    try {
      await query("SELECT 1");
      return sendJson(res, 200, { status: "ok", service: "backend", database: "ok" });
    } catch (error) {
      return sendJson(res, 503, { status: "error", service: "backend", database: error.message });
    }
  }

  if (pathname.startsWith("/api/claude")) return handleClaude(req, res);

  const handlers = [handleAuth, handleUsers, handleRncs, handleCounters, handleCollections];
  for (const handler of handlers) {
    const handled = await handler(req, res, pathname, url);
    if (handled !== false) return handled;
  }

  const arecoHandled = await handleAreco(req, res, pathname, url);
  if (arecoHandled !== false) return arecoHandled;

  return sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(error => {
    console.error(error);
    sendJson(res, error.status || 500, { error: error.message || "Erro interno" });
  });
});

migrate()
  .then(() => {
    startArecoScheduler();
    server.listen(PORT, () => {
      console.log(`SGQ Herbamed backend ouvindo na porta ${PORT}`);
    });
  })
  .catch(error => {
    console.error("Falha ao iniciar backend:", error);
    process.exit(1);
  });
