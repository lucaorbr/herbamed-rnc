const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PDFDocument, StandardFonts, rgb, degrees } = require("pdf-lib");
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
const HERBAMED_LOGO_PATH = path.join(__dirname, "..", "public", "logo-herbamed.png");

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
    const maxBytes = Number(process.env.JSON_BODY_LIMIT_BYTES || 80_000_000);
    req.on("data", chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
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

function readBinaryBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new Error("Payload muito grande"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendBuffer(res, status, buffer, headers = {}) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    ...headers,
  });
  res.end(buffer);
}

async function handleClaude(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  await requireUser(req);

  const body = await readBody(req);

  // OpenAI tem prioridade se configurada; fallback para Anthropic
  if (process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        max_tokens: body.max_tokens || 2000,
        messages: body.messages || [],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        return sendJson(res, 429, { error: "Rate limit da OpenAI atingido. Aguarde alguns segundos antes de tentar novamente." });
      }
      return sendJson(res, response.status, { error: data.error?.message || "Erro OpenAI" });
    }
    // normaliza para o formato Anthropic que o frontend espera: { content: [{ text }] }
    const text = data.choices?.[0]?.message?.content || "";
    return sendJson(res, 200, { content: [{ type: "text", text }] });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...body, model: "claude-sonnet-4-5", max_tokens: body.max_tokens || 2000 }),
    });
    const data = await response.json();
    return sendJson(res, response.ok ? 200 : response.status, data);
  }

  return sendJson(res, 503, { error: "Nenhuma chave de IA configurada (OPENAI_API_KEY ou ANTHROPIC_API_KEY)" });
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

  if (pathname === "/api/auth/change-password" && req.method === "POST") {
    const user = await requireUser(req);
    const { senhaAtual, senhaNova } = await readBody(req);
    if (!senhaAtual || !senhaNova) return sendJson(res, 400, { error: "senhaAtual e senhaNova obrigatorios" });
    if (senhaNova.length < 8) return sendJson(res, 400, { error: "Nova senha deve ter no mínimo 8 caracteres" });
    const ok = await verifyPassword(user.id, senhaAtual);
    if (!ok) return sendJson(res, 401, { error: "Senha atual incorreta" });
    const hash = await bcrypt.hash(senhaNova, 12);
    await query("UPDATE users SET password_hash = $1, senha_temporaria = false, updated_at = now() WHERE id = $2", [hash, user.id]);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/auth/admin-reset-password" && req.method === "POST") {
    await requireAdmin(req);
    const { uid } = await readBody(req);
    if (!uid) return sendJson(res, 400, { error: "uid obrigatorio" });
    const hash = await bcrypt.hash("Herba@123", 12);
    await query("UPDATE users SET password_hash = $1, senha_temporaria = true, updated_at = now() WHERE id = $2", [hash, uid]);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/auth/signature" && req.method === "POST") {
    const user = await requireUser(req);
    const { password, contexto = "", papel = "", docId = null } = await readBody(req);
    const ok = await verifyPassword(user.id, password);
    if (!ok) return sendJson(res, 401, { error: "Senha incorreta" });

    // Rota de assinatura (Gestao de Documentos): Revisor e Aprovador ficam travados
    // ao usuario designado pelo Elaborador. Apenas o designado (ou um admin) assina.
    if (docId && (papel === "Revisor" || papel === "Aprovador")) {
      const docRes = await query(
        "SELECT data FROM generic_documents WHERE collection = 'gestao_docs' AND id = $1",
        [String(docId)]
      );
      const rota = docRes.rows[0]?.data?.rota || {};
      const designadoId = papel === "Revisor" ? rota.revisorId : rota.aprovadorId;
      if (user.role !== "admin" && designadoId && String(designadoId) !== String(user.id)) {
        return sendJson(res, 403, {
          error: `Apenas o ${papel.toLowerCase()} designado para este documento pode assinar.`,
        });
      }
    }

    const timestamp = new Date().toISOString();
    const payload = {
      userId: user.id,
      nome: user.name,
      email: user.email,
      setor: user.setor || "",
      registroProfissional: user.crf || "",
      papel,
      contexto,
      timestamp,
      metodoAutenticacao: "senha",
    };
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    const hash = crypto
      .createHmac("sha256", process.env.JWT_SECRET)
      .update(canonical)
      .digest("hex")
      .toUpperCase();
    const codigoVerificacao = `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;

    // Registro imutavel de conformidade (Secao 10). Nao bloqueia a assinatura:
    // se o INSERT falhar, loga mas a assinatura segue valida no documento JSON.
    try {
      const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null;
      await query(`
        INSERT INTO document_signatures
          (contexto, papel, user_id, nome, cargo, registro_profissional, codigo_verificacao, hash, metodo_autenticacao, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        contexto,
        papel,
        user.id,
        user.name,
        user.cargo || null,
        user.registroProfissional || user.crf || null,
        codigoVerificacao,
        hash,
        "senha",
        ipAddress,
      ]);
    } catch (error) {
      console.error("Falha ao registrar assinatura em document_signatures:", error);
    }

    return sendJson(res, 200, {
      ...payload,
      uid: user.id,
      nome: user.name,
      name: user.name,
      cargo: user.cargo || "",
      crf: user.crf || "",
      registro: user.crf || "",
      data: new Date(timestamp).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      hora: new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      dataHora: new Date(timestamp).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      timezone: "America/Sao_Paulo",
      hash,
      codigoVerificacao,
      versaoAssinatura: "SGQ-HERBAMED-ELETRONICA-1",
    });
  }

  return false;
}

async function handleSignatures(req, res, pathname, url) {
  if (pathname === "/api/signatures" && req.method === "GET") {
    await requireUser(req);
    const contexto = url.searchParams.get("contexto") || "";
    if (!contexto) return sendJson(res, 400, { error: "Parametro contexto obrigatorio" });
    const result = await query(
      "SELECT * FROM document_signatures WHERE contexto = $1 ORDER BY assinado_em ASC",
      [contexto]
    );
    return sendJson(res, 200, result.rows);
  }

  return false;
}

async function handleNotifications(req, res, pathname) {
  if (pathname === "/api/notifications" && req.method === "GET") {
    const user = await requireUser(req);
    const result = await query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY criada_em DESC LIMIT 50",
      [String(user.id)]
    );
    return sendJson(res, 200, result.rows);
  }

  if (pathname === "/api/notifications/mark-read" && req.method === "POST") {
    const user = await requireUser(req);
    const { ids = null } = await readBody(req);
    if (Array.isArray(ids) && ids.length) {
      await query(
        "UPDATE notifications SET lida = true, lida_em = now() WHERE user_id = $1 AND id = ANY($2::uuid[])",
        [String(user.id), ids]
      );
    } else {
      await query(
        "UPDATE notifications SET lida = true, lida_em = now() WHERE user_id = $1 AND lida = false",
        [String(user.id)]
      );
    }
    return sendJson(res, 200, { ok: true });
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
    const currentUser = await requireUser(req);
    const data = sanitize(await readBody(req));
    const existing = await query("SELECT data, role FROM users WHERE id = $1", [id]);
    if (!existing.rowCount) return sendJson(res, 404, { error: "Usuario nao encontrado" });

    const isAdmin = currentUser.role === "admin";
    if (!isAdmin) {
      // Usuario comum so pode editar o proprio cadastro.
      if (String(id) !== String(currentUser.id)) return sendJson(res, 403, { error: "Sem permissao" });
      // Usuario comum nunca pode alterar o campo role (nem o proprio).
      if (data.role !== undefined && data.role !== existing.rows[0].role) {
        return sendJson(res, 403, { error: "Sem permissao" });
      }
    }

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

async function handleFiles(req, res, pathname) {
  if (pathname === "/api/files" && req.method === "POST") {
    const user = await requireUser(req);
    const maxFileBytes = Number(process.env.FILE_UPLOAD_MAX_BYTES || 50 * 1024 * 1024);
    const contentType = String(req.headers["content-type"] || "");
    let name = "arquivo";
    let type = "application/octet-stream";
    let buffer = Buffer.alloc(0);

    if (contentType.includes("application/json")) {
      const body = await readBody(req);
      name = String(body.name || "arquivo").slice(0, 255);
      type = String(body.type || "application/octet-stream").slice(0, 160);
      const encoded = String(body.data || "");
      const base64 = encoded.includes(",") ? encoded.split(",").pop() : encoded;
      buffer = Buffer.from(base64, "base64");
    } else {
      const url = parseUrl(req);
      name = String(url.searchParams.get("name") || "arquivo").slice(0, 255);
      type = String(url.searchParams.get("type") || req.headers["content-type"] || "application/octet-stream").slice(0, 160);
      buffer = await readBinaryBody(req, maxFileBytes);
    }

    if (!buffer.length) return sendJson(res, 400, { error: "Arquivo vazio ou invalido" });
    if (buffer.length > maxFileBytes) return sendJson(res, 413, { error: "Arquivo maior que o limite permitido" });

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const result = await query(`
      INSERT INTO stored_files (original_name, mime_type, size_bytes, sha256, data, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, original_name, mime_type, size_bytes, created_at
    `, [name, type, buffer.length, sha256, buffer, user.id]);

    const file = result.rows[0];
    return sendJson(res, 201, {
      id: file.id,
      url: `/api/files/${file.id}`,
      name: file.original_name,
      type: file.mime_type,
      size: file.size_bytes,
      storedAt: file.created_at,
      storage: "postgres",
    });
  }

  const match = pathname.match(/^\/api\/files\/([0-9a-f-]{36})$/i);
  if (!match || req.method !== "GET") return false;
  await requireUser(req);
  const result = await query(
    "SELECT original_name, mime_type, size_bytes, data FROM stored_files WHERE id = $1",
    [match[1]]
  );
  if (!result.rowCount) return sendJson(res, 404, { error: "Arquivo nao encontrado" });

  const file = result.rows[0];
  return sendBuffer(res, 200, file.data, {
    "Content-Type": file.mime_type || "application/octet-stream",
    "Content-Length": String(file.size_bytes || file.data.length),
    "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name)}"`,
    "Cache-Control": "private, max-age=3600",
  });
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

async function createNotification(userId, tipo, titulo, mensagem, docId, docCodigo, link) {
  if (!userId) return;
  try {
    await query(`
      INSERT INTO notifications (user_id, tipo, titulo, mensagem, doc_id, doc_codigo, link)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [String(userId), tipo, titulo, mensagem || null, docId ? String(docId) : null, docCodigo || null, link || null]);
  } catch (error) {
    console.error("Falha ao criar notificacao:", error);
  }
}

// Notifica o proximo responsavel da rota de assinatura quando o Elaborador
// define a rota, quando o Revisor assina e quando o documento entra em vigencia.
async function notifyDocumentSignatureRoute(docId, oldData, newData) {
  const codigo = newData?.codigo || oldData?.codigo || docId;
  const titulo = newData?.titulo || oldData?.titulo || "";
  const refDoc = `${codigo} — ${titulo}`;
  const link = "/documentos";

  const novaRota = !oldData?.rota?.revisorId && newData?.rota?.revisorId;
  if (novaRota) {
    await createNotification(
      newData.rota.revisorId,
      "documento_revisao",
      "Documento aguardando sua revisão",
      `${refDoc} foi designado para sua revisão.`,
      docId, codigo, link
    );
  }

  const novaAssinaturaRevisor = !oldData?.assinaturaRevisor && newData?.assinaturaRevisor;
  if (novaAssinaturaRevisor && newData?.rota?.aprovadorId) {
    await createNotification(
      newData.rota.aprovadorId,
      "documento_aprovacao",
      "Documento aguardando sua aprovação",
      `${refDoc} foi revisado e aguarda sua aprovação.`,
      docId, codigo, link
    );
  }

  const tornouVigente = oldData?.status !== "Vigente" && newData?.status === "Vigente";
  if (tornouVigente && newData?.assinaturaElaborador?.uid) {
    await createNotification(
      newData.assinaturaElaborador.uid,
      "documento_vigente",
      "Documento entrou em vigência",
      `${refDoc} foi aprovado e está Vigente.`,
      docId, codigo, link
    );
  }
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

    let oldData = null;
    if (collection === "gestao_docs") {
      const prev = await query(
        "SELECT data FROM generic_documents WHERE collection = $1 AND id = $2",
        [collection, id]
      );
      oldData = prev.rows[0]?.data || null;
    }

    await query(`
      INSERT INTO generic_documents (collection, id, data, updated_at)
      VALUES ($1,$2,$3::jsonb,now())
      ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `, [collection, id, JSON.stringify({ ...data, id })]);

    if (collection === "gestao_docs") {
      await notifyDocumentSignatureRoute(id, oldData, data);
    }

    return sendJson(res, 200, { ok: true });
  }

  if (id && req.method === "DELETE") {
    await query("DELETE FROM generic_documents WHERE collection = $1 AND id = $2", [collection, id]);
    return sendJson(res, 200, { ok: true });
  }

  return false;
}

// ── Fase 2/3 — Renderização controlada de documentos (capa + marca d'água) ──

// Texto seguro para WinAnsi (StandardFonts): converte tipográficos e descarta
// qualquer caractere fora de Latin-1, evitando que o pdf-lib lance ao desenhar.
function pdfSafe(str) {
  if (!str) return "";
  return [...String(str)].map(ch => {
    const code = ch.codePointAt(0);
    if (code <= 255) return ch;
    const subs = {
      "—": "-", "–": "-",
      "“": '"', "”": '"',
      "‘": "'", "’": "'",
      "…": "...",
    };
    return subs[ch] || "?";
  }).join("");
}

// Porte do sigCodigo do front (core/utils) para gerar o mesmo código de
// verificação das assinaturas no PDF renderizado.
function sigCodigoServer(ass, ctx = "") {
  if (!ass) return "";
  if (ass.codigoVerificacao) return ass.codigoVerificacao;
  if (ass.verificationCode) return ass.verificationCode;
  const base = `${ass.email || ass.nome || ""}|${ass.userId || ass.uid || ""}|${ass.cargo || ""}|${ass.setor || ""}|${ass.registroProfissional || ass.crf || ass.registro || ""}|${ass.timestamp || ass.dataHora || (ass.data ? `${ass.data} ${ass.hora || ""}` : "")}|${ctx}`;
  const fnv = (seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < base.length; i++) { h ^= base.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
  };
  const full = (fnv(0x811c9dc5) + fnv(0x9e3779b1)).slice(0, 12);
  return `${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}`;
}

const TIPOS_DOC_RENDER = {
  PO: "Procedimento Operacional", IT: "Instrução de Trabalho", MOP: "Manual Operacional",
  FO: "Formulário", ESP: "Especificação", MAN: "Manual", ANX: "Anexo",
};
// Defaults de modelo por tipo (usados quando o catálogo configurável não traz o tipo).
// Formulário (FO): sem capa e sem marca d'água — vai impresso/xerocado nas OPs.
const TIPO_MODELO_DEFAULTS = {
  FO: { semCapa: true, semMarcaDagua: true },
};
const DEPTOS_DOC_RENDER = {
  SGQ: "Sistema de Gestão da Qualidade", CQ: "Controle de Qualidade", PRD: "Produção",
  LOG: "Logística", RH: "Recursos Humanos", COM: "Comercial", ADM: "Administrativo",
  "P&D": "Pesquisa e Desenvolvimento",
};

const WATERMARK_MODOS = {
  controlada:     { texto: "CÓPIA CONTROLADA",      cor: rgb(1.00, 0.00, 0.00), opacidade: 0.08 },
  nao_controlada: { texto: "CÓPIA NÃO CONTROLADA",  cor: rgb(0.40, 0.40, 0.40), opacidade: 0.14 },
  obsoleto:       { texto: "DOCUMENTO OBSOLETO",    cor: rgb(0.80, 0.10, 0.10), opacidade: 0.20 },
  rascunho:       { texto: "RASCUNHO — SEM VALOR",  cor: rgb(0.80, 0.40, 0.00), opacidade: 0.14 },
};

function fmtDataBR(value) {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
}

async function handleDistributionLog(req, res, pathname, url) {
  if (pathname !== "/api/distribution-log" || req.method !== "GET") return false;
  await requireUser(req);
  const docId = url.searchParams.get("docId");
  if (!docId) return sendJson(res, 400, { error: "docId obrigatório" });
  const result = await query(
    `SELECT id, doc_id, doc_codigo, usuario_id, usuario_nome, data_download, modo
     FROM distribution_log WHERE doc_id = $1 ORDER BY data_download DESC LIMIT 200`,
    [docId]
  );
  return sendJson(res, 200, result.rows);
}

async function handleDocumentRender(req, res, pathname, url) {
  const match = pathname.match(/^\/api\/documents\/([^/]+)\/render$/);
  if (!match || req.method !== "GET") return false;
  const reqUser = await requireUser(req);

  const docId = decodeURIComponent(match[1]);
  const modoRaw = (url.searchParams.get("modo") || "nao_controlada").toLowerCase();
  // Acesso restrito: usuário só pode renderizar documento Vigente, e somente em modo "cópia não controlada"
  const acessoRestritoVigente = reqUser?.permissoes?.acessoRestritoVigente === true;
  const modo = acessoRestritoVigente
    ? "nao_controlada"
    : (WATERMARK_MODOS[modoRaw] ? modoRaw : "nao_controlada");
  const userNameParam = url.searchParams.get("userName") || reqUser?.name || "";
  const wm = WATERMARK_MODOS[modo];
  console.log(`[RENDER] docId=${docId} modoRaw=${modoRaw} modo=${modo} wmTexto=${wm.texto}`);

  try {
    const docRes = await query(
      "SELECT data FROM generic_documents WHERE collection = 'gestao_docs' AND id = $1",
      [docId]
    );
    if (!docRes.rowCount) return sendJson(res, 404, { error: "Documento não encontrado" });
    const doc = docRes.rows[0].data || {};

    if (acessoRestritoVigente && doc.status !== "Vigente") {
      return sendJson(res, 403, { error: "Acesso restrito: somente documentos vigentes podem ser visualizados." });
    }

    const arquivoUrl = doc.arquivo && doc.arquivo.url ? String(doc.arquivo.url) : "";
    const fileId = arquivoUrl.includes("/api/files/") ? arquivoUrl.split("/api/files/").pop() : "";
    if (!fileId) return sendJson(res, 422, { error: "Documento sem arquivo anexado" });

    const fileRes = await query(
      "SELECT data, mime_type, original_name FROM stored_files WHERE id = $1",
      [fileId]
    );
    if (!fileRes.rowCount) return sendJson(res, 404, { error: "Arquivo não encontrado" });
    const file = fileRes.rows[0];
    if (file.mime_type !== "application/pdf") {
      return sendJson(res, 415, { error: "Renderização aplicável apenas a PDFs" });
    }

    const codigo  = pdfSafe(doc.codigo || "—");
    const versao  = pdfSafe(doc.versao || "01");
    const titulo  = pdfSafe(doc.titulo || "Documento");
    let tipoLbl = pdfSafe(TIPOS_DOC_RENDER[doc.tipo] || doc.tipo || "—");
    const deptoLbl = pdfSafe(DEPTOS_DOC_RENDER[doc.depto] || doc.depto || "—");
    const status  = pdfSafe(doc.status || "—");
    const ctxAss  = `${doc.codigo || ""}|R${doc.versao || ""}`;

    // Modelo do tipo: catálogo configurável (configuracoes/catalogo_tipos_doc) tem
    // prioridade; na ausência, usa os defaults hardcoded (ex: FO = formulário).
    let semCapa = false, semMarcaDagua = false;
    try {
      const catRes = await query(
        "SELECT data FROM generic_documents WHERE collection = 'configuracoes' AND id = 'catalogo_tipos_doc'"
      );
      const tipoCfg = (catRes.rows[0]?.data?.items || []).find(t => t.id === doc.tipo);
      const tipoNome = tipoCfg?.label || tipoCfg?.descricao || tipoCfg?.nome;
      if (tipoNome) tipoLbl = pdfSafe(tipoNome);
      // Default do tipo na base; flags explícitas do catálogo (se houver a chave) prevalecem.
      const fonte = { ...(TIPO_MODELO_DEFAULTS[doc.tipo] || {}), ...(tipoCfg || {}) };
      semCapa = !!fonte.semCapa;
      semMarcaDagua = !!fonte.semMarcaDagua;
    } catch (e) {
      const def = TIPO_MODELO_DEFAULTS[doc.tipo] || {};
      semCapa = !!def.semCapa; semMarcaDagua = !!def.semMarcaDagua;
    }
    const impressoEm = new Date().toLocaleString("pt-BR");
    // Marca d'água: sempre o texto limpo do modo — quem imprimiu fica só no distribution_log.
    const wmTexto = pdfSafe(wm.texto);

    const contentPdf = await PDFDocument.load(file.data);
    const out = await PDFDocument.create();
    const fontB = await out.embedFont(StandardFonts.HelveticaBold);
    const fontR = await out.embedFont(StandardFonts.Helvetica);
    let herbamedLogo = null;
    try {
      if (fs.existsSync(HERBAMED_LOGO_PATH)) {
        herbamedLogo = await out.embedPng(fs.readFileSync(HERBAMED_LOGO_PATH));
      }
    } catch (e) {
      console.warn("Logo Herbamed não pôde ser carregado no PDF:", e.message);
    }

    const draw = (page, text, x, y, size, font, color) =>
      page.drawText(pdfSafe(text), { x, y, size, font, color });
    const drawLogo = (page, x, y, maxW, maxH) => {
      if (!herbamedLogo) return false;
      const logo = herbamedLogo.scaleToFit(maxW, maxH);
      page.drawImage(herbamedLogo, { x, y: y + (maxH - logo.height) / 2, width: logo.width, height: logo.height });
      return true;
    };
    const drawRight = (page, text, xRight, y, size, font, color) => {
      const t = pdfSafe(text);
      const w = font.widthOfTextAtSize(t, size);
      page.drawText(t, { x: xRight - w, y, size, font, color });
    };
    const drawCenter = (page, text, cx, y, size, font, color) => {
      const t = pdfSafe(text);
      const w = font.widthOfTextAtSize(t, size);
      page.drawText(t, { x: cx - w / 2, y, size, font, color });
    };

    const verde = rgb(0.10, 0.29, 0.18);
    const cinza = rgb(0.42, 0.42, 0.42);
    const cinzaC = rgb(0.30, 0.30, 0.30);

    // ── CAPA (página 1) — pulada para tipos "modelo formulário" (semCapa) ──
    if (!semCapa) {
    const capa = out.addPage([595, 842]);
    const W = 595, H = 842;

    // Faixa superior verde
    capa.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: verde });
    if (!drawLogo(capa, 42, H - 47, 142, 34)) {
      draw(capa, "Herbamed Laboratório Nutracêutico LTDA", 40, H - 32, 13, fontB, rgb(1, 1, 1));
      draw(capa, "CNPJ: 14.829.598/0001-30", 40, H - 48, 9, fontR, rgb(0.85, 0.93, 0.87));
    }
    drawRight(capa, tipoLbl, W - 40, H - 32, 11, fontB, rgb(1, 1, 1));
    drawRight(capa, `${codigo} · Rev. ${versao}`, W - 40, H - 48, 10, fontR, rgb(0.85, 0.93, 0.87));

    // Bloco de identificação (título grande)
    let y = H - 110;
    draw(capa, titulo, 40, y, 22, fontB, verde);
    y -= 26;
    draw(capa, `Departamento: ${deptoLbl}   ·   Status: ${status}`, 40, y, 11, fontR, cinzaC);
    y -= 16;
    draw(capa, `Data de elaboração: ${fmtDataBR(doc.criadoEm)}   ·   Próxima revisão: ${fmtDataBR(doc.proximaRevisao)}`, 40, y, 11, fontR, cinzaC);

    // Seção "Identificação"
    y -= 40;
    draw(capa, "IDENTIFICAÇÃO", 40, y, 11, fontB, verde);
    capa.drawLine({ start: { x: 40, y: y - 5 }, end: { x: W - 40, y: y - 5 }, thickness: 1, color: verde });
    y -= 24;
    const ident = [
      ["Código", codigo], ["Tipo", tipoLbl],
      ["Versão", `Rev. ${versao}`], ["Departamento", deptoLbl],
      ["Data de elaboração", fmtDataBR(doc.criadoEm)], ["Próxima revisão", fmtDataBR(doc.proximaRevisao)],
    ];
    const colX = [40, 310];
    for (let i = 0; i < ident.length; i += 2) {
      for (let c = 0; c < 2 && i + c < ident.length; c++) {
        const [k, v] = ident[i + c];
        draw(capa, String(k).toUpperCase(), colX[c], y, 8, fontB, cinza);
        draw(capa, v, colX[c], y - 13, 11, fontR, cinzaC);
      }
      y -= 34;
    }

    // Seção "Assinaturas Eletrônicas" — 3 caixas lado a lado
    y -= 6;
    draw(capa, "ASSINATURAS ELETRÔNICAS", 40, y, 11, fontB, verde);
    capa.drawLine({ start: { x: 40, y: y - 5 }, end: { x: W - 40, y: y - 5 }, thickness: 1, color: verde });
    y -= 18;

    const boxW = (W - 80 - 24) / 3; // 3 caixas, gaps de 12
    const boxH = 120;
    const boxTop = y;
    const assinaturas = [
      ["Elaborador", doc.assinaturaElaborador],
      ["Revisor", doc.assinaturaRevisor],
      ["Aprovador", doc.assinaturaAprovador],
    ];
    assinaturas.forEach(([papel, ass], idx) => {
      const bx = 40 + idx * (boxW + 12);
      const by = boxTop - boxH;
      capa.drawRectangle({ x: bx, y: by, width: boxW, height: boxH, borderColor: verde, borderWidth: 1, color: rgb(0.98, 0.99, 0.98) });
      let ty = boxTop - 16;
      draw(capa, papel.toUpperCase(), bx + 8, ty, 8, fontB, verde);
      ty -= 16;
      if (ass) {
        draw(capa, ass.nome || "—", bx + 8, ty, 10, fontB, cinzaC); ty -= 13;
        if (ass.cargo) { draw(capa, ass.cargo, bx + 8, ty, 8, fontR, cinza); ty -= 11; }
        const reg = ass.registroProfissional || ass.crf || ass.registro || "";
        if (reg) { draw(capa, `Reg.: ${reg}`, bx + 8, ty, 8, fontR, cinza); ty -= 11; }
        const quando = ass.timestamp ? new Date(ass.timestamp).toLocaleString("pt-BR") : (ass.dataHora || "");
        if (quando) { draw(capa, quando, bx + 8, ty, 7, fontR, cinza); ty -= 11; }
        draw(capa, "Cód.:", bx + 8, ty, 7, fontR, cinza);
        draw(capa, sigCodigoServer(ass, ctxAss), bx + 30, ty, 7, fontB, cinzaC);
      } else {
        draw(capa, "Aguardando", bx + 8, ty - 6, 10, fontR, rgb(0.7, 0.7, 0.7));
      }
    });

    // Rodapé da capa: esquerda = empresa, direita = modo
    draw(capa, "Herbamed Laboratório Nutracêutico LTDA", 40, 30, 8, fontR, cinza);
    drawRight(capa, wmTexto, W - 40, 30, 8, fontR, cinza);
    } // fim if(!semCapa)

    // ── CONTEÚDO (páginas 2+) ──
    const indices = contentPdf.getPageIndices();
    const copiadas = await out.copyPages(contentPdf, indices);
    copiadas.forEach(p => out.addPage(p));

    // ── Carimbar CONTEÚDO com marca d'água diagonal ──
    // Quando há capa (idx 0), ela tem footer próprio e não é carimbada.
    // Quando semCapa, todas as páginas são conteúdo.
    const pages = out.getPages();
    const capaOffset = semCapa ? 0 : 1;          // nº de páginas que não são conteúdo
    const totalConteudo = pages.length - capaOffset;
    pages.forEach((page, idx) => {
      // Pula capa para não sobrepor marca d'água diagonal com footer
      if (!semCapa && idx === 0) return;

      const { width, height } = page.getSize();

      // Marca d'água diagonal — omitida em tipos "modelo formulário" (xerocados)
      if (!semMarcaDagua) {
        const wmSize = Math.max(36, Math.min(width, height) * 0.07);
        const angle = (45 * Math.PI) / 180;
        const tw = fontB.widthOfTextAtSize(wmTexto, wmSize);
        const th = fontB.heightAtSize(wmSize);
        const x = width / 2 - (tw / 2) * Math.cos(angle) + (th / 2) * Math.sin(angle);
        const yPos = height / 2 - (tw / 2) * Math.sin(angle) - (th / 2) * Math.cos(angle);
        page.drawText(wmTexto, { x, y: yPos, size: wmSize, font: fontB, color: wm.cor, opacity: wm.opacidade, rotate: degrees(45) });
      }

      // Cabeçalho e rodapé nas páginas de conteúdo
      const numPag = idx - capaOffset + 1; // página de conteúdo (1..N)
      // Faixa de cabeçalho — mesmo padrão verde da capa, repetida nas páginas
      // de conteúdo para que documentos sem capa (semCapa) mantenham identidade visual
      const hdrH = 46;
      page.drawRectangle({ x: 0, y: height - hdrH, width, height: hdrH, color: verde });
      if (!drawLogo(page, 20, height - 35, 112, 24)) {
        draw(page, "Herbamed Laboratório Nutracêutico LTDA", 16, height - 19, 10, fontB, rgb(1, 1, 1));
        draw(page, "CNPJ: 14.829.598/0001-30", 16, height - 32, 7, fontR, rgb(0.85, 0.93, 0.87));
      }
      const tituloHdr = titulo.length > 55 ? titulo.slice(0, 54) + "…" : titulo;
      drawRight(page, pdfSafe(tituloHdr), width - 16, height - 19, 9, fontB, rgb(1, 1, 1));
      drawRight(page, pdfSafe(`${codigo} · Rev. ${versao} · ${status}`), width - 16, height - 32, 8, fontR, rgb(0.85, 0.93, 0.87));
      // Faixa de rodapé — sem o texto da marca quando o tipo é "modelo formulário"
      page.drawRectangle({ x: 0, y: 0, width, height: 16, color: rgb(0.93, 0.95, 0.93) });
      const rodape = semMarcaDagua
        ? `${codigo} Rev. ${versao} · Página ${numPag} de ${totalConteudo}`
        : `${wmTexto} · ${codigo} Rev. ${versao} · Página ${numPag} de ${totalConteudo}`;
      page.drawText(pdfSafe(rodape), { x: 16, y: 5, size: 7, font: fontR, color: cinza });
    });

    const bytes = await out.save();

    // Fase 7 — registra distribuição de cópias não controladas
    if (modo === "nao_controlada") {
      query(
        `INSERT INTO distribution_log (doc_id, doc_codigo, usuario_id, usuario_nome, modo)
         VALUES ($1, $2, $3, $4, $5)`,
        [docId, doc.codigo || "", reqUser?.id || "", reqUser?.name || userNameParam, modo]
      ).catch(e => console.error("distribution_log insert failed:", e));
    }

    return sendBuffer(res, 200, Buffer.from(bytes), {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
    });
  } catch (error) {
    console.error("Falha ao renderizar documento:", error);
    return sendJson(res, 422, { error: `Não foi possível renderizar o documento: ${error.message}` });
  }
}

async function handleAreco(req, res, pathname, url) {
  if (pathname === "/api/areco/materiais" && req.method === "GET") {
    await requireUser(req);
    const q = url.searchParams.get("q") || "";
    const tipo = url.searchParams.get("tipo") || "";
    const params = [];
    const where = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(codigo ILIKE $${params.length} OR nome ILIKE $${params.length})`);
    }
    if (tipo) {
      params.push(tipo);
      where.push(`tipo = $${params.length}`);
    }
    const result = await query(`
      SELECT * FROM areco_materiais
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY nome
      LIMIT 500
    `, params);
    return sendJson(res, 200, result.rows);
  }

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

  const recebimentoMatch = pathname.match(/^\/api\/areco\/recebimentos\/([^/]+)$/);
  if (recebimentoMatch && (req.method === "PATCH" || req.method === "PUT")) {
    await requireUser(req);
    const id = decodeURIComponent(recebimentoMatch[1]);
    const data = sanitize(await readBody(req));
    const allowed = new Set(["pendente_analise", "em_analise", "concluido", "fora_escopo"]);
    const status = allowed.has(data.status) ? data.status : null;

    const result = await query(`
      UPDATE areco_recebimentos SET
        status = COALESCE($2, status),
        cq_analise_id = COALESCE($3, cq_analise_id),
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [id, status, data.cq_analise_id || data.cqAnaliseId || null]);

    return sendJson(res, result.rowCount ? 200 : 404, result.rowCount ? result.rows[0] : { error: "Recebimento Areco nao encontrado" });
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

// ── Seção: Link Fornecedor — endpoints públicos (sem auth) ──────────────────
async function handleSupplierRNC(req, res, pathname) {
  // Gerar token (requer auth interna)
  if (pathname === "/api/rnc-supplier/gerar-token" && req.method === "POST") {
    const reqUser = await requireUser(req);
    const body = await readBody(req);
    const { rncId, rncNum, diasValidade = 30 } = body;
    if (!rncId) return sendJson(res, 400, { error: "rncId obrigatório" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(diasValidade));

    await query(
      `INSERT INTO rnc_supplier_tokens (rnc_id, rnc_num, token, expires_at, criado_por)
       VALUES ($1, $2, $3, $4, $5)`,
      [rncId, rncNum || "", token, expiresAt.toISOString(), reqUser?.name || ""]
    );
    return sendJson(res, 200, { token, expiresAt: expiresAt.toISOString() });
  }

  // Buscar RNC por token (público — sem auth)
  const matchGet = pathname.match(/^\/api\/rnc-supplier\/([a-f0-9]{64})$/);
  if (matchGet && req.method === "GET") {
    const token = matchGet[1];
    const tkRes = await query(
      `SELECT * FROM rnc_supplier_tokens WHERE token = $1`,
      [token]
    );
    if (!tkRes.rowCount) return sendJson(res, 404, { error: "Link inválido" });
    const tk = tkRes.rows[0];
    if (new Date(tk.expires_at) < new Date()) return sendJson(res, 410, { error: "Link expirado" });

    // Busca dados da RNC
    const rncRes = await query(
      `SELECT data FROM generic_documents WHERE collection = 'rncs' AND id = $1
       UNION ALL
       SELECT data FROM generic_documents WHERE collection = 'rncs' AND id = $1 LIMIT 1`,
      [tk.rnc_id]
    );
    // Tenta via tabela rncs
    const rncRow = await query(`SELECT data FROM rncs WHERE id = $1`, [tk.rnc_id]);
    const rnc = rncRow.rows[0]?.data || null;

    return sendJson(res, 200, {
      token,
      rncId: tk.rnc_id,
      rncNum: tk.rnc_num,
      expiresAt: tk.expires_at,
      respondido: !!tk.respondido_em,
      respondidoEm: tk.respondido_em,
      rnc,
    });
  }

  // Submeter resposta (público — sem auth)
  const matchPost = pathname.match(/^\/api\/rnc-supplier\/([a-f0-9]{64})\/responder$/);
  if (matchPost && req.method === "POST") {
    const token = matchPost[1];
    const tkRes = await query(
      `SELECT * FROM rnc_supplier_tokens WHERE token = $1`,
      [token]
    );
    if (!tkRes.rowCount) return sendJson(res, 404, { error: "Link inválido" });
    const tk = tkRes.rows[0];
    if (new Date(tk.expires_at) < new Date()) return sendJson(res, 410, { error: "Link expirado" });
    if (tk.respondido_em) return sendJson(res, 409, { error: "Este link já foi respondido" });

    const body = await readBody(req);
    const resposta = {
      porques: body.porques || [],
      causaRaiz: body.causaRaiz || "",
      planoAcao: body.planoAcao || {},
      observacoes: body.observacoes || "",
      respondidoEm: new Date().toISOString(),
    };

    // Salva resposta no token
    await query(
      `UPDATE rnc_supplier_tokens SET respondido_em = now(), resposta = $2 WHERE token = $1`,
      [token, JSON.stringify(resposta)]
    );

    // Incorpora resposta na RNC (campo respostaFornecedor)
    const rncRow = await query(`SELECT data FROM rncs WHERE id = $1`, [tk.rnc_id]);
    if (rncRow.rowCount) {
      const rncData = { ...rncRow.rows[0].data, respostaFornecedor: resposta };
      await query(
        `UPDATE rncs SET data = $2, updated_at = now() WHERE id = $1`,
        [tk.rnc_id, JSON.stringify(rncData)]
      );
    }

    return sendJson(res, 200, { ok: true });
  }

  // Buscar resposta de um token (auth interna — para visualizar no sistema)
  const matchResp = pathname.match(/^\/api\/rnc-supplier\/token\/([a-f0-9]{64})\/resposta$/);
  if (matchResp && req.method === "GET") {
    await requireUser(req);
    const token = matchResp[1];
    const tkRes = await query(`SELECT * FROM rnc_supplier_tokens WHERE token = $1`, [token]);
    if (!tkRes.rowCount) return sendJson(res, 404, { error: "Token não encontrado" });
    return sendJson(res, 200, tkRes.rows[0]);
  }

  // Listar tokens de uma RNC (auth interna)
  const matchList = pathname.match(/^\/api\/rnc-supplier\/por-rnc\/(.+)$/);
  if (matchList && req.method === "GET") {
    await requireUser(req);
    const rncId = decodeURIComponent(matchList[1]);
    const result = await query(
      `SELECT id, token, rnc_num, expires_at, criado_por, criado_em, respondido_em
       FROM rnc_supplier_tokens WHERE rnc_id = $1 ORDER BY criado_em DESC`,
      [rncId]
    );
    return sendJson(res, 200, result.rows);
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

  // Supplier link: endpoints públicos ANTES dos handlers autenticados
  const supplierHandled = await handleSupplierRNC(req, res, pathname);
  if (supplierHandled !== false) return supplierHandled;

  const handlers = [handleAuth, handleSignatures, handleNotifications, handleUsers, handleRncs, handleCounters, handleFiles, handleDistributionLog, handleDocumentRender, handleCollections];
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
