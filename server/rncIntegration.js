const crypto = require("crypto");

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function safeEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left || ""), "utf8").digest();
  const rightHash = crypto.createHash("sha256").update(String(right || ""), "utf8").digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function requireIntegrationKey(req) {
  const configuredKey = process.env.RNC_INTEGRATION_API_KEY || "";
  if (!configuredKey) {
    throw httpError(503, "Integracao de RNC nao configurada");
  }

  const presentedKey = req.headers["x-api-key"] || "";
  if (!safeEqual(presentedKey, configuredKey)) {
    throw httpError(401, "Credencial de integracao invalida");
  }
}

function encodeCursor(row) {
  if (!row) return null;
  const payload = {
    v: 1,
    updatedAt: new Date(row.updated_at).toISOString(),
    id: String(row.id),
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value) {
  if (!value) return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw httpError(400, "Cursor invalido");
  }

  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const timestamp = new Date(payload.updatedAt);
    if (payload.v !== 1 || !payload.id || Number.isNaN(timestamp.getTime())) {
      throw new Error("invalid cursor payload");
    }
    return { updatedAt: timestamp.toISOString(), id: String(payload.id) };
  } catch {
    throw httpError(400, "Cursor invalido");
  }
}

function parsePageSize(value) {
  if (value === null || value === undefined || value === "") return DEFAULT_PAGE_SIZE;
  if (!/^\d+$/.test(String(value))) throw httpError(400, "limit deve ser um numero inteiro positivo");
  const parsed = Number(value);
  if (parsed < 1 || parsed > MAX_PAGE_SIZE) {
    throw httpError(400, `limit deve estar entre 1 e ${MAX_PAGE_SIZE}`);
  }
  return parsed;
}

async function getRncIntegrationPage(query, cursorValue, limitValue) {
  const cursor = decodeCursor(cursorValue);
  const limit = parsePageSize(limitValue);
  const result = await query(`
    SELECT id, data, created_at, updated_at
    FROM rncs
    WHERE ($1::timestamptz IS NULL OR (updated_at, id) > ($1::timestamptz, $2::text))
    ORDER BY updated_at ASC, id ASC
    LIMIT $3
  `, [cursor?.updatedAt || null, cursor?.id || "", limit + 1]);

  const hasMore = result.rows.length > limit;
  const rows = result.rows.slice(0, limit);
  const lastRow = rows.at(-1);
  const nextCursor = lastRow ? encodeCursor(lastRow) : (cursorValue || null);

  return {
    items: rows.map(row => {
      const data = row.data || {};
      const anexos = Array.isArray(data.anexos)
        ? data.anexos.map(anexo => {
          const fileId = anexo?.id || String(anexo?.url || "").match(/^\/api\/files\/([0-9a-f-]{36})$/i)?.[1];
          return fileId
            ? { ...anexo, integrationUrl: `/api/integrations/rnc-files/${fileId}` }
            : anexo;
        })
        : data.anexos;
      return {
        ...data,
        ...(anexos === undefined ? {} : { anexos }),
        id: row.id,
        _sync: {
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        },
      };
    }),
    page: {
      count: rows.length,
      limit,
      hasMore,
      nextCursor,
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  decodeCursor,
  encodeCursor,
  getRncIntegrationPage,
  parsePageSize,
  requireIntegrationKey,
};
